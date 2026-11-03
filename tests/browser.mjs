import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, rmSync, mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {chromium, firefox, webkit} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const watchdog=setTimeout(()=>{console.error('Overall Jekyll browser deadline exceeded');process.exit(1);},480000);
async function bounded(label,operation,ms=20000){console.log(`START ${label}`);let timer;try{return await Promise.race([operation(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(`Timed out: ${label} after ${ms}ms`)),ms);})]);}finally{clearTimeout(timer);console.log(`END ${label}`);}}

const engineName = process.env.BROWSER || 'chromium';
const engine = {chromium, firefox, webkit}[engineName];
assert.ok(engine, 'Unknown browser');
const tmp = mkdtempSync(join(tmpdir(), 'jekyll-browser-'));
let server, browser;
try {
  for (const base of ['', '/preview']) {
    const result = spawnSync('python3', ['nightjar/build.py', '--destination', join(tmp, base || '.'), '--baseurl', base], {stdio:'inherit',timeout:120000});
    assert.equal(result.status, 0, 'Jekyll build failed');
  }
  server = spawn('python3', ['-u', '-m', 'http.server', '0', '--bind', '127.0.0.1', '--directory', tmp], {stdio:['ignore','pipe','pipe']});
  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('server did not start')), 10000);
    server.stdout.on('data', data => { const match = String(data).match(/port (\d+)/); if (match) { clearTimeout(timer); resolve(match[1]); } });
    server.stderr.on('data', data => { const match = String(data).match(/port (\d+)/); if (match) { clearTimeout(timer); resolve(match[1]); } });
    server.on('exit', code => reject(new Error(`server exited ${code}`)));
  });
  browser = await engine.launch(engineName === 'chromium' && process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
  // Opt-in artwork must not alter canonical type, navigation, or plain mastheads.
  for(const base of ['', '/preview']) for(const width of [320,768,1440]) for(const appearance of ['light','dark']) {
    const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});
    context.setDefaultTimeout(10000);context.setDefaultNavigationTimeout(15000);
    await context.addInitScript(mode=>localStorage.setItem('design-appearance',mode),appearance);
    const page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    try {
      await bounded(`${engineName} hero ${base||'/'} ${width} ${appearance}`,()=>page.goto(`http://127.0.0.1:${port}${base}/`,{waitUntil:'load'}));
      const hero=page.locator('.page-intro--illustrated'),art=hero.locator('.page-intro__art');
      assert.equal(await hero.count(),1,'Homepage opts in to approved panorama');
      assert.equal(await art.getAttribute('alt'),'');assert.equal(await art.getAttribute('aria-hidden'),'true');
      assert.equal(await art.getAttribute('width'),'1536');assert.equal(await art.getAttribute('height'),'506');
      assert.equal(await art.getAttribute('fetchpriority'),'high');
      assert.ok((await art.getAttribute('srcset')).includes(`${base}/assets/images/heroes/hero-640.webp 640w`));
      assert.equal(await art.evaluate(img=>img.complete&&img.naturalWidth>0),true,'Approved artwork loads');
      assert.equal(await page.locator('html').getAttribute('data-appearance'),appearance);
      assert.equal(await page.locator('h1').evaluate(el=>getComputedStyle(el).color),'rgb(248, 244, 233)');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Hero does not cause horizontal overflow');
      if(appearance==='dark') {
        assert.equal(await page.locator('.brand').evaluate(el=>getComputedStyle(el).color),'rgb(248, 244, 233)','Dark transparent hero header is legible');
        const menu=page.locator('.menu-button');
        if(await menu.isVisible()) {
          await menu.click();assert.equal(await menu.getAttribute('aria-expanded'),'true');
          assert.equal(await page.locator('.site-header').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(248, 244, 233)','Open menu retains canonical cream panel');
          assert.equal(await page.locator('#site-nav a').first().evaluate(el=>getComputedStyle(el).color),'rgb(11, 28, 51)','Open menu retains canonical ink links');
          await page.keyboard.press('Escape');assert.equal(await menu.getAttribute('aria-expanded'),'false');
          assert.equal(await menu.evaluate(el=>document.activeElement===el),true);
        }
        await page.evaluate(()=>scrollTo(0,400));await page.waitForFunction(()=>document.querySelector('.site-header').classList.contains('is-scrolled'));
        assert.equal(await page.locator('.brand').evaluate(el=>getComputedStyle(el).color),'rgb(11, 28, 51)','Scrolled dark header retains canonical ink');
        await page.evaluate(()=>scrollTo(0,0));await page.waitForFunction(()=>!document.querySelector('.site-header').classList.contains('is-scrolled'));
      }
      const result=await bounded(`${engineName} hero axe ${width} ${appearance}`,()=>new AxeBuilder({page}).analyze());
      assert.deepEqual(result.violations.map(v=>v.id),[],`hero axe ${base} ${width} ${appearance}`);
      console.log(JSON.stringify({hero:true,base,width,appearance,axeIncomplete:result.incomplete.map(v=>v.id),image:await art.evaluate(img=>new URL(img.currentSrc).pathname)}));
      if(process.env.HERO_SCREENSHOT_DIR){mkdirSync(process.env.HERO_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:join(process.env.HERO_SCREENSHOT_DIR,`${engineName}-${base?'preview':'root'}-${width}-${appearance}.png`),fullPage:false})}
      await page.emulateMedia({forcedColors:'active'});
      assert.equal(await art.isVisible(),false,'Forced-colors mode removes decorative photography');
      assert.equal(await page.locator('h1').isVisible(),true);
      await page.emulateMedia({forcedColors:'none'});
      await page.emulateMedia({media:'print'});assert.equal(await art.isVisible(),false);assert.equal(await page.locator('h1').evaluate(el=>getComputedStyle(el).color),'rgb(0, 0, 0)','Printing keeps legible title');await page.emulateMedia({media:'screen'});
      await page.goto(`http://127.0.0.1:${port}${base}/language/`,{waitUntil:'load'});
      assert.equal(await page.locator('.page-intro--illustrated').count(),0,'Plain pages retain source masthead');
      assert.deepEqual(errors,[],'Hero causes no page errors');
    } finally {await context.close()}
  }
  for(const base of ['', '/preview']) {
    const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:320,height:900}}),page=await context.newPage();
    try {
      await page.goto(`http://127.0.0.1:${port}${base}/`,{waitUntil:'load'});
      assert.equal(await page.locator('.page-intro__art').evaluate(img=>img.complete&&img.naturalWidth>0),true,'No-JavaScript panorama loads');
      assert.equal(await page.locator('h1').isVisible(),true);
    } finally {await context.close()}
    const failedContext=await browser.newContext({viewport:{width:320,height:900}});await failedContext.route('**/assets/images/heroes/*.webp',route=>route.abort());
    const failedPage=await failedContext.newPage();
    try {
      await failedPage.goto(`http://127.0.0.1:${port}${base}/`,{waitUntil:'load'});
      assert.equal(await failedPage.locator('.page-intro__art').evaluate(img=>img.naturalWidth),0,'Fault injection blocks the image');
      assert.equal(await failedPage.locator('h1').isVisible(),true,'Image failure preserves title');
      assert.equal(await failedPage.locator('.page-intro--illustrated').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(7, 17, 31)','Image failure retains canonical navy fallback');
    } finally {await failedContext.close()}
  }
  const pages = JSON.parse(readFileSync('_data/examples.json')).pages;
  assert.equal(pages.length, 50);
  for (const base of ['', '/preview']) for (const js of [false, true]) {
    const context = await browser.newContext({javaScriptEnabled:js, viewport:{width:320,height:900}, reducedMotion:'reduce'});
    context.setDefaultTimeout(10000);context.setDefaultNavigationTimeout(15000);
    const page = await context.newPage();
    const pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message));
    for (const item of pages) {
      const response = await bounded(`${engineName} ${base||'/'} js=${js} route=${item.id} navigation`,()=>page.goto(`http://127.0.0.1:${port}${base}/examples/${item.id}/`, {waitUntil:'domcontentloaded'}));
      assert.equal(response.status(), 200, item.id);
      assert.equal(await page.locator('.page-intro--illustrated').count(),0,`${item.id} keeps image-free masthead`);
      assert.equal(await page.locator('main').count(), 1, `${item.id} main`);
      assert.ok(await page.locator('h1').count(), `${item.id} h1`);
      if(js&&item.id.startsWith('dashboard-')){
        for(const width of [1440,320]){
          await bounded(`${engineName} ${base||'/'} route=${item.id} resize=${width}`,()=>page.setViewportSize({width,height:900}));
          await bounded(`${engineName} ${base||'/'} route=${item.id} resize settle`,()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))));
        }
      }
      assert.deepEqual(pageErrors,[],`${item.id} uncaught page errors`);
      if (js && item.id === 'home') {
        const result = await bounded(`${engineName} ${base||'/'} route=${item.id} accessibility`,()=>new AxeBuilder({page}).analyze());
        assert.deepEqual(result.violations.map(v => v.id), [], `axe ${base}/${item.id}`);
      }
    }
    await context.close();
    console.log(`${engineName} ${base || '/'} JavaScript ${js}: 50 canonical pages passed`);
  }
} finally {
  if (browser) await bounded(`${engineName} browser close`,()=>browser.close(),10000);
  if (server) server.kill();
  rmSync(tmp, {recursive:true, force:true});
  clearTimeout(watchdog);
}
