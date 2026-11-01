import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, writeFile, copyFile, rm} from 'node:fs/promises';
import {join, dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn, spawnSync} from 'node:child_process';
import {chromium, firefox, webkit} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const browserName=process.env.BROWSER||'chromium', engine={chromium,firefox,webkit}[browserName];assert.ok(engine);
const tmp=await mkdtemp(join(tmpdir(),'jekyll-version-browser-'));let server,browser;
try {
 const source=join(tmp,'source'),serve=join(tmp,'serve');await mkdir(source);await mkdir(serve);
 for(const entry of JSON.parse(await readFile('nightjar/source-files.json','utf8'))){await mkdir(dirname(join(source,entry)),{recursive:true});await copyFile(entry,join(source,entry));}
 for(const prefix of ['','/preview']){
  const destination=prefix?join(serve,'preview'):serve;
  for(const version of ['1.0.0','1.1.0-rc.1']){
   await writeFile(join(source,'VERSION'),version+'\n');
   const args=['scripts/docs-archive.py','--destination',destination,'--prefix',prefix,'--version',version];
   if(version!=='1.0.0')args.push('--known-version','1.0.0');
   const p=spawnSync('python3',args,{cwd:source,encoding:'utf8'});assert.equal(p.status,0,p.stdout+p.stderr);
  }
 }
 server=spawn('python3',['-u','-m','http.server','0','--bind','127.0.0.1','--directory',serve],{stdio:['ignore','pipe','pipe']});
 const port=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('server timeout')),10000);for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{const m=String(d).match(/port (\d+)/);if(m){clearTimeout(timer);resolve(m[1]);}});server.on('exit',()=>reject(Error('server stopped')));});
 browser=await engine.launch(browserName==='chromium'&&process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
 for(const prefix of ['','/preview'])for(const js of [false,true]){
  const context=await browser.newContext({javaScriptEnabled:js,viewport:{width:320,height:900},reducedMotion:'reduce'});const page=await context.newPage();
  const response=await page.goto(`http://127.0.0.1:${port}${prefix}/docs/v/1.1.0-rc.1/examples/home/`);assert.equal(response.status(),200);
  assert.match(await page.locator('meta[name="robots"]').getAttribute('content'),/noindex/);
  const nav=page.getByRole('navigation',{name:'Documentation versions'});assert.equal(await nav.count(),1);
  const allVersions=nav.getByRole('link',{name:'Browse all documentation versions'});
  assert.equal(await allVersions.getAttribute('href'),`${prefix}/docs/versions/`);
  assert.equal(await nav.getByRole('link',{name:/1\.1\.0-rc\.1/}).getAttribute('aria-current'),'page');
  assert.match(await nav.innerText(),/prerelease/);
  if(js){const axe=await new AxeBuilder({page}).analyze();assert.deepEqual(axe.violations.map(v=>v.id),[]);}
  await allVersions.click();assert.equal(new URL(page.url()).pathname,`${prefix}/docs/versions/`);
  await page.goBack();
  await nav.getByRole('link',{name:'1.0.0',exact:true}).click();assert.equal(new URL(page.url()).pathname,`${prefix}/docs/v/1.0.0/`);
  const dashboard=await page.goto(`http://127.0.0.1:${port}${prefix}/docs/v/1.1.0-rc.1/examples/dashboard-analytics/`);assert.equal(dashboard.status(),200);
  await page.getByRole('navigation',{name:'Documentation versions'}).getByRole('link',{name:'1.0.0',exact:true}).click();
  assert.equal(new URL(page.url()).pathname,`${prefix}/docs/v/1.0.0/`);
  await context.close();console.log(`${browserName} ${prefix||'/'} JavaScript ${js}: historical navigation passed`);
 }
} finally {if(browser)await browser.close();if(server)server.kill();await rm(tmp,{recursive:true,force:true});}
