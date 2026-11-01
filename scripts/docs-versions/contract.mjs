import {createHash} from 'node:crypto';
import {readdir,readFile,lstat} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {isDeepStrictEqual} from 'node:util';

const versionPattern=/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
function need(condition,message){if(!condition)throw Error(message);}
export function parseVersion(value){
  const m=typeof value==='string'&&versionPattern.exec(value);
  need(m && !(m[4]&&m[4].split('.').some(x=>/^\d+$/.test(x)&&x.length>1&&x[0]==='0')),'Invalid documentation version');
  return {version:value,channel:m[4]?'prerelease':'stable'};
}
function validPath(path){return typeof path==='string' && /^[A-Za-z0-9._~/-]+$/.test(path) && !path.startsWith('/') && path.split('/').every(x=>x && x!=='.' && x!=='..');}
function validDigest(value){return typeof value==='string' && /^[a-f0-9]{64}$/.test(value);}
export function validateManifest(m){
  need(m?.schemaVersion===1 && ['martlet','krigsvold'].includes(m.family) && ['astro','react','jekyll'].includes(m.framework),'Invalid snapshot identity');
  parseVersion(m.docsVersion);need(m.basePath===`/docs/v/${m.docsVersion}/`,'Invalid immutable base path');
  need(m.implementation?.version===m.docsVersion && m.implementation?.tag===`v${m.docsVersion}`,'Implementation version or tag mismatch');
  if(m.framework==='jekyll') need(m.implementation.kind==='git' && m.implementation.name===`${m.family}design/jekyll`,'Invalid Jekyll authority');
  else need(m.implementation?.kind==='npm' && m.implementation.name===`@${m.family}/${m.framework}`,'Invalid npm implementation');
  need(m.core?.name===`@${m.family}/core`,'Invalid core identity');parseVersion(m.core?.version);
  need(typeof m.core.integrity==='string' && /^sha512-[A-Za-z0-9+/]{86}==$/.test(m.core.integrity),'Invalid core integrity');
  need(m.source?.repository===`${m.family}design/${m.framework}` && /^[a-f0-9]{40}$/.test(m.source?.commit??'') && m.source.tag===m.implementation.tag,'Invalid source provenance');
  need((m.fixtures?.source==='repository' && m.fixtures.workbenchCommit===undefined) || ((m.fixtures?.source===undefined || m.fixtures.source==='workbench') && /^[a-f0-9]{40}$/.test(m.fixtures?.workbenchCommit??'')),'Unpinned or ambiguous fixtures');
  need(m.toolchain && typeof m.toolchain==='object' && !Array.isArray(m.toolchain) && Object.keys(m.toolchain).length>0 && Object.values(m.toolchain).every(x=>typeof x==='string'&&/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(x)),'Missing or unpinned build toolchain');
  need(typeof m.toolchain[m.framework==='jekyll'?'ruby':'node']==='string','Missing framework runtime');
  need(typeof m.createdAt==='string' && !Number.isNaN(Date.parse(m.createdAt)) && new Date(m.createdAt).toISOString()===m.createdAt,'Invalid snapshot timestamp');
  need(m.indexing==='noindex','Archives must be noindex');
  need(Array.isArray(m.files)&&m.files.length>0,'Missing archive inventory');
  const names=new Set();for(const file of m.files){need(validPath(file.path)&&file.path!=='manifest.json'&&!names.has(file.path)&&Number.isSafeInteger(file.size)&&file.size>=0&&validDigest(file.sha256),'Invalid archive entry');names.add(file.path);}
  need(names.has('index.html'),'Archive must include an index');
  return m;
}

async function listRegularFiles(root,dir=''){
  const files=[];for(const entry of await readdir(join(root,dir),{withFileTypes:true})){
    const relative=dir?`${dir}/${entry.name}`:entry.name, absolute=join(root,relative),stat=await lstat(absolute);
    need(!stat.isSymbolicLink(),'Symlinks are not allowed in immutable archives');
    if(stat.isDirectory())files.push(...await listRegularFiles(root,relative));
    else {need(stat.isFile(),'Only regular files are allowed');files.push(relative);}
  }return files;
}
function requireNoindex(path,bytes){
  if(!path.endsWith('.html'))return;
  const tags=bytes.toString('utf8').match(/<meta\b[^>]*>/gi)??[];
  need(tags.some(t=>/\bname\s*=\s*["']robots["']/i.test(t)&&/\bcontent\s*=\s*["'][^"']*\bnoindex\b/i.test(t)),`Missing archive noindex: ${path}`);
}
export async function createManifest(root,metadata){
  const absolute=resolve(root),stat=await lstat(absolute);need(stat.isDirectory()&&!stat.isSymbolicLink(),'Archive root must be a real directory');
  const paths=(await listRegularFiles(absolute)).sort();need(!paths.includes('manifest.json'),'Refusing to overwrite an existing snapshot manifest');
  const files=[];for(const path of paths){
    need(validPath(path),'Invalid archive path');const bytes=await readFile(join(absolute,path));requireNoindex(path,bytes);
    files.push({path,size:bytes.length,sha256:sha256(bytes)});
  }
  return validateManifest({...metadata,files});
}
export async function verifyArchive(root,manifest,expectedManifestSha256){
  validateManifest(manifest);const absolute=resolve(root);need((await lstat(absolute)).isDirectory() && !(await lstat(absolute)).isSymbolicLink(),'Archive root must be a real directory');
  const disk=(await listRegularFiles(absolute)).sort(),listed=[...manifest.files.map(x=>x.path),'manifest.json'].sort();
  need(JSON.stringify(disk)===JSON.stringify(listed),'Archive contents differ from manifest');
  const manifestBytes=await readFile(join(absolute,'manifest.json'));need(validDigest(expectedManifestSha256)&&sha256(manifestBytes)===expectedManifestSha256,'Manifest integrity mismatch');
  need(isDeepStrictEqual(JSON.parse(manifestBytes.toString('utf8')),manifest),'Manifest content mismatch');
  for(const entry of manifest.files){
    const path=resolve(absolute,entry.path);need(path.startsWith(absolute+sep),'Archive path escapes root');
    const bytes=await readFile(path);need(bytes.length===entry.size && sha256(bytes)===entry.sha256,`Integrity mismatch: ${entry.path}`);
    requireNoindex(entry.path,bytes);
  }return true;
}

export function validateCatalog(catalog,previous){
  need(catalog?.schemaVersion===1 && ['martlet','krigsvold'].includes(catalog.family) && ['astro','react','jekyll'].includes(catalog.framework) && Array.isArray(catalog.versions),'Invalid catalog');
  const seen=new Set();for(const entry of catalog.versions){
    const parsed=parseVersion(entry.version);need(!seen.has(entry.version)&&parsed.channel===entry.channel&&validDigest(entry.manifestSha256)&&typeof entry.supported==='boolean','Invalid catalog entry');seen.add(entry.version);
    need(Array.isArray(entry.topics)&&entry.topics.every(validPath)&&new Set(entry.topics).size===entry.topics.length,'Invalid topic list');
  }
  const latest=catalog.versions.find(x=>x.version===catalog.latestStable);need(latest?.channel==='stable'&&latest.supported,'Latest must be a supported stable release');
  const compare=(a,b)=>{const x=a.split('.').map(BigInt),y=b.split('.').map(BigInt);for(let i=0;i<3;i++)if(x[i]!==y[i])return x[i]>y[i]?1:-1;return 0;};
  need(catalog.versions.filter(x=>x.channel==='stable'&&x.supported).every(x=>compare(latest.version,x.version)>=0),'Latest does not identify the newest supported stable release');
  if(previous){
    need(previous.family===catalog.family&&previous.framework===catalog.framework,'Catalog authority changed');
    for(const old of previous.versions){const now=catalog.versions.find(x=>x.version===old.version);need(now&&now.manifestSha256===old.manifestSha256&&now.channel===old.channel&&isDeepStrictEqual(now.topics,old.topics),'Historical snapshot removed or rewritten');}
  }return catalog;
}
export function versionTopicURL(catalog,version,topic,basePath='/'){
  validateCatalog(catalog);const entry=catalog.versions.find(x=>x.version===version);need(entry,'Unknown documentation version');
  need(typeof basePath==='string'&&basePath.startsWith('/')&&!basePath.startsWith('//')&&(basePath==='/'||validPath(basePath.replace(/^\//,'').replace(/\/$/,''))),'Invalid deployment base path');
  const path=validPath(topic)&&entry.topics.includes(topic)?topic:'';
  const prefix=basePath==='/'?'':basePath.replace(/\/$/,'');
  return `${prefix}/docs/v/${entry.version}/${path}`;
}
// Framework adapters render this neutral model with their own accessible UI.
export function versionNavigationModel(catalog,activeVersion,topic,basePath='/'){
  validateCatalog(catalog);need(catalog.versions.some(x=>x.version===activeVersion),'Unknown active documentation version');
  return catalog.versions.map(x=>({version:x.version,channel:x.channel,supported:x.supported,active:x.version===activeVersion,latestStable:x.version===catalog.latestStable,href:versionTopicURL(catalog,x.version,topic,basePath)}));
}
export {sha256};
