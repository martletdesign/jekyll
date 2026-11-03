import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
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
  const pages = JSON.parse(readFileSync('_data/examples.json')).pages;
  assert.equal(pages.length, 50);
  for (const base of ['', '/preview']) for (const js of [false, true]) {
    const context = await browser.newContext({javaScriptEnabled:js, viewport:{width:320,height:900}, reducedMotion:'reduce'});
    context.setDefaultTimeout(10000);context.setDefaultNavigationTimeout(15000);
    const page = await context.newPage();
    for (const item of pages) {
      const response = await bounded(`${engineName} ${base||'/'} js=${js} route=${item.id} navigation`,()=>page.goto(`http://127.0.0.1:${port}${base}/examples/${item.id}/`, {waitUntil:'domcontentloaded'}));
      assert.equal(response.status(), 200, item.id);
      assert.equal(await page.locator('main').count(), 1, `${item.id} main`);
      assert.ok(await page.locator('h1').count(), `${item.id} h1`);
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
