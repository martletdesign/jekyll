import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {chromium,firefox,webkit} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const engineName=process.env.BROWSER||'chromium',engine={chromium,firefox,webkit}[engineName];assert.ok(engine);
const tmp=mkdtempSync(join(tmpdir(),'martlet-identity-'));let browser,server;
const timer=setTimeout(()=>{console.error('Identity browser deadline exceeded');process.exit(1)},360000);
async function bounded(label,operation,ms){
 let timeout;console.log(`START ${label}`);
 try{return await Promise.race([operation(),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error(`Timed out: ${label} after ${ms}ms`)),ms)})])}
 finally{clearTimeout(timeout);console.log(`END ${label}`)}
}

/* Test browser-computed placeholder colors, not merely palette tokens. */
function placeholderContrast(ink,background) {
 const luminance=color=>{
  const values=color.match(/[0-9.]+/g);
  assert.ok(values&&values.length>=3,'Expected RGB computed style: '+color);
  const [r,g,b]=values.slice(0,3).map(Number).map(c=>{
   const v=c/255;return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4;
  });
  return 0.2126*r+0.7152*g+0.0722*b;
 };
 const first=luminance(ink),second=luminance(background);
 return (Math.max(first,second)+0.05)/(Math.min(first,second)+0.05);
}
const routes=[['language/','section'],['examples/','section'],['journal/','section'],['setup/','compact'],['journal/what-a-shell-should-own/','compact'],['404.html','plain'],['examples/dashboard-analytics/','dashboard']];
try {
 for(const base of ['', '/preview'])assert.equal(spawnSync('python3',['nightjar/build.py','--destination',join(tmp,base||'.'),'--baseurl',base],{encoding:'utf8',timeout:120000}).status,0,'Identity build');
 server=spawn('python3',['-u','-m','http.server','0','--bind','127.0.0.1','--directory',tmp],{stdio:['ignore','pipe','pipe']});
 const port=await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('HTTP startup deadline')),10000);for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{const m=String(d).match(/port (\d+)/);if(m){clearTimeout(t);resolve(m[1])}});server.on('exit',()=>reject(Error('HTTP server stopped')))});
 browser=await engine.launch(engineName==='chromium'&&process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
 for(const base of ['', '/preview'])for(const width of [320,375,768,1024,1440,1920,3440])for(const mode of ['light','dark']) {
  const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});context.setDefaultTimeout(10000);context.setDefaultNavigationTimeout(15000);await context.addInitScript(m=>localStorage.setItem('design-appearance',m),mode);
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const [route,variant] of routes){
   console.log(`Identity ${engineName} ${base||'/'} ${width} ${mode} ${route}`);
   const response=await page.goto(`http://127.0.0.1:${port}${base}/${route}`,{waitUntil:'load'});assert.equal(response.status(),200);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Identity viewport reflows');
   assert.equal(await page.locator('main h1').count(),1,'Exactly one primary heading');
   if(variant!=='section')assert.equal(await page.locator('.site-header').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(37, 23, 11)','Plain/application navigation retains warm opaque chrome in either appearance');
   if(variant==='dashboard')assert.equal(await page.locator('.page-intro').count(),0,'Application retains its own restrained heading');
   else {
    const hero=page.locator('.page-intro');assert.equal(await hero.getAttribute('data-hero-variant'),variant);
    assert.equal(await hero.locator('h1').isVisible(),true);
    if(variant==='section'){
     assert.equal(await hero.locator('img').evaluate(img=>img.complete&&img.naturalWidth>0),true,'Distinct local section image loads');
     assert.ok((await hero.locator('img').getAttribute('src')).startsWith(`${base}/assets/images/sections/`));
     const rect=await hero.boundingBox();if(width>=1024)assert.ok(rect.height>=250&&rect.height<=360,`Section height including navigation is restrained (${rect.height})`);if(width>=1024){
       const bar=await page.locator('.site-header').boundingBox(),image=await hero.locator('.page-intro__art').boundingBox(),title=await hero.locator('h1').boundingBox();
       assert.ok(image.y<=bar.y+1 && image.y+image.height>bar.y+bar.height,'Section image extends beneath the transparent header rather than starting below a brown strip');
       assert.ok(title.y>=bar.y+bar.height,'Section title remains clear of fixed navigation');
       assert.equal(await page.locator('.site-header').evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)','Illustrated section navigation is transparent at origin');
       const sectionNavImage=await page.locator('.site-header').evaluate(el=>getComputedStyle(el).backgroundImage);
       assert.equal(sectionNavImage,'none','Section navbar remains transparent instead of making a hard-edged dark rectangle');
       const graduated=await hero.evaluate(el=>getComputedStyle(el,'::after').backgroundImage);
       assert.ok(graduated.includes('linear-gradient'),'Section image carries a graduated warm contrast fade behind navigation');
       assert.ok(Math.abs((image.y+image.height)-(rect.y+rect.height))<=1,'Section photo covers the entire masthead without a flat brown bottom band');

      }
     if(width<=768){const art=await hero.locator('img').boundingBox(),h1=await hero.locator('h1').boundingBox();assert.equal(await hero.locator('img').evaluate(i=>getComputedStyle(i).objectFit),'contain');assert.ok(h1.y>=art.y+art.height,'Mobile section text follows complete image')}
     const credit=page.getByRole('complementary',{name:'Section image credit'});assert.equal(await credit.isVisible(),true);assert.ok(await credit.getByRole('link',{name:/CC BY/}).getAttribute('href'));assert.equal(await credit.getByRole('link',{name:'All image credits and source files'}).getAttribute('href'),`${base}/image-credits/`);
    }else{
      assert.equal(await hero.locator('img').count(),0,'Compact/plain pages have no forced imagery');
      if(variant==='compact' && !page.url().includes('/journal/what-a-shell-should-own/')){
       const navColor=await page.locator('.site-header').evaluate(el=>getComputedStyle(el).backgroundColor);
       const heroColor=await hero.evaluate(el=>getComputedStyle(el).backgroundColor);
       assert.equal(heroColor,navColor,'Compact hero and unscrolled opaque Martlet nav share a continuous warm background');
      }
     }
   }
   assert.equal(await page.locator('.page-intro--signature').count(),0,'Cinematic signature appears only at homepage');
   const menu=page.locator('.menu-button');if(await menu.isVisible()){await menu.focus();await page.keyboard.press('Enter');assert.equal(await menu.getAttribute('aria-expanded'),'true');await page.keyboard.press('Escape');assert.equal(await menu.evaluate(el=>document.activeElement===el),true)}
   const axe=await bounded(`Identity axe ${engineName} ${base||'/'} ${width} ${mode} ${route}`,()=>new AxeBuilder({page}).analyze(),45000);assert.deepEqual(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[],`${route} axe`);console.log(JSON.stringify({route,base,width,mode,incomplete:axe.incomplete.map(v=>v.id)}));
   if(process.env.HERO_SCREENSHOT_DIR&&[375,1440].includes(width)){mkdirSync(process.env.HERO_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:join(process.env.HERO_SCREENSHOT_DIR,`identity-${engineName}-${base?'preview':'root'}-${route.replaceAll('/','_')}-${width}-${mode}.png`)})}
   await page.emulateMedia({forcedColors:'active'});assert.equal(await page.locator('main h1').isVisible(),true);assert.equal(await page.locator('.page-intro img').isVisible(),false,'Forced colors remove decoration');await page.emulateMedia({forcedColors:'none'});
   assert.deepEqual(errors,[],'Identity renders without script errors');
  }
  if(width===1440) {
   const response=await page.goto(`http://127.0.0.1:${port}${base}/examples/search/`,{waitUntil:'load'});
   assert.equal(response.status(),200,'Placeholder contrast reference route exists');
   const input=page.locator('.example-root input[placeholder]').first();
   assert.equal(await input.count(),1,'Example search exposes a placeholder');
   const styles=await input.evaluate(el=>({ink:getComputedStyle(el,'::placeholder').color,
     opacity:getComputedStyle(el,'::placeholder').opacity,background:getComputedStyle(el).backgroundColor}));
   assert.equal(Number(styles.opacity),1,'Placeholder must be fully opaque in '+mode);
   const contrast=placeholderContrast(styles.ink,styles.background);
   assert.ok(contrast>=4.5,`${engineName} ${mode} placeholder must meet 4.5:1 (observed ${contrast.toFixed(2)}:1)`);
  }

  await context.close();
 }
 for(const base of ['', '/preview']) {
  const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:375,height:1000}}),page=await context.newPage();
  for(const [route,variant]of routes){await page.goto(`http://127.0.0.1:${port}${base}/${route}`,{waitUntil:'load'});assert.equal(await page.locator('main h1').isVisible(),true);if(variant==='section')assert.equal(await page.locator('.page-intro img').evaluate(i=>i.complete&&i.naturalWidth>0),true)}
  await context.close();
 }
 console.log(`${engineName} identity: 196 viewport/appearance/routes plus14 no-JavaScript pages passed`);
}finally{
 try{if(browser)await bounded(`Identity ${engineName} browser cleanup`,()=>browser.close(),10000)}
 finally{clearTimeout(timer);if(server)server.kill();rmSync(tmp,{recursive:true,force:true})}
}
