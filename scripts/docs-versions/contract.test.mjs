import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,symlink,rename} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {sha256,parseVersion,validateManifest,createManifest,verifyArchive,validateCatalog,versionTopicURL,versionNavigationModel} from './contract.mjs';

async function snapshot(root,family,framework,version='2.1.0'){
  const dir=join(root,`${family}-${framework}-${version}`);await mkdir(dir,{recursive:true});
  const contents=Buffer.from('<!doctype html><meta name="robots" content="noindex, follow"><h1>Archived</h1>');
  await writeFile(join(dir,'index.html'),contents);
  const manifest={schemaVersion:1,family,framework,docsVersion:version,basePath:`/docs/v/${version}/`,implementation:{kind:framework==='jekyll'?'git':'npm',name:framework==='jekyll'?`${family}design/jekyll`:`@${family}/${framework}`,version,tag:`v${version}`},core:{name:`@${family}/core`,version:'1.4.0',integrity:`sha512-${Buffer.alloc(64,1).toString('base64')}`},source:{repository:`${family}design/${framework}`,commit:'a'.repeat(40),tag:`v${version}`},fixtures:{workbenchCommit:'b'.repeat(40)},toolchain:framework==='jekyll'?{ruby:'3.3.1',bundler:'2.5.6'}:{node:'24.19.0'},createdAt:'2026-11-01T00:00:00.000Z',indexing:'noindex',files:[{path:'index.html',size:contents.length,sha256:sha256(contents)}]};
  const bytes=Buffer.from(JSON.stringify(manifest,null,2)+'\n');await writeFile(join(dir,'manifest.json'),bytes);
  return {dir,manifest,hash:sha256(bytes)};
}
test('both languages and all three framework identities verify independent framework and core versions',async()=>{
  const root=await mkdtemp(join(tmpdir(),'docs-contract-'));try{
    for(const family of ['martlet','krigsvold'])for(const framework of ['astro','react','jekyll']){
      const s=await snapshot(root,family,framework);assert.equal(s.manifest.core.version,'1.4.0');
      assert.equal(await verifyArchive(s.dir,s.manifest,s.hash),true);
    }
  }finally{await rm(root,{recursive:true,force:true});}
});
test('tampering, unlisted files, malformed paths and invalid identities fail closed',async()=>{
  const root=await mkdtemp(join(tmpdir(),'docs-contract-'));try{
    const s=await snapshot(root,'martlet','astro');
    assert.throws(()=>validateManifest({...s.manifest,files:[{...s.manifest.files[0],path:'../escape'}]}));
    assert.throws(()=>validateManifest({...s.manifest,implementation:{...s.manifest.implementation,version:'1.4.0'}}));
    assert.throws(()=>validateManifest({...s.manifest,core:{...s.manifest.core,integrity:'sha512-fake'}}));
    assert.throws(()=>validateManifest({...s.manifest,toolchain:{node:'latest'}}));
    assert.throws(()=>validateManifest({...s.manifest,fixtures:{source:'workbench'}}));
    assert.doesNotThrow(()=>validateManifest({...s.manifest,fixtures:{source:'repository'}}));
    await assert.rejects(verifyArchive(s.dir,s.manifest,'f'.repeat(64)));
    await writeFile(join(s.dir,'other.js'),'unlisted');await assert.rejects(verifyArchive(s.dir,s.manifest,s.hash));await rm(join(s.dir,'other.js'));
    await symlink('index.html',join(s.dir,'link'));await assert.rejects(verifyArchive(s.dir,s.manifest,s.hash));await rm(join(s.dir,'link'));
    await writeFile(join(s.dir,'index.html'),'tampered');await assert.rejects(verifyArchive(s.dir,s.manifest,s.hash));
  }finally{await rm(root,{recursive:true,force:true});}
});
test('catalog keeps prior snapshots immutable and preserves topics with fallback',()=>{
  const old={schemaVersion:1,family:'martlet',framework:'react',latestStable:'1.0.0',versions:[{version:'1.0.0',channel:'stable',manifestSha256:'a'.repeat(64),supported:true,topics:['forms/index.html']}]};
  const next={...old,latestStable:'2.0.0',versions:[...old.versions,{version:'2.0.0',channel:'stable',manifestSha256:'b'.repeat(64),supported:true,topics:['forms/index.html']},{version:'3.0.0-rc.1',channel:'prerelease',manifestSha256:'c'.repeat(64),supported:false,topics:[]}]};
  assert.equal(validateCatalog(next,old),next);
  assert.equal(versionTopicURL(next,'2.0.0','forms/index.html'),'/docs/v/2.0.0/forms/index.html');
  assert.equal(versionTopicURL(next,'1.0.0','removed/index.html'),'/docs/v/1.0.0/');
  assert.equal(versionTopicURL(next,'2.0.0','forms/index.html','/preview/'),'/preview/docs/v/2.0.0/forms/index.html');
  assert.equal(versionTopicURL(next,'1.0.0','missing.html','/preview'),'/preview/docs/v/1.0.0/');
  assert.throws(()=>versionTopicURL(next,'2.0.0','forms/index.html','//evil.example/'));
  const navigation=versionNavigationModel(next,'1.0.0','forms/index.html','/preview');
  assert.equal(navigation[0].active,true);assert.equal(navigation[1].latestStable,true);assert.equal(navigation[2].channel,'prerelease');
  assert.throws(()=>validateCatalog({...next,versions:next.versions.slice(1)},old));
  assert.throws(()=>validateCatalog({...next,versions:[{...old.versions[0],manifestSha256:'f'.repeat(64)},...next.versions.slice(1)]},old));
  assert.throws(()=>validateCatalog({...next,latestStable:'3.0.0-rc.1'}));
  assert.throws(()=>versionTopicURL(next,'99.0.0','forms/index.html'));
  for(const v of ['01.0.0','1.0','1.2.3-rc.01','1.2.3+build'])assert.throws(()=>parseVersion(v));
});
test('CLI verifies a complete catalog and rejects links to missing topics',async()=>{
  const root=await mkdtemp(join(tmpdir(),'docs-catalog-'));try{
    const s=await snapshot(root,'krigsvold','jekyll');const archives=join(root,'archives');await mkdir(archives);await rename(s.dir,join(archives,'2.1.0'));
    const catalog={schemaVersion:1,family:'krigsvold',framework:'jekyll',latestStable:'2.1.0',versions:[{version:'2.1.0',channel:'stable',manifestSha256:s.hash,supported:true,topics:['index.html']}]};
    const file=join(root,'catalog.json');await writeFile(file,JSON.stringify(catalog));
    const run=()=>spawnSync(process.execPath,['scripts/docs-versions/verify.mjs',file,archives],{encoding:'utf8'});
    assert.equal(run().status,0);
    catalog.versions[0].topics=['missing.html'];await writeFile(file,JSON.stringify(catalog));assert.notEqual(run().status,0);
  }finally{await rm(root,{recursive:true,force:true});}
});
test('archived HTML must declare noindex even when its digest is correct',async()=>{
  const root=await mkdtemp(join(tmpdir(),'docs-indexing-'));try{
    const s=await snapshot(root,'martlet','astro');const html=Buffer.from('<!doctype html><h1>No robots policy</h1>');
    s.manifest.files[0]={path:'index.html',size:html.length,sha256:sha256(html)};
    await writeFile(join(s.dir,'index.html'),html);const bytes=Buffer.from(JSON.stringify(s.manifest,null,2)+'\n');await writeFile(join(s.dir,'manifest.json'),bytes);
    await assert.rejects(verifyArchive(s.dir,s.manifest,sha256(bytes)),/Missing archive noindex/);
  }finally{await rm(root,{recursive:true,force:true});}
});
test('snapshot manifest generation hashes all content and refuses an existing manifest',async()=>{
  const root=await mkdtemp(join(tmpdir(),'docs-generate-'));try{
    const s=await snapshot(root,'krigsvold','react');
    await assert.rejects(createManifest(s.dir,s.manifest),/Refusing to overwrite/);
    await rm(join(s.dir,'manifest.json'));
    const generated=await createManifest(s.dir,s.manifest);assert.deepEqual(generated,s.manifest);
    const bytes=Buffer.from(JSON.stringify(generated,null,2)+'\n');await writeFile(join(s.dir,'manifest.json'),bytes);
    assert.equal(await verifyArchive(s.dir,generated,sha256(bytes)),true);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('legacy Jekyll manifests bind historical theme identity to exact archived shell bytes',async()=>{
  const root=await mkdtemp(join(tmpdir(),'legacy-jekyll-contract-'));try{
    for(const family of ['martlet','krigsvold']){
      const s=await snapshot(root,family,'jekyll');const css=Buffer.from(`/* ${family} historical shell */`);
      await mkdir(join(s.dir,'assets/css'),{recursive:true});await writeFile(join(s.dir,'assets/css/shell.css'),css);
      const legacy={name:`@${family}/theme`,version:'2.2.2',integrity:`sha512-${Buffer.alloc(64,2).toString('base64')}`,sourceShellSha256:sha256(css)};
      const m={...s.manifest,core:null,legacyTheme:legacy,files:[...s.manifest.files,{path:'assets/css/shell.css',size:css.length,sha256:sha256(css)}]};
      const bytes=Buffer.from(JSON.stringify(m,null,2)+'\n');await writeFile(join(s.dir,'manifest.json'),bytes);
      assert.equal(await verifyArchive(s.dir,m,sha256(bytes)),true);
      assert.throws(()=>validateManifest({...m,framework:'astro'}));
      assert.throws(()=>validateManifest({...m,core:{name:`@${family}/core`,version:'2.2.3',integrity:legacy.integrity}}),/ambiguous/);
      assert.throws(()=>validateManifest({...m,legacyTheme:{...legacy,name:`@${family}/core`}}));
      assert.throws(()=>validateManifest({...m,legacyTheme:{...legacy,integrity:'fake'}}));
      assert.throws(()=>validateManifest({...m,legacyTheme:{...legacy,sourceShellSha256:'f'.repeat(64)}}),/shell digest/);
      await writeFile(join(s.dir,'assets/css/shell.css'),'tampered');await assert.rejects(verifyArchive(s.dir,m,sha256(bytes)));
    }
  }finally{await rm(root,{recursive:true,force:true});}
});

test('prerelease-only catalogs have no stable promotion target',()=>{
 const c={schemaVersion:1,family:'martlet',framework:'jekyll',latestStable:null,versions:[{version:'0.1.0-rc.1',channel:'prerelease',manifestSha256:'a'.repeat(64),supported:false,topics:['index.html']}]};
 assert.equal(validateCatalog(c),c);assert.equal(versionNavigationModel(c,'0.1.0-rc.1','index.html')[0].latestStable,false);
 assert.throws(()=>validateCatalog({...c,latestStable:'0.1.0-rc.1'}));
 assert.throws(()=>validateCatalog({...c,latestStable:undefined}));
});
