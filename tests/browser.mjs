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
  for(const base of ['', '/preview']) for(const width of [320,375,640,768,1024,1440,1920,3440]) for(const appearance of ['light','dark']) {
    const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});
    context.setDefaultTimeout(10000);context.setDefaultNavigationTimeout(15000);
    await context.addInitScript(mode=>localStorage.setItem('design-appearance',mode),appearance);
    const page=await context.newPage(),errors=[],artRequests=[];
    page.on('request',request=>{if(/martlet-hero-(?:[0-9]+\.webp|master\.png)$/.test(new URL(request.url()).pathname))artRequests.push(request.url())});
    page.on('pageerror',error=>errors.push(error.message));
    try {
      await bounded(`${engineName} hero ${base||'/'} ${width} ${appearance}`,()=>page.goto(`http://127.0.0.1:${port}${base}/`,{waitUntil:'load'}));
      const hero=page.locator('.page-intro--illustrated'),art=hero.locator('.page-intro__art');
      assert.equal(await hero.count(),1,'Homepage opts in to approved panorama');
      assert.equal(await page.locator('.brand').getAttribute('href'),`${base}/`,'Brand remains the root/subpath homepage destination');
      assert.equal(await page.locator(`#site-nav a[href="${base}/"]`).count(),0,'Homepage navigation has no redundant Overview destination');
      assert.equal(await page.locator('#site-nav a[aria-current="page"]').count(),0,'Homepage has no falsely selected inner destination');
      assert.equal(await art.getAttribute('alt'),'');assert.equal(await art.getAttribute('aria-hidden'),'true');
      assert.equal(await art.getAttribute('width'),'2172');assert.equal(await art.getAttribute('height'),'724');
      assert.equal(await art.getAttribute('fetchpriority'),'high');
      for(const variant of [640,960,1440,1920,2172])assert.ok((await art.getAttribute('srcset')).includes(`${base}/assets/images/heroes/martlet-hero-${variant}.webp ${variant}w`));
      assert.equal(artRequests.length,1,'Native srcset loads one image, never the master or duplicate fallback');
      assert.ok(!artRequests.some(url=>url.endsWith('.png')),'Archival master is not a runtime download');
      const box=await art.boundingBox(),header=await page.locator('.site-header').boundingBox(),heading=await page.locator('h1').boundingBox();
      const heroBox=await hero.boundingBox();
      assert.ok(box.y<=header.y+header.height && box.y+box.height>header.y,'Transparent navigation overlays actual panorama pixels at scroll origin');
      const decoded=await art.evaluate(async img=>{await img.decode();return {width:img.naturalWidth,height:img.naturalHeight,src:new URL(img.currentSrc).pathname}});
      assert.ok(decoded.width>0&&decoded.height>0,'Selected responsive image decodes successfully');
      const encodedRatio=decoded.width/decoded.height;
      assert.ok(Math.abs(encodedRatio-3)<.035,`Selected responsive source preserves the approximate 3:1 framing: ${decoded.src} ${decoded.width}x${decoded.height}`);
      if(width<=768){
        assert.ok(Math.abs(box.width/box.height-3)<.01,'Mobile displays the full 3:1 image without distortion');
        assert.equal(await art.evaluate(img=>getComputedStyle(img).objectFit),'contain','Mobile wings and tail remain uncropped');
        assert.ok(heading.y>=box.y+box.height,'Mobile text sits below the complete image');
      }else{
        assert.equal(await art.evaluate(img=>getComputedStyle(img).objectFit),'cover','Desktop artwork covers a content-driven signature hero');
        assert.equal(await art.evaluate(img=>getComputedStyle(img).objectPosition),'100% 50%','Right-aligned focal position protects the martlet');
        assert.ok(Math.abs(box.y-heroBox.y)<=1,'Signature artwork begins at the hero top');
        assert.ok(Math.abs((box.y+box.height)-(heroBox.y+heroBox.height))<=1,'Signature artwork reaches the hero bottom without a solid brown seam');
        assert.ok(Math.abs(box.width-heroBox.width)<=1,'Signature artwork fills the hero width');
        assert.ok(heroBox.height+1>=width/3,'Wide signature retains the full 3:1 source composition unless copy requires more height');
      }
      assert.equal(await art.evaluate(img=>img.complete&&img.naturalWidth>0),true,'Approved artwork loads');
      assert.equal(await page.locator('html').getAttribute('data-appearance'),appearance);
      const footer=page.locator('.site-footer');
      assert.equal(await footer.evaluate(el=>getComputedStyle(el).backgroundColor),
        appearance==='dark'?'rgb(37, 23, 11)':'rgb(7, 17, 31)',
        'The footer uses bronze only in dark mode, retaining source navy in light mode');
      if(appearance==='dark'){
        assert.equal(await footer.locator('h2').first().evaluate(el=>getComputedStyle(el).color),
          'rgb(248, 244, 233)','Footer headings remain cream on bronze');
        assert.equal(await footer.locator('a').first().evaluate(el=>getComputedStyle(el).color),
          'rgb(248, 244, 233)','Footer links remain cream on bronze');
      }
      assert.equal(await page.locator('h1').evaluate(el=>getComputedStyle(el).color),'rgb(248, 244, 233)');
      assert.equal(await hero.locator('p:not(.eyebrow)').first().evaluate(el=>getComputedStyle(el).color),'rgb(248, 244, 233)','Supporting text uses opaque existing cream for measured contrast');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Hero does not cause horizontal overflow');
      const siteHeader=page.locator('.site-header');
      assert.equal(await siteHeader.evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)','Home navigation is transparent over the protected hero field');
      if(appearance==='dark')assert.equal(await page.locator('.brand').evaluate(el=>getComputedStyle(el).color),'rgb(248, 244, 233)','Dark transparent hero header is legible');
      const menu=page.locator('.menu-button');
      if(await menu.isVisible()) {
        await menu.click();assert.equal(await menu.getAttribute('aria-expanded'),'true');
        assert.equal(await siteHeader.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(37, 23, 11)','Open home menu uses the approved burnished brown');
        assert.equal(await page.locator('#site-nav').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(37, 23, 11)','Expanded menu stays opaque and readable');
        const homeLinkColors=await page.locator('#site-nav a').evaluateAll(links=>links.map(link=>getComputedStyle(link).color));
        assert.equal(homeLinkColors.length,4,'Every remaining primary destination is present');
        assert.deepEqual(homeLinkColors,Array(4).fill('rgb(248, 244, 233)'),'All homepage menu links retain legible cream');
        await page.keyboard.press('Escape');assert.equal(await menu.getAttribute('aria-expanded'),'false');
        assert.equal(await menu.evaluate(el=>document.activeElement===el),true);
      }
      await page.evaluate(()=>scrollTo(0,400));await page.waitForFunction(()=>document.querySelector('.site-header').classList.contains('is-scrolled'));
      assert.equal(await siteHeader.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(37, 23, 11)','Scrolled home header uses the approved burnished brown');
      assert.equal(await page.locator('.brand').evaluate(el=>getComputedStyle(el).color),'rgb(248, 244, 233)','Scrolled home header keeps readable cream');
      await page.evaluate(()=>scrollTo(0,0));await page.waitForFunction(()=>!document.querySelector('.site-header').classList.contains('is-scrolled'));
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
      assert.equal(await page.locator('.page-intro--section.page-intro--illustrated').count(),1,'Major language page uses its explicit shorter section tier');
      await page.evaluate(()=>scrollTo(0,400));await page.waitForFunction(()=>document.querySelector('.site-header').classList.contains('is-scrolled'));
      assert.equal(await page.locator('.site-header').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(37, 23, 11)','Section navigation extends the requested warm reference-site composition');
      const innerMenu=page.locator('.menu-button');
      if(await innerMenu.isVisible())await innerMenu.click();
      const currentDestination=page.locator('#site-nav a[aria-current="page"]');
      assert.equal(await currentDestination.count(),1,'An inner page exposes exactly one current destination');
      assert.equal(await currentDestination.getAttribute('href'),`${base}/language/`,'The Language is the actual current inner destination');
      assert.equal(await currentDestination.isVisible(),true,'Current destination is visible in the opened navigation');
      const currentCue=await currentDestination.evaluate(link=>{const cue=getComputedStyle(link,'::after');return {color:cue.backgroundColor,height:parseFloat(cue.height),scale:new DOMMatrixReadOnly(cue.transform).a}});
      assert.equal(currentCue.color,'rgb(230, 199, 125)','Actual inner destination keeps a legible canonical gold cue on the warm composition');
      assert.ok(currentCue.height>0&&Math.abs(currentCue.scale-1)<.001,'Current destination underline is rendered, not collapsed');
      if(await innerMenu.isVisible()) {await page.keyboard.press('Escape');assert.equal(await innerMenu.getAttribute('aria-expanded'),'false');assert.equal(await innerMenu.evaluate(el=>document.activeElement===el),true)}
      const homeUrl=`http://127.0.0.1:${port}${base}/`;
      await Promise.all([page.waitForURL(homeUrl),page.locator('.brand').click()]);
      assert.equal(page.url(),homeUrl,'Brand actually returns to the correct homepage');
      assert.equal(await page.locator('.page-intro--illustrated').count(),1,'Brand navigation restores the approved panoramic home');
      assert.deepEqual(errors,[],'Hero causes no page errors');
    } finally {await context.close()}
  }
  for(const base of ['', '/preview']) {
    const dprContext=await browser.newContext({viewport:{width:375,height:900},deviceScaleFactor:2}),dprPage=await dprContext.newPage(),dprRequests=[];
    dprPage.on('request',request=>{if(/martlet-hero-/.test(new URL(request.url()).pathname))dprRequests.push(request.url())});
    try {
      await dprPage.goto(`http://127.0.0.1:${port}${base}/`,{waitUntil:'load'});
      const chosen=await dprPage.locator('.page-intro__art').evaluate(img=>new URL(img.currentSrc).pathname);
      assert.match(chosen,/martlet-hero-(960|1440|1920|2172)\.webp$/,'High-DPR mobile uses a suitable supplied derivative');
      assert.equal(dprRequests.length,1,'High-DPR does not download duplicate art or the archival PNG');
    } finally {await dprContext.close()}
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
      assert.equal(await failedPage.locator('.page-intro--illustrated').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(31, 20, 11)','Image failure retains contextual warm-ink fallback');
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
