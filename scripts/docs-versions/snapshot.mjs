import {cp,lstat,mkdir,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createManifest,parseVersion,sha256,validateCatalog,verifyArchive} from './contract.mjs';

// Builds a local candidate only. The caller is responsible for authenticated,
// immutable storage and for advancing the live latest pointer separately.
export async function createSnapshot({buildRoot,archiveRoot,metadata,coreLock,baselineBytes,baselineSha256}) {
  if(!Buffer.isBuffer(baselineBytes)||sha256(baselineBytes)!==baselineSha256)throw Error('Untrusted baseline catalog');
  const baseline=JSON.parse(baselineBytes.toString('utf8'));
  if(baseline?.schemaVersion!==1||baseline.family!==metadata.family||baseline.framework!==metadata.framework||!Array.isArray(baseline.versions))throw Error('Baseline authority mismatch');
  if(baseline.versions.length)validateCatalog(baseline);
  else if(baseline.latestStable!==null)throw Error('Empty baseline must not name a latest release');
  for(const old of baseline.versions){
    const dir=join(archiveRoot,old.version),manifest=JSON.parse(await readFile(join(dir,'manifest.json'),'utf8'));
    if(manifest.family!==baseline.family||manifest.framework!==baseline.framework||manifest.docsVersion!==old.version)throw Error('Historical snapshot identity mismatch');
    await verifyArchive(dir,manifest,old.manifestSha256);
  }
  if(baseline.versions.some(x=>x.version===metadata.docsVersion))throw Error('Version already exists in baseline');
  parseVersion(metadata.docsVersion);
  const dependency=metadata.core===null?metadata.legacyTheme:metadata.core;
  const locked=coreLock?.packages?.[`node_modules/${dependency?.name}`];
  if(locked?.version!==dependency?.version||locked?.integrity!==dependency?.integrity)throw Error('Exact core or legacy design package and integrity do not match build lock');
  const destination=join(archiveRoot,metadata.docsVersion);
  await mkdir(destination); // Atomic no-clobber reservation; existing snapshots are never replaced.
  try {
    const sourceStat=await lstat(buildRoot);if(!sourceStat.isDirectory()||sourceStat.isSymbolicLink())throw Error('Build root must be a real directory');
    for(const name of await readdir(buildRoot))await cp(join(buildRoot,name),join(destination,name),{recursive:true,errorOnExist:true,force:false,verbatimSymlinks:true});
    const manifest=await createManifest(destination,metadata);
    const bytes=Buffer.from(JSON.stringify(manifest,null,2)+'\n');
    await writeFile(join(destination,'manifest.json'),bytes,{flag:'wx'});
    const manifestSha256=sha256(bytes);await verifyArchive(destination,manifest,manifestSha256);
    return {version:metadata.docsVersion,channel:parseVersion(metadata.docsVersion).channel,manifestSha256,supported:false,topics:manifest.files.filter(x=>x.path.endsWith('.html')).map(x=>x.path)};
  } catch(error) {await rm(destination,{recursive:true,force:true});throw error;}
}
