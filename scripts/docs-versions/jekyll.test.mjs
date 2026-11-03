import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {sha256} from './contract.mjs';
import {createSnapshot} from './snapshot.mjs';

// Synthetic fixtures exercise the shared contract; these do not assert an actual core dependency.
for (const family of ['martlet','krigsvold']) test(`${family} Jekyll snapshots preserve history and reject tampering`,async()=>{
 const root=await mkdtemp(join(tmpdir(),'jekyll-docs-contract-'));
 try {
  const build=join(root,'build'),archives=join(root,'archives');await mkdir(build);await mkdir(archives);
  await writeFile(join(build,'index.html'),'<meta name="robots" content="noindex"><h1>Test fixture</h1>');
  const metadata={schemaVersion:1,family,framework:'jekyll',docsVersion:'1.0.0',basePath:'/docs/v/1.0.0/',implementation:{kind:'git',name:`${family}design/jekyll`,version:'1.0.0',tag:'v1.0.0'},core:{name:`@${family}/core`,version:'2.0.0',integrity:`sha512-${Buffer.alloc(64,1).toString('base64')}`},source:{repository:`${family}design/jekyll`,commit:'a'.repeat(40),tag:'v1.0.0'},fixtures:{source:'repository'},toolchain:{ruby:'3.2.3'},createdAt:'2026-11-01T00:00:00.000Z',indexing:'noindex'};
  const coreLock={packages:{[`node_modules/@${family}/core`]:{version:metadata.core.version,integrity:metadata.core.integrity}}};
  const baseline={schemaVersion:1,family,framework:'jekyll',latestStable:null,versions:[]};const bytes=Buffer.from(JSON.stringify(baseline));
  const args={buildRoot:build,archiveRoot:archives,metadata,coreLock,baselineBytes:bytes,baselineSha256:sha256(bytes)};
  await assert.rejects(createSnapshot({...args,coreLock:{packages:{}}}),/Exact core/);
  const first=await createSnapshot(args);const before=await readFile(join(archives,'1.0.0','index.html'));
  await assert.rejects(createSnapshot(args),/EEXIST/);
  const previous=Buffer.from(JSON.stringify({...baseline,latestStable:'1.0.0',versions:[{...first,supported:true}]}));
  const next={...metadata,docsVersion:'1.1.0',basePath:'/docs/v/1.1.0/',implementation:{...metadata.implementation,version:'1.1.0',tag:'v1.1.0'},source:{...metadata.source,tag:'v1.1.0'}};
  await createSnapshot({...args,metadata:next,baselineBytes:previous,baselineSha256:sha256(previous)});
  assert.deepEqual(await readFile(join(archives,'1.0.0','index.html')),before);
  await writeFile(join(archives,'1.0.0','index.html'),'tampered');
  await assert.rejects(createSnapshot({...args,metadata:{...next,docsVersion:'1.2.0'},baselineBytes:previous,baselineSha256:sha256(previous)}),/Integrity mismatch/);
 } finally {await rm(root,{recursive:true,force:true});}
});
