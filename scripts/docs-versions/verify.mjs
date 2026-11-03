import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {validateCatalog,verifyArchive} from './contract.mjs';

// Catalogs and archive directories are local review artifacts. This command
// performs no publishing, pointer changes, or filesystem writes.
const [catalogPath,archiveRoot,previousPath]=process.argv.slice(2);
if(!catalogPath || !archiveRoot) throw Error('Usage: node verify.mjs catalog.json archive-root [previous-catalog.json]');
const catalog=JSON.parse(await readFile(catalogPath,'utf8'));
const previous=previousPath?JSON.parse(await readFile(previousPath,'utf8')):undefined;
validateCatalog(catalog,previous);
for(const entry of catalog.versions){
  const path=join(archiveRoot,entry.version);
  const manifest=JSON.parse(await readFile(join(path,'manifest.json'),'utf8'));
  if(manifest.family!==catalog.family || manifest.framework!==catalog.framework || manifest.docsVersion!==entry.version) throw Error('Catalog and manifest identity differ');
  if(!entry.topics.every(topic=>manifest.files?.some(file=>file.path===topic))) throw Error('Catalog topic missing from snapshot');
  await verifyArchive(path,manifest,entry.manifestSha256);
}
console.log(`Verified ${catalog.versions.length} versioned documentation snapshots`);
