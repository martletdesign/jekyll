import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash,timingSafeEqual} from 'node:crypto';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import worker from '../infra/docs-archive/worker.mjs';

// In-memory R2 models conditional puts only; this does not prove R2 IAM or WORM.
crypto.subtle.timingSafeEqual=(a,b)=>timingSafeEqual(Buffer.from(a),Buffer.from(b));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
class MockR2 {
 data=new Map();
 async head(k){return this.data.has(k)?{}:null;}
 async get(k){const b=this.data.get(k);return b?{body:true,etag:sha(b),arrayBuffer:async()=>Uint8Array.from(b).buffer}:null;}
 async put(k,b,o){const n=o.onlyIf.get('if-none-match'),m=o.onlyIf.get('if-match');if(n==='*'&&this.data.has(k))return null;if(m&&(!this.data.has(k)||m!==`"${sha(this.data.get(k))}"`))return null;if(!n&&!m)throw Error('unconditional put');this.data.set(k,Uint8Array.from(b));return {};}
}
const token='local-test-token-at-least-32-characters';

test('real source-built Jekyll archive uploads create-only and round-trips verified bytes',async()=>{
 const tmp=await mkdtemp(join(tmpdir(),'jekyll-r2-test-'));
 try{
  const sourceCommit=spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8'});assert.equal(sourceCommit.status,0);const commit=sourceCommit.stdout.trim();
  const version=(await readFile('VERSION','utf8')).trim();
  for(const prefix of ['','/preview']){
   const dest=join(tmp,prefix?'preview':'root');
   const build=spawnSync('python3',['scripts/docs-archive.py','--destination',dest,'--prefix',prefix,'--version',version],{encoding:'utf8'});assert.equal(build.status,0,build.stdout+build.stderr);
   const dir=join(dest,'docs','v',version), evidence=JSON.parse(await readFile(join(dir,'nightjar-local-evidence.json'),'utf8'));
   const extra=await readFile(join(dir,'nightjar-local-evidence.json'));const files=[...evidence.files,{path:'nightjar-local-evidence.json',size:extra.length,sha256:sha(extra)}];
   const family=evidence.family, legacy=evidence.source_shell, tag=`v${version}`;
   const manifest={schemaVersion:1,family,framework:'jekyll',docsVersion:version,basePath:`/docs/v/${version}/`,implementation:{kind:'git',name:`${family}design/jekyll`,version,tag},source:{repository:`${family}design/jekyll`,commit,tag},core:null,legacyTheme:{name:legacy.legacy_package,version:legacy.legacy_version,integrity:legacy.legacy_registry_integrity,sourceShellSha256:legacy.sha256},indexing:'noindex',files};
   const env={FAMILY:family,ARCHIVES:new MockR2(),ARCHIVE_WRITE_TOKEN:token,DEPLOY_PREFIX:prefix};
   const call=(path,method='GET',body,headers={})=>worker.fetch(new Request(`https://example.invalid${prefix}${path}`,{method,body,headers:{authorization:`Bearer ${token}`,...headers}}),env);
   assert.equal((await call('/docs/catalog.json')).status,503);
   assert.equal((await call('/_archive/promotion','PUT','{}')).status,503);
   const root=`/_archive/v/${version}/`;const index=await readFile(join(dir,'index.html'));
   assert.equal((await worker.fetch(new Request(`https://example.invalid${prefix}${root}index.html`,{method:'PUT',body:index}),env)).status,401);
   for(const file of files){const bytes=await readFile(join(dir,file.path));assert.equal((await call(root+file.path,'PUT',bytes)).status,201,file.path);}
   for(const invalid of [
    {...manifest,core:{name:`@${family}/core`}},
    {...manifest,legacyTheme:{...manifest.legacyTheme,name:`@${family}/core`}},
    {...manifest,legacyTheme:{...manifest.legacyTheme,integrity:'unverified'}},
    {...manifest,source:{...manifest.source,commit:'unverified'}}
   ]){
    const bad=Buffer.from(JSON.stringify(invalid));
    assert.equal((await call(root+'manifest.json','PUT',bad,{'x-manifest-sha256':sha(bad)})).status,400,'incorrect provenance must fail');
   }
   const m=Buffer.from(JSON.stringify(manifest));assert.equal((await call(root+'manifest.json','PUT',m,{'x-manifest-sha256':sha(m)})).status,201);
   assert.equal((await call(root+'index.html','PUT',index)).status,409,'committed file cannot be overwritten');
   for(const file of files){const response=await call(`/docs/v/${version}/${file.path}`);assert.equal(response.status,200,file.path);const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.length,file.size);assert.equal(sha(bytes),file.sha256,file.path);}
   const html=await (await call(`/docs/v/${version}/`)).text();assert.match(html,/Documentation versions/);assert.match(html,/noindex/);
   env.ARCHIVES.data.set(`${family}/jekyll/${version}/index.html`,Buffer.from('tampered'));
   assert.equal((await call(`/docs/v/${version}/`)).status,503,'corruption must fail closed');
   console.log(`${family} ${prefix||'/'}: ${files.length} actual files verified through the local R2 test double`);
  }
 }finally{await rm(tmp,{recursive:true,force:true});}
});
