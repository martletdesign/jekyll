import {Miniflare} from 'miniflare';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const sha=b=>createHash('sha256').update(b).digest('hex');
const token='local-test-token-at-least-32-characters';
const tmp=await mkdtemp(join(tmpdir(),'jekyll-r2-runtime-'));let mf;
try {
 const version=(await readFile('VERSION','utf8')).trim(),prefix='/preview',tag=`v${version}`;
 const source=spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8'});assert.equal(source.status,0);const commit=source.stdout.trim();
 const built=spawnSync('python3',['scripts/docs-archive.py','--destination',tmp,'--prefix',prefix,'--version',version],{encoding:'utf8'});assert.equal(built.status,0,built.stdout+built.stderr);
 const dir=join(tmp,'docs','v',version), evidenceBytes=await readFile(join(dir,'nightjar-local-evidence.json'));
 const evidence=JSON.parse(evidenceBytes),family=evidence.family,legacy=evidence.source_shell;
 const files=[...evidence.files,{path:'nightjar-local-evidence.json',size:evidenceBytes.length,sha256:sha(evidenceBytes)}];
 const m={schemaVersion:1,family,framework:'jekyll',docsVersion:version,basePath:`/docs/v/${version}/`,implementation:{kind:'git',name:`${family}design/jekyll`,version,tag},source:{repository:`${family}design/jekyll`,commit,tag},core:null,legacyTheme:{name:legacy.legacy_package,version:legacy.legacy_version,integrity:legacy.legacy_registry_integrity,sourceShellSha256:legacy.sha256},fixtures:{source:'repository'},toolchain:{ruby:'3.2.3'},createdAt:'2026-11-01T00:00:00.000Z',indexing:'noindex',files};
 mf=new Miniflare({modules:true,scriptPath:fileURLToPath(new URL('./worker.mjs',import.meta.url)),compatibilityDate:'2026-08-06',r2Buckets:['ARCHIVES'],bindings:{FAMILY:family,ARCHIVE_WRITE_TOKEN:token,DEPLOY_PREFIX:prefix}});
 const call=(path,method='GET',body,extra={})=>mf.dispatchFetch(`https://example.invalid${prefix}${path}`,{method,body,redirect:'manual',headers:{authorization:`Bearer ${token}`,...extra}});
 // Omit Content-Length and deliver bounded chunks through the real Workers
 // runtime. The server must reject each endpoint before accepting an object.
 for(const [path,chunkSize,count] of [[`/_archive/v/${version}/oversized.bin`,1024*1024,20],['/_archive/catalog',256*1024,6],['/_archive/promotion',32*1024,4]]){
  let produced=0,cancelled=false;
  // Pace the producer so the local Undici bridge can deliver the early 413
  // before its next write races the Workerd body-cancellation socket close.
  // The same total size, chunk sizes, 413 and no-object assertions remain.
  const stream=new ReadableStream({async pull(controller){await new Promise(resolve=>setTimeout(resolve,5));if(cancelled)return;produced++;controller.enqueue(new Uint8Array(chunkSize));if(produced===count)controller.close();},cancel(){cancelled=true;}});
  const response=await mf.dispatchFetch(`https://example.invalid${prefix}${path}`,{method:'PUT',body:stream,duplex:'half',redirect:'manual',headers:{authorization:`Bearer ${token}`}});
  assert.equal(response.status,413,path);
  console.log(`${path}: oversized chunked request rejected (source chunks ${produced}/${count}, cancelled=${cancelled})`);
 }
 assert.equal((await call(`/_archive/v/${version}/oversized.bin`)).status,404,'oversized upload must not create an object');
 const root=`/_archive/v/${version}/`;
 for(const file of files){const bytes=await readFile(join(dir,file.path));assert.equal((await call(root+file.path,'PUT',bytes)).status,201,file.path);}
 const manifest=Buffer.from(JSON.stringify(m));assert.equal((await call(root+'manifest.json','PUT',manifest,{'x-manifest-sha256':sha(manifest)})).status,201);
 assert.equal((await call(root+'index.html','PUT',Buffer.from('replacement'))).status,409);
 const first={schemaVersion:1,family,framework:'jekyll',previousSha256:null,latestStable:null,versions:[{version,channel:version.includes('-')?'prerelease':'stable',manifestSha256:sha(manifest),supported:false,topics:files.filter(x=>x.path.endsWith('.html')).map(x=>x.path)}]},catalog=Buffer.from(JSON.stringify(first));
 assert.equal((await call('/_archive/catalog','PUT',catalog,{'x-previous-catalog-sha256':'none'})).status,201);
 assert.equal(sha(Buffer.from(await (await call('/docs/catalog.json')).arrayBuffer())),sha(catalog));
 const index=await call('/docs/versions/');assert.equal(index.status,200);assert.match(index.headers.get('content-type'),/text\/html/);
 const indexHtml=await index.text();assert.ok(indexHtml.includes(`href="${prefix}/docs/v/${version}/"`));if(version.includes('-'))assert.match(indexHtml,/prerelease/);else assert.doesNotMatch(indexHtml,/prerelease/);assert.match(indexHtml,/unsupported/);
 const rewritten=Buffer.from(JSON.stringify({...first,previousSha256:sha(catalog),versions:[{...first.versions[0],manifestSha256:'f'.repeat(64)}]}));
 assert.equal((await call('/_archive/catalog','PUT',rewritten,{'x-previous-catalog-sha256':sha(catalog)})).status,409);
 const promotion=Buffer.from(JSON.stringify({schemaVersion:1,family,framework:'jekyll',previousSha256:null,catalogSha256:sha(catalog),version,operation:'promote',reason:''}));
 assert.notEqual((await call('/_archive/promotion','PUT',promotion,{'x-previous-promotion-sha256':'none'})).status,201);
 for(const file of files){const r=await call(`/docs/v/${version}/${file.path}`);assert.equal(r.status,200,file.path);const bytes=Buffer.from(await r.arrayBuffer());assert.equal(bytes.length,file.size);assert.equal(sha(bytes),file.sha256,file.path);}
 console.log(`${family}: ${files.length} real snapshot files round-tripped through local Miniflare R2 under /preview`);
} finally {if(mf)await mf.dispose();await rm(tmp,{recursive:true,force:true});}
