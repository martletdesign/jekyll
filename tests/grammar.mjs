import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {spawn,spawnSync} from 'node:child_process';
import {chromium,firefox,webkit} from '@playwright/test';import AxeBuilder from '@axe-core/playwright';
const engineName=process.env.BROWSER||'chromium',engine={chromium,firefox,webkit}[engineName];assert.ok(engine);
const fixtures=JSON.parse(readFileSync('_data/examples.json')).pages.filter(p=>['faq','changelog','dashboard-components'].includes(p.id));
const temp=mkdtempSync(join(tmpdir(),'martlet-grammar-'));let browser,server;
const watchdog=setTimeout(()=>{console.error('Grammar browser overall deadline exceeded');process.exit(1)},240000);
async function bounded(label,operation,ms=30000){console.log(`START ${label}`);let timer;try{return await Promise.race([operation(),new Promise((_,reject)=>timer=setTimeout(()=>reject(Error(`Timed out ${label}`)),ms))])}finally{clearTimeout(timer)}}
try{
 for(const base of ['', '/preview'])assert.equal(spawnSync('python3',['nightjar/build.py','--destination',join(temp,base||'.'),'--baseurl',base],{encoding:'utf8',timeout:120000}).status,0,'Source build');
 server=spawn('python3',['-u','-m','http.server','0','--bind','127.0.0.1','--directory',temp],{stdio:['ignore','pipe','pipe']});
 const port=await bounded('HTTP startup',()=>new Promise((resolve,reject)=>{for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{const m=String(d).match(/port (\d+)/);if(m)resolve(m[1])});server.on('exit',()=>reject(Error('HTTP exited')))}),10000);
 browser=await engine.launch(engineName==='chromium'&&process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
 for(const base of ['', '/preview'])for(const width of [320,768,1440])for(const mode of ['light','dark']){
  const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});context.setDefaultTimeout(10000);context.setDefaultNavigationTimeout(15000);await context.addInitScript(m=>localStorage.setItem('design-appearance',m),mode);const page=await context.newPage();
  for(const record of fixtures){
   const label=`${engineName} ${base||'/'} ${width} ${mode} ${record.id}`;console.log(label);
   assert.equal((await page.goto(`http://127.0.0.1:${port}${base}/examples/${record.id}/`)).status(),200);
   assert.equal(await page.locator('main h1').count(),1);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No horizontal page overflow');
   for(const block of record.sections){assert.equal(await page.locator(`#${block.id}`).textContent().then(t=>t.replace(/\s+/g,' ').trim()),block.title);assert.equal(await page.locator(`a[href="#${block.id}"]`).count(),1,'Stable index destination');if(block.body)assert.equal(await page.locator(`#${block.id}`).locator('..').locator('.example-prose').textContent().then(t=>t.replace(/\s+/g,' ').trim()),block.body.replace(/^### /gm,'').replace(/\s+/g,' ').trim(),'Every fixture body remains complete');}
   if(record.id==='faq'){
    assert.deepEqual(await page.locator('.example-faq summary').allTextContents(),record.sections[0].items.map(i=>i.question));
    assert.deepEqual(await page.locator('.example-faq__answer p').allTextContents(),record.sections[0].items.map(i=>i.answer));
    assert.deepEqual(await page.locator('.example-faq__group > h3').allTextContents(),['About these examples','Using these examples']);
    for(const summary of await page.locator('.example-faq summary').all()){await summary.focus();await page.keyboard.press('Enter');assert.equal(await summary.evaluate(e=>e.parentElement.open),true);await page.keyboard.press('Space');assert.equal(await summary.evaluate(e=>e.parentElement.open),false);}
   }else if(record.id==='changelog'){
    assert.equal(await page.locator('ol.example-release-history > li').count(),3);assert.deepEqual(await page.locator('.example-release time').evaluateAll(es=>es.map(e=>e.dateTime)),['2026-10-28','2026-10-10','2026-09-29']);
   }else assert.equal(await page.locator('.example-component-catalog__entry').count(),4,'Four actual capability entries, no invented component inventory');
   const axe=await bounded(`axe ${label}`,()=>new AxeBuilder({page}).analyze(),45000);assert.deepEqual(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[],label);console.log(JSON.stringify({label,incomplete:axe.incomplete.map(v=>v.id)}));
   if(process.env.GRAMMAR_SCREENSHOT_DIR){mkdirSync(process.env.GRAMMAR_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:join(process.env.GRAMMAR_SCREENSHOT_DIR,`${base?'preview':'root'}-${record.id}-${width}-${mode}.png`),fullPage:true})}
   if(record.id==='faq'){await page.emulateMedia({media:'print'});for(const answer of await page.locator('.example-faq__answer').all())assert.equal(await answer.isVisible(),true,'Print exposes answers without opening or JavaScript');await page.emulateMedia({media:'screen'});}
   await page.emulateMedia({forcedColors:'active'});assert.equal(await page.locator('main h1').isVisible(),true);await page.emulateMedia({forcedColors:'none'});
   if(width===320){await page.addStyleTag({content:'html {font-size:200% !important}'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'200% text reflows');}
  }
  await context.close();
 }
 for(const base of ['', '/preview']){const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:320,height:1000}}),page=await context.newPage();page.setDefaultNavigationTimeout(15000);for(const record of fixtures){await page.goto(`http://127.0.0.1:${port}${base}/examples/${record.id}/`);assert.equal(await page.locator('main h1').isVisible(),true);if(record.id==='faq'){await page.locator('.example-faq summary').first().click();assert.equal(await page.locator('.example-faq__answer').first().isVisible(),true)}}await context.close()}
 console.log(`${engineName} grammar:36 route/viewport/mode cases +6 no-JavaScript passed`);
}finally{try{if(browser)await bounded('browser cleanup',()=>browser.close(),10000)}finally{if(server)server.kill();clearTimeout(watchdog);rmSync(temp,{recursive:true,force:true})}}
