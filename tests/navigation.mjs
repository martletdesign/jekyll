import assert from 'node:assert/strict';
import {chromium,firefox,webkit} from '@playwright/test';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import http from 'node:http';
import path from 'node:path';

const engineName=process.env.BROWSER||'chromium',engine={chromium,firefox,webkit}[engineName];assert.ok(engine,'Unknown browser');
const started=Date.now(),ownedBuild=process.argv[2]?null:await mkdtemp(path.join(tmpdir(),'martlet-navigation-build-'));
const build=path.resolve(process.argv[2]||ownedBuild),evidence=process.env.NAVIGATION_EVIDENCE_DIR||await mkdtemp(path.join(tmpdir(),'martlet-navigation-evidence-'));
await mkdir(evidence,{recursive:true});
const bounded=async(label,fn,ms=15000)=>{let timer;try{return await Promise.race([fn(),new Promise((_,reject)=>timer=setTimeout(()=>reject(Error(label+' timed out')),ms))])}finally{clearTimeout(timer)}};
const report={engine:engineName,build,cases:[],startedAt:new Date().toISOString()};let server,browser;
const deadline=setTimeout(()=>{console.error('Navigation overall 180s deadline exceeded');process.exit(1)},180000);
try {
 if(ownedBuild)assert.equal(spawnSync('python3',['nightjar/build.py','--destination',build],{stdio:'inherit',timeout:120000}).status,0,'Locked standalone navigation build');
 server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://local'),file=path.join(build,u.pathname+(u.pathname.endsWith('/')?'index.html':''));res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.woff':'font/woff','.woff2':'font/woff2','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404);res.end();}});
 await bounded('navigation server startup',()=>new Promise(resolve=>server.listen(0,'127.0.0.1',resolve)),10000);
 browser=await bounded('navigation browser launch',()=>engine.launch(engineName==='chromium'&&process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),30000);
 for(const width of[320,768,1440,1920])for(const mode of['light','dark'])for(const route of['','examples/search/','examples/dashboard-administration/'])for(const scale of[1,2])for(const javaScriptEnabled of[true,false]) {
  if(scale===2&&width===1920)continue;
  if(!javaScriptEnabled&&(route!==''||width===1920))continue;
  console.log('NAVIGATION',engineName,width,mode,route||'home',scale,javaScriptEnabled);
  const context=await browser.newContext({javaScriptEnabled,viewport:{width,height:1100},reducedMotion:'reduce'});context.setDefaultTimeout(12000);context.setDefaultNavigationTimeout(20000);
  await context.addInitScript(m=>localStorage.setItem('design-appearance',m),mode);
  try {
   const page=await context.newPage();await page.goto(`http://127.0.0.1:${server.address().port}/${route}`,{waitUntil:'networkidle'});
   // Firefox may never settle this JavaScript API in a JS-disabled context.
   // Native no-JS load, painted glyphs, geometry and visible fallback stay tested.
   if(javaScriptEnabled)await bounded('navigation font readiness',()=>page.evaluate(()=>document.fonts.ready.then(()=>true)),15000);
   else await page.evaluate(m=>document.documentElement.dataset.appearance=m,mode);
   if(scale===2)await page.evaluate(()=>document.documentElement.style.fontSize='200%');
   const data=await page.evaluate(()=>{
    const nodes=[...document.querySelectorAll('.site-header .brand,.site-header .menu-button,.site-header .nav-link,.site-header .appearance-toggle')].filter(n=>n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden');
    const rect=n=>{const range=document.createRange();range.selectNodeContents(n);const b=range.getBoundingClientRect();return{x:b.x,y:b.y,width:b.width,height:b.height,right:b.right,bottom:b.bottom}};
    const items=nodes.map(n=>({text:n.textContent.trim(),...rect(n)})),overlaps=[];
    for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){const a=items[i],b=items[j];if(Math.min(a.right,b.right)-Math.max(a.x,b.x)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>1)overlaps.push([a.text,b.text]);}
    const brand=document.querySelector('.brand'),collapse=document.querySelector('#site-nav'),nav=document.querySelector('.site-header');
    return{items,overlaps,rootFont:getComputedStyle(document.documentElement).fontSize,contentTop:Math.min(...[...document.querySelectorAll('main .eyebrow,main h1')].filter(n=>n.getClientRects().length).map(n=>n.getBoundingClientRect().top)),headingTop:document.querySelector('main h1')?.getBoundingClientRect().top,navBottom:nav.getBoundingClientRect().bottom,overflow:document.documentElement.scrollWidth>innerWidth,brand:{flex:getComputedStyle(brand).flex,width:brand.getBoundingClientRect().width,scrollWidth:brand.scrollWidth,whiteSpace:getComputedStyle(brand).whiteSpace},navbar:{flexWrap:getComputedStyle(nav.querySelector('.header-inner')).flexWrap},collapse:{flex:getComputedStyle(collapse).flex,display:getComputedStyle(collapse).display},toggleVisible:!!document.querySelector('.menu-button').getClientRects().length};
   });
   assert.equal(data.overflow,false);if(data.headingTop!==undefined)assert.ok(data.contentTop>=data.navBottom-1,'Closed navigation must clear the first masthead text and heading');assert.deepEqual(data.overlaps,[]);assert.ok(data.brand.scrollWidth<=data.brand.width+2,'Painted brand must fit its allocated width');
   let keyboard=null;
   if(javaScriptEnabled&&data.toggleVisible){const toggle=page.locator('.menu-button');await toggle.focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('.menu-button').getAttribute('aria-expanded')==='true');assert.equal(await page.locator('#site-nav .nav-link').first().isVisible(),true);await page.keyboard.press('Escape');assert.equal(await toggle.getAttribute('aria-expanded'),'false');assert.equal(await toggle.evaluate(n=>n===document.activeElement),true);keyboard='Enter open / Escape close and focus return PASS';}
   if(!javaScriptEnabled){assert.equal(await page.locator('.menu-button').isVisible(),false);assert.equal(await page.locator('#site-nav .nav-link').first().isVisible(),true);}
   const label=`navigation-${engineName}-${route?route.replaceAll('/','_'):'home'}-${width}-${mode}-x${scale}${javaScriptEnabled?'':'-nojs'}`;
   await bounded('navigation screenshot',()=>page.screenshot({path:path.join(evidence,label+'.png')}),15000);
   report.cases.push({width,mode,route,scale,javaScriptEnabled,keyboard,...data});
  }finally{await bounded('navigation context cleanup',()=>context.close(),10000);}
 }
 assert.equal(report.cases.length,54,'All navigation states, including narrow text resizing, are retained');report.status='passed';
}catch(error){report.error=String(error.stack);process.exitCode=1;}
finally {
 clearTimeout(deadline);
 try{if(browser)await bounded('navigation browser cleanup',()=>browser.close(),10000);}finally{if(server){server.closeAllConnections();await bounded('navigation server cleanup',()=>new Promise(resolve=>server.close(resolve)),5000);}if(ownedBuild)await rm(ownedBuild,{recursive:true,force:true});report.finishedAt=new Date().toISOString();report.durationMilliseconds=Date.now()-started;await writeFile(path.join(evidence,'navigation.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({engine:engineName,status:report.status,cases:report.cases.length,durationMilliseconds:report.durationMilliseconds,error:report.error}));}
}
