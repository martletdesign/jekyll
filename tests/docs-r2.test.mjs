import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash,timingSafeEqual} from 'node:crypto';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import worker from '../infra/docs-archive/worker.mjs';
import {validateManifest,validateCatalog} from '../scripts/docs-versions/contract.mjs';

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
   const manifest={schemaVersion:1,family,framework:'jekyll',docsVersion:version,basePath:`/docs/v/${version}/`,implementation:{kind:'git',name:`${family}design/jekyll`,version,tag},source:{repository:`${family}design/jekyll`,commit,tag},core:null,legacyTheme:{name:legacy.legacy_package,version:legacy.legacy_version,integrity:legacy.legacy_registry_integrity,sourceShellSha256:legacy.sha256},fixtures:{source:'repository'},toolchain:{ruby:'3.2.3'},createdAt:'2026-11-01T00:00:00.000Z',indexing:'noindex',files};
   assert.equal(validateManifest(manifest),manifest);
   const env={FAMILY:family,ARCHIVES:new MockR2(),ARCHIVE_WRITE_TOKEN:token,DEPLOY_PREFIX:prefix};
   const call=(path,method='GET',body,headers={})=>worker.fetch(new Request(`https://example.invalid${prefix}${path}`,{method,body,headers:{authorization:`Bearer ${token}`,...headers}}),env);
   assert.equal((await call('/docs/versions/')).status,503,'missing catalog fails closed');
   const root=`/_archive/v/${version}/`;const index=await readFile(join(dir,'index.html'));
   assert.equal((await worker.fetch(new Request(`https://example.invalid${prefix}${root}index.html`,{method:'PUT',body:index}),env)).status,401);
   for(const file of files){const bytes=await readFile(join(dir,file.path));assert.equal((await call(root+file.path,'PUT',bytes)).status,201,file.path);}
   for(const invalid of [
    {...manifest,core:{name:`@${family}/core`}},
    {...manifest,legacyTheme:{...manifest.legacyTheme,name:`@${family}/core`}},
    {...manifest,legacyTheme:{...manifest.legacyTheme,integrity:'unverified'}},
    {...manifest,legacyTheme:{...manifest.legacyTheme,sourceShellSha256:'f'.repeat(64)}},
    {...manifest,source:{...manifest.source,commit:'unverified'}}
   ]){
    const bad=Buffer.from(JSON.stringify(invalid));
    assert.equal((await call(root+'manifest.json','PUT',bad,{'x-manifest-sha256':sha(bad)})).status,400,'incorrect provenance must fail');
   }
   const m=Buffer.from(JSON.stringify(manifest));assert.equal((await call(root+'manifest.json','PUT',m,{'x-manifest-sha256':sha(m)})).status,201);
   for(const path of [`/docs/v/${version}`,`/docs/v/${version}/examples/home`]){
    const response=await call(path);assert.equal(response.status,308);assert.equal(response.headers.get('location'),prefix+path+'/');
    assert.equal((await call(path,'HEAD')).status,308);
   }
   assert.equal((await call(`/docs/v/${version}/template.zip`)).headers.get('content-type'),'application/zip');
   assert.equal((await call(root+'index.html','PUT',index)).status,409,'committed file cannot be overwritten');
   const firstCatalog={schemaVersion:1,family,framework:'jekyll',previousSha256:null,latestStable:null,versions:[{version,channel:'prerelease',manifestSha256:sha(m),supported:false,topics:files.filter(x=>x.path.endsWith('.html')).map(x=>x.path)}]};
   assert.equal(validateCatalog(firstCatalog),firstCatalog);
   const catalog=Buffer.from(JSON.stringify(firstCatalog));
   assert.equal((await call('/_archive/catalog','PUT',catalog,{'x-previous-catalog-sha256':'none'})).status,201);
   assert.equal(sha(Buffer.from(await (await call('/docs/catalog.json')).arrayBuffer())),sha(catalog));
   const catalogIndex=await call('/docs/versions/');assert.equal(catalogIndex.status,200);assert.match(catalogIndex.headers.get('content-type'),/text\/html/);assert.equal(catalogIndex.headers.get('cache-control'),'no-store');
   const indexHtml=await catalogIndex.text();assert.match(indexHtml,/Documentation versions/);assert.ok(indexHtml.includes(`href="${prefix}/docs/v/${version}/"`));assert.match(indexHtml,/prerelease/);assert.match(indexHtml,/unsupported/);
   assert.equal((await call('/docs/versions/','HEAD')).status,200);
   const rewritten=Buffer.from(JSON.stringify({...firstCatalog,previousSha256:sha(catalog),versions:[{...firstCatalog.versions[0],manifestSha256:'f'.repeat(64)}]}));
   assert.equal((await call('/_archive/catalog','PUT',rewritten,{'x-previous-catalog-sha256':sha(catalog)})).status,409);
   const advance=description=>call('/_archive/catalog','PUT',Buffer.from(JSON.stringify({...firstCatalog,previousSha256:sha(catalog),description})),{'x-previous-catalog-sha256':sha(catalog)});
   assert.deepEqual((await Promise.all([advance('one'),advance('two')])).map(x=>x.status).sort(),[201,409]);
   assert.equal(sha(Buffer.from(await (await call(`/docs/catalog-history/${sha(catalog)}.json`)).arrayBuffer())),sha(catalog));
   const promotion=Buffer.from(JSON.stringify({schemaVersion:1,family,framework:'jekyll',previousSha256:null,catalogSha256:sha(catalog),version,operation:'promote',reason:''}));
   assert.notEqual((await call('/_archive/promotion','PUT',promotion,{'x-previous-promotion-sha256':'none'})).status,201,'prerelease must never become latest stable');
   for(const file of files){const response=await call(`/docs/v/${version}/${file.path}`);assert.equal(response.status,200,file.path);const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.length,file.size);assert.equal(sha(bytes),file.sha256,file.path);}
   const html=await (await call(`/docs/v/${version}/`)).text();assert.match(html,/Documentation versions/);assert.match(html,/noindex/);
   env.ARCHIVES.data.set(`${family}/jekyll/${version}/index.html`,Buffer.from('tampered'));
   assert.equal((await call(`/docs/v/${version}/`)).status,503,'corruption must fail closed');
   console.log(`${family} ${prefix||'/'}: ${files.length} actual files verified through the local R2 test double`);
  }
 }finally{await rm(tmp,{recursive:true,force:true});}
});

test('oversized chunked requests are cancelled before buffering entire bodies',async()=>{
 const family=JSON.parse(await readFile('scripts/source-shell-provenance.json','utf8')).family;
 for(const [path,chunkSize,chunks] of [['/_archive/v/2.0.0/large.bin',1024*1024,24],['/_archive/catalog',256*1024,8],['/_archive/promotion',32*1024,8]]){
  const env={FAMILY:family,ARCHIVES:new MockR2(),ARCHIVE_WRITE_TOKEN:token};let produced=0,cancelled=false;
  const body=new ReadableStream({pull(controller){produced++;controller.enqueue(new Uint8Array(chunkSize));if(produced===chunks)controller.close();},cancel(){cancelled=true;}});
  const request=new Request(`https://example.invalid${path}`,{method:'PUT',body,duplex:'half',headers:{authorization:`Bearer ${token}`}});
  assert.equal((await worker.fetch(request,env)).status,413,path);assert.ok(cancelled,path);assert.ok(produced<chunks,path);assert.equal(env.ARCHIVES.data.size,0,path);
 }
});

test('stable promotion, concurrency and explicit rollback use verified immutable catalog history',async()=>{
 const provenance=JSON.parse(await readFile('scripts/source-shell-provenance.json','utf8')),family=provenance.family;
 const env={FAMILY:family,ARCHIVES:new MockR2(),ARCHIVE_WRITE_TOKEN:token,DEPLOY_PREFIX:'/preview'};
 const call=(path,method='GET',body,headers={})=>worker.fetch(new Request(`https://example.invalid/preview${path}`,{method,body,headers:{authorization:`Bearer ${token}`,...headers}}),env);
 const shell=await readFile('assets/css/shell.css');assert.equal(sha(shell),provenance.source_shell_sha256);
 const fixture=async(version)=>{
  const html=Buffer.from('<meta name="robots" content="noindex"><h1>Fixture</h1>'),tag=`v${version}`;
  const files=[{path:'index.html',size:html.length,sha256:sha(html)},{path:'assets/css/shell.css',size:shell.length,sha256:sha(shell)}];
  const manifest={schemaVersion:1,family,framework:'jekyll',docsVersion:version,basePath:`/docs/v/${version}/`,implementation:{kind:'git',name:`${family}design/jekyll`,version,tag},source:{repository:`${family}design/jekyll`,commit:'a'.repeat(40),tag},core:null,legacyTheme:{name:provenance.legacy_package,version:provenance.legacy_version,integrity:provenance.legacy_registry_integrity,sourceShellSha256:sha(shell)},fixtures:{source:'repository'},toolchain:{ruby:'3.2.3'},createdAt:'2026-11-01T00:00:00.000Z',indexing:'noindex',files};
  validateManifest(manifest);const root=`/_archive/v/${version}/`;
  assert.equal((await call(root+'index.html','PUT',html)).status,201);assert.equal((await call(root+'assets/css/shell.css','PUT',shell)).status,201);
  const bytes=Buffer.from(JSON.stringify(manifest));assert.equal((await call(root+'manifest.json','PUT',bytes,{'x-manifest-sha256':sha(bytes)})).status,201);
  return {version,channel:'stable',manifestSha256:sha(bytes),supported:true,topics:['index.html']};
 };
 const first=await fixture('1.0.0'),second=await fixture('2.0.0');
 const c1={schemaVersion:1,family,framework:'jekyll',previousSha256:null,latestStable:'1.0.0',versions:[first]}, b1=Buffer.from(JSON.stringify(c1));
 assert.equal((await call('/_archive/catalog','PUT',b1,{'x-previous-catalog-sha256':'none'})).status,201);
 const p1={schemaVersion:1,family,framework:'jekyll',previousSha256:null,catalogSha256:sha(b1),version:'1.0.0',operation:'promote',reason:''},q1=Buffer.from(JSON.stringify(p1));
 assert.equal((await call('/_archive/promotion','PUT',q1,{'x-previous-promotion-sha256':'none'})).status,201);
 assert.equal((await call('/docs/')).headers.get('location'),'/preview/docs/v/1.0.0/');
 const c2={...c1,previousSha256:sha(b1),latestStable:'2.0.0',versions:[first,second]},b2=Buffer.from(JSON.stringify(c2));
 assert.equal((await call('/_archive/catalog','PUT',b2,{'x-previous-catalog-sha256':sha(b1)})).status,201);
 const versions=await (await call('/docs/versions/')).text();
 assert.ok(versions.includes('href="/preview/docs/v/1.0.0/"'));assert.ok(versions.includes('href="/preview/docs/v/2.0.0/"'));
 assert.equal((await call('/docs/v/1.0.0/')).status,200,'old archive remains readable after newer catalog');
 const p2={...p1,previousSha256:sha(q1),catalogSha256:sha(b2),version:'2.0.0'},q2=Buffer.from(JSON.stringify(p2));
 assert.equal((await call('/_archive/promotion','PUT',q2,{'x-previous-promotion-sha256':sha(q1)})).status,201);
 assert.equal((await call('/docs/')).headers.get('location'),'/preview/docs/v/2.0.0/');
 const c3={...c2,previousSha256:sha(b2),latestStable:'1.0.0',versions:[first,{...second,supported:false}]},b3=Buffer.from(JSON.stringify(c3));
 assert.equal((await call('/_archive/catalog','PUT',b3,{'x-previous-catalog-sha256':sha(b2)})).status,201);
 assert.equal((await call('/docs/')).status,503,'withdrawn latest requires reconciliation');
 const bad={...p2,previousSha256:sha(q2),catalogSha256:sha(b3),version:'1.0.0',operation:'promote'},badBytes=Buffer.from(JSON.stringify(bad));
 assert.equal((await call('/_archive/promotion','PUT',badBytes,{'x-previous-promotion-sha256':sha(q2)})).status,409);
 const rollback={...bad,operation:'rollback',reason:'Bad release withdrawn'},back=Buffer.from(JSON.stringify(rollback));
 assert.equal((await call('/_archive/promotion','PUT',back,{'x-previous-promotion-sha256':sha(q2)})).status,201);
 assert.equal((await call('/docs/')).headers.get('location'),'/preview/docs/v/1.0.0/');
 assert.equal(sha(Buffer.from(await (await call(`/docs/promotion-history/${sha(q2)}.json`)).arrayBuffer())),sha(q2));
});

test('indexable HTML and core-plus-legacy ambiguity are rejected before commit',async()=>{
 const p=JSON.parse(await readFile('scripts/source-shell-provenance.json','utf8')),family=p.family,version='9.9.9',tag=`v${version}`;
 const env={FAMILY:family,ARCHIVES:new MockR2(),ARCHIVE_WRITE_TOKEN:token};
 const call=(path,body,extra={})=>worker.fetch(new Request(`https://example.invalid${path}`,{method:'PUT',body,headers:{authorization:`Bearer ${token}`,...extra}}),env);
 const html=Buffer.from('<h1>Indexable</h1>'),shell=await readFile('assets/css/shell.css'),root=`/_archive/v/${version}/`;
 const files=[{path:'index.html',size:html.length,sha256:sha(html)},{path:'assets/css/shell.css',size:shell.length,sha256:sha(shell)}];
 const m={schemaVersion:1,family,framework:'jekyll',docsVersion:version,basePath:`/docs/v/${version}/`,implementation:{kind:'git',name:`${family}design/jekyll`,version,tag},source:{repository:`${family}design/jekyll`,commit:'a'.repeat(40),tag},core:null,legacyTheme:{name:p.legacy_package,version:p.legacy_version,integrity:p.legacy_registry_integrity,sourceShellSha256:sha(shell)},fixtures:{source:'repository'},toolchain:{ruby:'3.2.3'},createdAt:'2026-11-01T00:00:00.000Z',indexing:'noindex',files};
 assert.equal((await call(root+'index.html',html)).status,201);assert.equal((await call(root+'assets/css/shell.css',shell)).status,201);
 const bytes=Buffer.from(JSON.stringify(m));assert.equal((await call(root+'manifest.json',bytes,{'x-manifest-sha256':sha(bytes)})).status,409);
 const ambiguous=Buffer.from(JSON.stringify({...m,core:{name:`@${family}/core`,version:'2.0.0',integrity:p.legacy_registry_integrity}}));
 assert.equal((await call(root+'manifest.json',ambiguous,{'x-manifest-sha256':sha(ambiguous)})).status,400);
 assert.equal((await worker.fetch(new Request(`https://example.invalid/docs/v/${version}/`),env)).status,404);
});

test('a truthful Jekyll Core manifest remains compatible',async()=>{
 const family=JSON.parse(await readFile('scripts/source-shell-provenance.json','utf8')).family,version='9.9.9',tag=`v${version}`,html=Buffer.from('<meta name="robots" content="noindex"><h1>Fixture</h1>');
 const env={FAMILY:family,ARCHIVES:new MockR2(),ARCHIVE_WRITE_TOKEN:token};
 const call=(path,body,extra={})=>worker.fetch(new Request(`https://example.invalid${path}`,{method:'PUT',body,headers:{authorization:`Bearer ${token}`,...extra}}),env);
 const m={schemaVersion:1,family,framework:'jekyll',docsVersion:version,basePath:`/docs/v/${version}/`,implementation:{kind:'git',name:`${family}design/jekyll`,version,tag},source:{repository:`${family}design/jekyll`,commit:'a'.repeat(40),tag},core:{name:`@${family}/core`,version:'2.2.3',integrity:`sha512-${Buffer.alloc(64,1).toString('base64')}`},fixtures:{source:'repository'},toolchain:{ruby:'3.2.3'},createdAt:'2026-11-01T00:00:00.000Z',indexing:'noindex',files:[{path:'index.html',size:html.length,sha256:sha(html)}]};
 validateManifest(m);const root=`/_archive/v/${version}/`;assert.equal((await call(root+'index.html',html)).status,201);
 const bytes=Buffer.from(JSON.stringify(m));assert.equal((await call(root+'manifest.json',bytes,{'x-manifest-sha256':sha(bytes)})).status,201);
});
