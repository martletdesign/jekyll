import {readFile,readdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const excluded=new Set(['node_modules','dist','_site','.git','.astro','vendor','test-results','playwright-report']);
async function walk(directory){const result=[];for(const entry of await readdir(directory,{withFileTypes:true})){if(excluded.has(entry.name))continue;const path=resolve(directory,entry.name);if(entry.isDirectory())result.push(...await walk(path));else result.push(path);}return result;}
export async function checkSources(directories){
 for(const directory of directories)for(const path of await walk(directory)){
  if(extname(path)==='.css'){const css=await readFile(path,'utf8');if(css.replace(/\/\*[\s\S]*?\*\//g,'').replace(/@import\s+['"]@(martlet|krigsvold)\/core\/[^'"]+['"];?/g,'').trim())throw new Error(`Local CSS definitions are forbidden: ${path}`);continue;}
  if(!['.astro','.html','.md','.js','.mjs','.ts'].includes(extname(path)))continue;
  const source=await readFile(path,'utf8');
  if(/<style\b|\sstyle\s*=|\.style(?:\.|\[)|\.cssText\s*=|createElement\(\s*['"]style['"]|\.insertRule\(|\.replaceSync\(|setAttribute\(\s*['"]style['"]/.test(source))throw new Error(`Inline CSS is forbidden: ${path}`);
 }
}
export async function checkPages(directory){
 let count=0;
 for(const path of await walk(directory)){
  if(extname(path)!=='.html')continue;count++;
  const html=await readFile(path,'utf8');
  if(/<style\b|\sstyle\s*=/i.test(html))throw new Error(`Rendered inline CSS is forbidden: ${path}`);
  const sheets=[...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)].map(match=>match[0]);
  if(sheets.length!==2||!sheets.some(link=>/assets\/css\/martlet\.css/.test(link))||!sheets.some(link=>/assets\/css\/fonts\.css/.test(link)))throw new Error(`Page must use only the two canonical stylesheets: ${path}: ${sheets.join(' ')}`);
 }
 console.log(`Audited ${count} pages: no inline CSS; only canonical stylesheets`);
}

await checkSources(['_layouts','_includes','assets/js','examples']);
