import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {sha256} from './contract.mjs';
import {createSnapshot} from './snapshot.mjs';

test('a pinned local snapshot is created once, and older archives cannot be replaced or corrupted',async()=>{
  const root=await mkdtemp(join(tmpdir(),'docs-snapshot-'));try{
    const build=join(root,'build'),archives=join(root,'archives');await mkdir(build);await mkdir(archives);
    await writeFile(join(build,'index.html'),'<meta name="robots" content="noindex"><h1>Snapshot</h1>');
    const metadata={schemaVersion:1,family:'martlet',framework:'astro',docsVersion:'2.0.0',basePath:'/docs/v/2.0.0/',implementation:{kind:'npm',name:'@martlet/astro',version:'2.0.0',tag:'v2.0.0'},core:{name:'@martlet/core',version:'2.2.3',integrity:`sha512-${Buffer.alloc(64,1).toString('base64')}`},source:{repository:'martletdesign/astro',commit:'a'.repeat(40),tag:'v2.0.0'},fixtures:{source:'repository'},toolchain:{node:'24.19.0',astro:'7.3.2'},createdAt:'2026-11-01T00:00:00.000Z',indexing:'noindex'};
    const lock={packages:{'node_modules/@martlet/core':{version:metadata.core.version,integrity:metadata.core.integrity}}};
    const baseline={schemaVersion:1,family:'martlet',framework:'astro',latestStable:null,versions:[]},bytes=Buffer.from(JSON.stringify(baseline));
    const args={buildRoot:build,archiveRoot:archives,metadata,coreLock:lock,baselineBytes:bytes,baselineSha256:sha256(bytes)};
    await assert.rejects(createSnapshot({...args,baselineSha256:'f'.repeat(64)}),/Untrusted baseline/);
    await assert.rejects(createSnapshot({...args,coreLock:{packages:{}}}),/Exact core/);
    const first=await createSnapshot(args),manifestBefore=await readFile(join(archives,'2.0.0','manifest.json'));
    assert.equal(first.version,'2.0.0');assert.equal(first.supported,false);
    await assert.rejects(createSnapshot(args),/EEXIST/);
    assert.deepEqual(await readFile(join(archives,'2.0.0','manifest.json')),manifestBefore);
    const previous={...baseline,latestStable:'2.0.0',versions:[{...first,supported:true}]},old=Buffer.from(JSON.stringify(previous));
    const next={...metadata,docsVersion:'2.1.0',basePath:'/docs/v/2.1.0/',implementation:{...metadata.implementation,version:'2.1.0',tag:'v2.1.0'},source:{...metadata.source,tag:'v2.1.0'}};
    await writeFile(join(archives,'2.0.0','index.html'),'tampered');
    await assert.rejects(createSnapshot({...args,metadata:next,baselineBytes:old,baselineSha256:sha256(old)}),/Integrity mismatch/);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('legacy snapshots require the matching historic package lock and shell hash',async()=>{
 const root=await mkdtemp(join(tmpdir(),'legacy-snapshot-'));try{
  const build=join(root,'build'),archives=join(root,'archives');await mkdir(join(build,'assets/css'),{recursive:true});await mkdir(archives);
  await writeFile(join(build,'index.html'),'<meta name="robots" content="noindex"><h1>Snapshot</h1>');const css=Buffer.from('historical shell');await writeFile(join(build,'assets/css/shell.css'),css);
  const legacy={name:'@martlet/theme',version:'2.2.2',integrity:`sha512-${Buffer.alloc(64,1).toString('base64')}`,sourceShellSha256:sha256(css)};
  const metadata={schemaVersion:1,family:'martlet',framework:'jekyll',docsVersion:'1.0.0',basePath:'/docs/v/1.0.0/',implementation:{kind:'git',name:'martletdesign/jekyll',version:'1.0.0',tag:'v1.0.0'},core:null,legacyTheme:legacy,source:{repository:'martletdesign/jekyll',commit:'a'.repeat(40),tag:'v1.0.0'},fixtures:{source:'repository'},toolchain:{ruby:'3.2.3'},createdAt:'2026-11-01T00:00:00.000Z',indexing:'noindex'};
  const base=Buffer.from(JSON.stringify({schemaVersion:1,family:'martlet',framework:'jekyll',latestStable:null,versions:[]}));
  const args={buildRoot:build,archiveRoot:archives,metadata,coreLock:{packages:{'node_modules/@martlet/theme':{version:legacy.version,integrity:legacy.integrity}}},baselineBytes:base,baselineSha256:sha256(base)};
  await assert.rejects(createSnapshot({...args,coreLock:{packages:{}}}),/Exact core or legacy/);
  await assert.rejects(createSnapshot({...args,metadata:{...metadata,legacyTheme:{...legacy,sourceShellSha256:'f'.repeat(64)}}}),/shell digest/);
  assert.equal((await createSnapshot(args)).version,'1.0.0');
 }finally{await rm(root,{recursive:true,force:true});}
});
