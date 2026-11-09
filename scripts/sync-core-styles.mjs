import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'..'),pkg=JSON.parse(await readFile(resolve(root,'package.json'),'utf8'));
const name=Object.keys({...pkg.dependencies,...pkg.devDependencies}).find(name=>/^@(martlet|krigsvold)\/core$/.test(name));
const require=createRequire(resolve(root,'package.json')),source=dirname(require.resolve(`${name}/package.json`));
const core=JSON.parse(await readFile(resolve(source,'package.json'),'utf8'));
const directory=resolve(root,"assets/css");
await mkdir(directory,{recursive:true});
const expected={};
for(const [file,exportName] of Object.entries({'martlet.css':'martlet.css','fonts.css':'reference-fonts.css','shell.css':'reference-shell.css'})){
 const bytes=await readFile(resolve(source,'dist',exportName));
 expected[file]=createHash('sha256').update(bytes).digest('hex');
 if(process.argv.includes('--check')){
  const actual=await readFile(resolve(directory,file));
  if(!actual.equals(bytes))throw new Error(`${file} differs from ${name}@${core.version}; edit Core, then run npm run styles:sync`);
 }else await writeFile(resolve(directory,file),bytes);
}
const unexpected=(await readdir(directory)).filter(file=>file.endsWith('.css')&&!Object.hasOwn(expected,file));
if(unexpected.length)throw new Error(`Local stylesheet definitions are forbidden: ${unexpected.join(', ')}`);
const manifest=JSON.stringify({package:name,version:core.version,source:pkg.dependencies[name],files:expected},null,2)+'\n';
if(process.argv.includes('--check')){
 if(await readFile(resolve(directory,'core-styles.json'),'utf8')!==manifest)throw new Error('Core stylesheet manifest is stale');
}else await writeFile(resolve(directory,'core-styles.json'),manifest);
console.log(`${name}@${core.version}: canonical stylesheet bytes verified`);
