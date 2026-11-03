import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';import {tmpdir} from 'node:os';import {spawn,spawnSync} from 'node:child_process';
import {chromium,firefox,webkit} from '@playwright/test';import AxeBuilder from '@axe-core/playwright';
const name=process.env.BROWSER||'chromium',engine={chromium,firefox,webkit}[name];assert.ok(engine);
const fixture=JSON.parse(readFileSync('_data/dashboards.json')),temp=mkdtempSync(join(tmpdir(),'martlet-workspaces-'));
const deadline=Date.now()+180000;let browser,server;const watchdog=setTimeout(()=>{console.error('Workspaces overall deadline exceeded');process.exit(1)},180000);
async function bounded(label,operation,ms=15000){console.log(`START ${label}`);let timer;try{return await Promise.race([operation(),new Promise((_,reject)=>timer=setTimeout(()=>reject(Error(`Timed out ${label}`)),Math.min(ms,Math.max(1,deadline-Date.now()))))])}finally{clearTimeout(timer)}}
const textNumber=async locator=>Number((await locator.textContent()).replaceAll(',',''));
function parseCSV(csv){
 const rows=[];let row=[],field='',quoted=false;
 for(let i=0;i<csv.length;i++){const c=csv[i];if(c==='"'){if(quoted&&csv[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}else if(!quoted&&c===','){row.push(field);field='';}else if(!quoted&&(c==='\n'||c==='\r')){if(c==='\r'&&csv[i+1]==='\n')i++;row.push(field);rows.push(row);row=[];field='';}else field+=c;}
 assert.equal(quoted,false,'CSV quoting is complete');if(field||row.length){row.push(field);rows.push(row);}return rows;
}
async function analytics(page){
 const rows=fixture.analytics.filter(r=>r.date>='2026-10-22'&&r.date<='2026-10-28'&&r.category==='Research').sort((a,b)=>a.date.localeCompare(b.date));
 await page.locator('#analytics-category').selectOption('Research');await page.getByRole('button',{name:'Apply filters',exact:true}).click();
 assert.equal(await page.locator('#analytics-source tbody tr').count(),rows.length);assert.equal(await textNumber(page.locator('[data-metric="sessions"]')),rows.reduce((n,r)=>n+r.sessions,0));
 const downloadPromise=page.waitForEvent('download',{timeout:15000});await page.locator('[data-export-analytics]').click();const download=await downloadPromise;
 assert.equal(download.suggestedFilename(),'northlight-analytics.csv');const csv=parseCSV(readFileSync(await bounded('CSV download path',()=>download.path()),'utf8'));
 assert.deepEqual(csv,[['Date','Category','Sessions','Downloads','Completed tasks'],...rows.map(r=>[r.date,r.category,r.sessions,r.downloads,r.completions])].map(r=>r.map(String)));
 const previous=await page.locator('#analytics-source tbody').textContent();await page.locator('#analytics-start').fill('2026-10-28');await page.locator('#analytics-end').fill('2026-10-22');await page.getByRole('button',{name:'Apply filters',exact:true}).click();
 assert.equal(await page.locator('#analytics-error').isVisible(),true);assert.equal(await page.locator('#analytics-error').evaluate(e=>e===document.activeElement),true);assert.equal(await page.locator('#analytics-source tbody').textContent(),previous);
 await page.locator('#analytics-start').fill('2026-10-22');await page.locator('#analytics-end').fill('2026-10-28');await page.getByRole('button',{name:'Apply filters',exact:true}).click();assert.equal(await page.locator('#analytics-error').isVisible(),false);
}
async function administration(page){
 const searchName=fixture.people[0].name;await page.locator('#people-query').fill(searchName);await page.getByRole('button',{name:'Apply directory filters',exact:true}).click();assert.equal(new URL(page.url()).searchParams.get('q'),searchName);assert.match(await page.locator('#people-table tbody').textContent(),new RegExp(searchName));
 const selected=page.getByRole('group',{name:'Selected people'});assert.equal(await selected.locator('[data-new-person]').count(),0);assert.equal(await selected.locator('[data-bulk]').count(),2);
 const first=page.locator('[data-select-person]').first();await first.check();const suspend=page.locator('[data-bulk="Suspended"]');await suspend.click();await page.locator('[data-bulk-cancel]').click();await page.waitForFunction(()=>document.activeElement?.matches('[data-bulk="Suspended"]'));
 await suspend.click();await page.locator('[data-bulk-confirm]').click();assert.match(await page.locator('[data-dashboard-status]').textContent(),/Updated 1 selected people locally/);
 await page.locator('[data-edit-person]').first().click();const original=await page.locator('#person-name').inputValue(),email=await page.locator('#person-email').inputValue();await page.locator('#person-name').fill('Retained draft');await page.locator('[data-new-person]').click();assert.equal(await page.locator('#person-name').inputValue(),'Retained draft');assert.match(await page.locator('[data-dashboard-status]').textContent(),/Unsaved changes/);assert.equal(await page.locator('#person-name').evaluate(e=>e===document.activeElement),true);
 await page.locator('[data-discard-person]').click();await page.locator('[data-edit-person]').first().click();await page.locator('#person-name').fill(' ');await page.locator('#person-email').fill('invalid');await page.getByRole('button',{name:'Save person locally',exact:true}).click();assert.equal(await page.locator('#person-errors').isVisible(),true);assert.equal(await page.locator('#person-errors').evaluate(e=>e===document.activeElement),true);assert.equal(await page.locator('#person-name').inputValue(),' ');
 await page.locator('#person-name').fill(original+' Revised');await page.locator('#person-email').fill(email);await page.getByRole('button',{name:'Save person locally',exact:true}).click();assert.match(await page.locator('[data-dashboard-status]').textContent(),/Saved .* locally/);assert.equal(await page.locator('#people-table tbody').getByText(original+' Revised',{exact:true}).count(),1);assert.equal(new URL(page.url()).searchParams.get('q'),searchName,'Saving preserves collection context');
 await page.locator('[data-edit-person]').first().click();await page.locator('#person-name').fill('Retry retains draft');await page.locator('#people-state').selectOption('error');await page.getByRole('button',{name:'Retry directory',exact:true}).click();assert.equal(await page.locator('#person-name').inputValue(),'Retry retains draft');await page.locator('[data-discard-person]').click();await page.locator('[data-clear-people]').click();
}
async function operations(page){
 const previous=await page.locator('#service-table tbody').textContent();await page.locator('#operations-threshold').fill('10');await page.getByRole('button',{name:'Apply monitoring controls',exact:true}).click();assert.equal(await page.locator('#operations-error').isVisible(),true);assert.equal(await page.locator('#operations-error').evaluate(e=>e===document.activeElement),true);assert.equal(await page.locator('#service-table tbody').textContent(),previous);
 await page.locator('#operations-threshold').fill('300');await page.getByRole('button',{name:'Apply monitoring controls',exact:true}).click();const warnings=fixture.services.filter(s=>[...s.samples].sort((a,b)=>a.time.localeCompare(b.time)).at(-1).latency_ms>=300).length;assert.equal(await textNumber(page.locator('[data-metric="warnings"]')),warnings);
 const button=page.locator('[data-acknowledge][aria-label^="Acknowledge "]').first(),id=await button.getAttribute('data-acknowledge');await button.click();await page.waitForFunction(id=>document.activeElement?.dataset.acknowledge===id,id);assert.match(await page.locator(`[data-acknowledge="${id}"]`).textContent(),/Undo acknowledgement/);assert.match(await page.locator('[data-dashboard-status]').textContent(),/acknowledged locally/);
 await page.locator('[data-reset-operations]').click();assert.equal(await page.locator('#operations-threshold').inputValue(),'250');assert.match(await page.locator(`[data-acknowledge="${id}"]`).textContent(),/^Acknowledge$/);assert.equal(await page.getByRole('region',{name:'Service status table',exact:true}).count(),1);
}
async function geometry(page,route){
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Workspace reflows without page overflow');
 if(route==='analytics'){assert.equal(await page.getByRole('group',{name:'Observation period'}).count(),1);for(const id of['analytics-start','analytics-end']){const box=await page.locator('#'+id).boundingBox(),font=await page.locator('#'+id).evaluate(e=>parseFloat(getComputedStyle(e).fontSize));assert.ok(box.width>=font*8,'Native date retains its readable segments');}assert.equal(await page.locator('[aria-label="Analytics summary"]').getAttribute('aria-describedby'),'analytics-source-context');}
 if(route==='administration'){assert.equal(await page.getByRole('group',{name:'Selected people'}).locator('[data-new-person]').count(),0);assert.equal(await page.locator('.dash-directory-commands [data-new-person]').count(),1);}
 if(route==='operations'){assert.equal(await page.locator('label.example-checkbox').evaluate(e=>getComputedStyle(e).flexDirection),'row','Checkbox assistance is beside its control');assert.equal(await page.locator('#service-table').getAttribute('aria-describedby'),'operations-availability threshold-help');}
}
async function print(page,route){
 await page.evaluate(()=>dispatchEvent(new Event('beforeprint')));await page.emulateMedia({media:'print'});assert.equal(await page.locator('main h1').isVisible(),true);const table=route==='analytics'?'#analytics-source':route==='administration'?'#people-table':'#service-table';assert.equal(await page.locator(table).isVisible(),true);
 if(route==='administration')assert.equal(await page.locator('[data-print-people] tr').count(),fixture.people.length);
 await page.emulateMedia({media:'screen'});await page.evaluate(()=>dispatchEvent(new Event('afterprint')));if(route==='administration')assert.equal(await page.locator('[data-print-people]').count(),0);
}
try{
 for(const base of['','/preview']){console.log('BUILD',base||'/');const result=spawnSync('python3',['nightjar/build.py','--destination',join(temp,base||'.'),'--baseurl',base],{encoding:'utf8',timeout:Math.min(120000,Math.max(1,deadline-Date.now()))});assert.equal(result.status,0,result.stderr||result.stdout||'Workspace build');}
 server=spawn('python3',['-u','-m','http.server','0','--bind','127.0.0.1','--directory',temp],{stdio:['ignore','pipe','pipe']});const port=await bounded('HTTP startup',()=>new Promise((resolve,reject)=>{for(const stream of[server.stdout,server.stderr])stream.on('data',d=>{const m=String(d).match(/port (\d+)/);if(m)resolve(m[1])});server.on('exit',()=>reject(Error('HTTP server exited')))}),10000);
 browser=await engine.launch(name==='chromium'&&process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
 for(const base of['','/preview'])for(const width of[320,1440])for(const mode of['light','dark']){
  const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce',acceptDownloads:true});context.setDefaultTimeout(10000);context.setDefaultNavigationTimeout(15000);await context.addInitScript(m=>localStorage.setItem('design-appearance',m),mode);const page=await context.newPage();
  for(const route of['analytics','administration','operations']){const label=`${name} ${base||'/'} ${width} ${mode} ${route}`;console.log('WORKSPACE',label);await page.goto(`http://127.0.0.1:${port}${base}/examples/dashboard-${route}/`);await page.locator('[data-dashboard][data-ready]').waitFor();await geometry(page,route);
   if(width===1440&&mode==='light'){await bounded('Transactions '+label,()=>({analytics,administration,operations}[route](page)),45000);await print(page,route);}
   const axe=await bounded('Axe '+label,()=>new AxeBuilder({page}).analyze(),45000);assert.deepEqual(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[],label);console.log(JSON.stringify({label,incomplete:axe.incomplete.map(v=>v.id)}));
   if(width===1440){await page.addStyleTag({content:'html{font-size:200%!important}'});await geometry(page,route);const enlarged=await bounded('Enlarged axe '+label,()=>new AxeBuilder({page}).analyze(),45000);assert.deepEqual(enlarged.violations.map(v=>v.id),[],label+' 200%');}
   await page.emulateMedia({forcedColors:'active'});assert.equal(await page.locator('main h1').isVisible(),true);await page.emulateMedia({forcedColors:'none'});
  }await bounded('Context cleanup',()=>context.close(),10000);
 }
 for(const base of['','/preview']){const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:320,height:1000}}),page=await context.newPage();page.setDefaultTimeout(10000);page.setDefaultNavigationTimeout(15000);
  for(const route of['analytics','administration','operations']){await page.goto(`http://127.0.0.1:${port}${base}/examples/dashboard-${route}/`);assert.equal(await page.locator('[data-dashboard-controls]').first().locator('input,select,button').first().isDisabled(),true);const table=route==='analytics'?'#analytics-source':route==='administration'?'#people-table':'#service-table';assert.equal(await page.locator(table).isVisible(),true);if(route==='administration')assert.equal(await page.locator('#people-table tbody tr').count(),fixture.people.length);if(route==='operations')assert.equal(await page.getByRole('region',{name:'Service status table',exact:true}).count(),1);}
  await bounded('No-JavaScript context cleanup',()=>context.close(),10000);
 }
 console.log(`${name} workspaces:24 normal +12 desktop200% +6 no-JavaScript cases passed`);
}finally{try{if(browser)await bounded('Browser cleanup',()=>browser.close(),10000)}finally{if(server)server.kill();clearTimeout(watchdog);rmSync(temp,{recursive:true,force:true})}}
