import {analyticsView,collectionView,personControlLabels,validatePerson,nextPersonId,applyBulk,operationsView,dayMillis,comparisonSearch,analyticsCoverageMessage,analyticsComparison} from './dashboard-model.mjs';
import {element,tableRows,metric,chart,downloadCSV} from './dashboard-ui.mjs';
const root=document.querySelector('[data-dashboard]');
const fixture=JSON.parse(document.getElementById('dashboard-data').textContent);
const params=new URL(location.href).searchParams;
const status=root.querySelector('[data-dashboard-status]');
const navToggle=root.querySelector('.dash-nav-toggle'),nav=root.querySelector('#dashboard-nav');
navToggle.addEventListener('click',()=>navToggle.setAttribute('aria-expanded',String(navToggle.getAttribute('aria-expanded')!=='true')));
root.querySelector('.dash-sidebar').addEventListener('keydown',event=>{if(event.key==='Escape'){navToggle.setAttribute('aria-expanded','false');navToggle.focus();}});
navToggle.hidden=false;root.dataset.ready='true';
function updateURL(values,tolerateFailure=false){const url=new URL(location.href);for(const[key,value]of Object.entries(values))value===null?url.searchParams.delete(key):url.searchParams.set(key,String(value));try{history.replaceState(history.state,'',url);}catch(error){if(!tolerateFailure)throw error;return false;}const peer=root.querySelector('[data-compare]');const compare=new URL(peer.href);compare.search=comparisonSearch(root.dataset.dashboard,url.search);peer.href=compare.href;return true;}
const number=value=>new Intl.NumberFormat('en-US').format(value);
function analytics(){
  const fallback=root.querySelector('[data-dashboard-fallback]');if(!fallback)return;
  const form=root.querySelector('#analytics-filters');const start=form.elements.start,end=form.elements.end,category=form.elements.category,range=form.elements.range;const coverage={start:start.min,end:end.max};
  start.value=params.get('start')||start.value;end.value=params.get('end')||end.value;const requestedCategory=params.has('categoryId')?params.get('categoryId'):(params.get('category')==='All'?'':params.get('category')||'');if(fixture.categories.includes(requestedCategory))category.value=requestedCategory;
  if(params.has('start')||params.has('end'))range.value='custom';
  let view,initializing=true;
  range.addEventListener('change',()=>{if(range.value!=='custom'){end.value='2026-10-28';start.value=new Date(Date.parse(end.value)-(Number(range.value)-1)*dayMillis).toISOString().slice(0,10);}});
  [start,end].forEach(input=>input.addEventListener('input',()=>{range.value='custom';}));
  const render=()=>{
    const candidate=analyticsView(fixture,{start:start.value,end:end.value,category:category.value||'All',categoryId:category.value==='All'?'All':null,coverage});const error=root.querySelector('#analytics-error');
    error.hidden=!candidate.error;error.textContent=candidate.error;start.setAttribute('aria-invalid',String(!!candidate.error&&!candidate.dataError));end.setAttribute('aria-invalid',String(!!candidate.error&&!candidate.dataError));for(const field of [start,end]){if(candidate.error&&!candidate.dataError)field.setAttribute('aria-describedby','analytics-error');else field.removeAttribute('aria-describedby');}
    root.querySelector('[data-export-analytics]').disabled=!!candidate.error;
    if(candidate.error){status.textContent=candidate.dataError?(view?'Analytics data is unavailable for this range. The previous valid results remain visible.':candidate.error):(view?'Invalid filters. The previous valid results remain visible.':'Invalid filters. No valid results are available.');if(candidate.dataError)status.setAttribute('data-analytics-data-error','');else status.removeAttribute('data-analytics-data-error');error.tabIndex=-1;error.focus();return;}
    status.removeAttribute('data-analytics-data-error');if(!updateURL({start:start.value,end:end.value,category:category.value||'All',categoryId:category.value==='All'?'All':null},!initializing)){root.querySelector('[data-export-analytics]').disabled=!view||!view.rows.length;status.textContent=view?'The address could not be updated. Previous results remain visible; your filters are retained. Try again.':'The address could not be updated. No results are available; your filters are retained. Try again.';return;}view=candidate;
    const hasRows=view.rows.length>0;root.querySelector('[data-export-analytics]').disabled=!hasRows;
    metric(root,'sessions',hasRows?number(view.totals.sessions):'Unavailable',analyticsComparison(view,'sessions'));metric(root,'downloads',hasRows?number(view.totals.downloads):'Unavailable',analyticsComparison(view,'downloads'));
    metric(root,'conversion',view.totals.conversion===null?'Unavailable':view.totals.conversion.toFixed(1)+'%',view.totals.conversion===null?'Unavailable without sessions.':'Completed tasks ÷ sessions.');metric(root,'mean_duration',view.totals.mean_duration===null?'Unavailable':Math.round(view.totals.mean_duration)+' s',view.totals.mean_duration===null?'Unavailable without sessions.':'Weighted by session count.');
    chart(root,'sessions',view.days.map(day=>({label:day.date,value:day.sessions})),{label:'Sessions'});
    chart(root,'downloads',view.days.map(day=>({label:day.date,value:day.downloads})),{label:'Downloads'});
    chart(root,'categories',view.categories.filter(row=>view.rows.some(item=>item.category===row.name)).map(row=>({label:row.name,value:row.sessions,previous:view.previousCategories?.find(item=>item.name===row.name)?.sessions??null})),{label:'Sessions by category',bars:true,previous:true});
    tableRows(root.querySelector('#analytics-source'),view.rows.map(row=>[row.date,row.category,row.sessions,row.downloads,row.completions]),['Date','Category','Sessions','Downloads','Completed tasks']);
    status.textContent=`${view.days.length} days · category: ${category.value||'All categories'} · ${view.rows.length} source records · ${start.value} to ${end.value}. ${analyticsCoverageMessage(view)}`.trim();
  };
  form.addEventListener('submit',event=>{event.preventDefault();render();});
  root.querySelector('[data-export-analytics]').addEventListener('click',()=>{if(view)downloadCSV('northlight-analytics.csv',[['Date','Category','Sessions','Downloads','Completed tasks'],...view.rows.map(row=>[row.date,row.category,row.sessions,row.downloads,row.completions])]);});
  render();initializing=false;
  form.querySelector('fieldset').disabled=false;fallback.hidden=true;
}
if(root.dataset.dashboard==='analytics' && root.querySelector('#analytics-filters'))analytics();
function administration(){
  const fallback=root.querySelector('[data-dashboard-fallback]');if(!fallback)return;
  let records=structuredClone(fixture.people),selected=new Set(),editing=null,pending=null,returnFocus=null;
  const filters=root.querySelector('#people-filters'),editor=root.querySelector('#person-editor');
  const state={query:params.get('q')||'',status:['Active','Invited','Suspended'].includes(params.get('status'))?params.get('status'):'All',sort:['name','email','role','status'].includes(params.get('sort'))?params.get('sort'):'name',direction:params.get('direction')==='desc'?'desc':'asc',page:Number(params.get('page'))||1,size:[5,10,20].includes(Number(params.get('size')))?Number(params.get('size')):5};
  filters.elements.query.value=state.query;filters.elements.status.value=state.status;filters.elements.size.value=String(state.size);
  if(['comfortable','compact'].includes(params.get('density')))filters.elements.density.value=params.get('density');
  const table=root.querySelector('#people-table'),body=table.tBodies[0],selectPage=root.querySelector('[data-select-page]');
  const dialog=root.querySelector('[data-bulk-dialog]');
  const buttonClass=root.querySelector('[data-new-person]').className;
  let current,saving=false,initializing=true;
  const addressWarning=element('p','',{role:'status'});status.after(addressWarning);
  const syncAddress=()=>{const updated=updateURL({q:state.query,status:state.status,sort:state.sort,direction:state.direction,page:state.page,size:state.size,density:filters.elements.density.value},!initializing);addressWarning.textContent=updated?'':'The address could not be updated. Local changes remain available; try applying the filters again.';};
  const editorFields=['name','email','role','status'];const editorValues=()=>Object.fromEntries(editorFields.map(name=>[name,editor.elements[name].value]));let editorBaseline=editorValues();
  const editorDirty=()=>editorFields.some(name=>editor.elements[name].value!==editorBaseline[name]);
  const allowEditorChange=()=>{if(!editorDirty())return true;status.textContent='Unsaved changes. Save or discard this draft before changing the editor.';editor.elements.name.focus();return false;};
  const clearErrors=()=>{root.querySelector('#person-errors').hidden=true;for(const name of ['name','email','role','status']){editor.elements[name].removeAttribute('aria-invalid');editor.elements[name].removeAttribute('aria-describedby');root.querySelector(`#person-${name}-error`).hidden=true;}};
  const resetEditor=()=>{editing=null;editor.reset();editorBaseline=editorValues();clearErrors();root.querySelector('[data-editor-legend]').textContent='Add a person';};
  const updateSelection=()=>{
    root.querySelector('[data-selection-count]').textContent=`${selected.size} people selected across result pages. Changing filters clears selection.`;
    root.querySelectorAll('[data-bulk]').forEach(button=>button.disabled=!selected.size||filters.elements.state.value!=='ready');
    const count=current.rows.filter(person=>selected.has(person.id)).length;
    selectPage.checked=!!count&&count===current.rows.length;selectPage.indeterminate=count>0&&count<current.rows.length;
  };
  const render=()=>{
    current=collectionView(records,state);state.page=current.page;const mode=filters.elements.state.value;
    syncAddress();
    const message=root.querySelector('[data-directory-state]'),region=root.querySelector('[data-directory-region]');
    const ready=mode==='ready';const empty=ready&&!current.total||mode==='empty';
    region.hidden=!ready||empty;region.setAttribute('aria-busy',String(mode==='loading'));
    message.hidden=ready&&!empty;message.replaceChildren();
    message.removeAttribute('role');
    if(mode==='loading'){message.setAttribute('role','status');message.textContent='Loading state preview: synthetic directory controls are temporarily unavailable.';}
    else if(mode==='error'){message.setAttribute('role','alert');message.append(element('p','Error state preview: the directory could not be refreshed. Your filters and draft are retained.'));const retry=element('button','Retry directory',{type:'button',class:buttonClass});retry.addEventListener('click',()=>{filters.elements.state.value='ready';render();status.textContent='Directory restored. Filters and draft retained.';});message.append(retry);}
    else if(empty)message.textContent='No people match this view. Clear the filters or return the state preview to Ready.';
    root.querySelector('[data-new-person]').disabled=!ready;
    selectPage.disabled=!ready||empty;
    table.querySelectorAll('[data-sort]').forEach(button=>{button.disabled=!ready;button.closest('th').setAttribute('aria-sort',state.sort===button.dataset.sort?(state.direction==='asc'?'ascending':'descending'):'none');});
    body.replaceChildren();
    const controlLabels=personControlLabels(records);
    for(const person of current.rows){
      const controlLabel=controlLabels.get(person.id);
      const row=body.insertRow();row.dataset.person=person.id;
      const check=element('input',undefined,{type:'checkbox',class:'dash-row-check','aria-label':`Select ${controlLabel}`});check.checked=selected.has(person.id);check.dataset.selectPerson=person.id;row.insertCell().append(check);
      row.append(element('th',person.name,{scope:'row'}));row.insertCell().textContent=person.email;row.insertCell().textContent=person.role;
      row.insertCell().append(element('span',person.status,{class:`dash-badge dash-badge--${person.status.toLowerCase()}`}));
      const edit=element('button','Edit',{type:'button',class:buttonClass,'aria-label':`Edit ${controlLabel}`});edit.dataset.editPerson=person.id;row.insertCell().append(edit);
    }
    root.querySelector('[data-people-page]').textContent=`Page ${current.page} of ${current.pages}`;
    root.querySelector('[data-people-previous]').disabled=!ready||empty||current.page===1;
    root.querySelector('[data-people-next]').disabled=!ready||empty||current.page===current.pages;
    root.querySelector('[data-directory-region]').dataset.density=filters.elements.density.value;
    status.textContent=`${empty?0:current.total} matching people · Page ${current.page} of ${current.pages} · ${records.length} total synthetic records.`;
    updateSelection();
    editor.querySelector('fieldset').disabled=!ready;
  };
  filters.addEventListener('submit',event=>{event.preventDefault();state.query=filters.elements.query.value.trim();state.status=filters.elements.status.value;state.size=Number(filters.elements.size.value);state.page=1;selected.clear();render();});
  filters.elements.state.addEventListener('change',()=>{selected.clear();render();});
  filters.elements.density.addEventListener('change',()=>{root.querySelector('[data-directory-region]').dataset.density=filters.elements.density.value;syncAddress();});
  root.querySelector('[data-clear-people]').addEventListener('click',()=>{filters.reset();Object.assign(state,{query:'',status:'All',page:1,size:5});selected.clear();render();});
  root.querySelectorAll('[data-sort]').forEach(button=>button.addEventListener('click',()=>{state.direction=state.sort===button.dataset.sort&&state.direction==='asc'?'desc':'asc';state.sort=button.dataset.sort;state.page=1;render();}));
  for(const[selector,step]of [['[data-people-previous]',-1],['[data-people-next]',1]])root.querySelector(selector).addEventListener('click',()=>{state.page+=step;render();const next=root.querySelector(selector);if(next.disabled)root.querySelector(step===1?'[data-people-previous]':'[data-people-next]').focus();});
  body.addEventListener('change',event=>{const id=event.target.dataset.selectPerson;if(!id)return;event.target.checked?selected.add(id):selected.delete(id);updateSelection();});
  selectPage.addEventListener('change',()=>{current.rows.forEach(person=>selectPage.checked?selected.add(person.id):selected.delete(person.id));body.querySelectorAll('[data-select-person]').forEach(input=>input.checked=selected.has(input.dataset.selectPerson));updateSelection();});
  body.addEventListener('click',event=>{const id=event.target.closest('[data-edit-person]')?.dataset.editPerson;if(!id)return;if(editing===id){editor.elements.name.focus();return;}if(!allowEditorChange())return;const person=records.find(item=>item.id===id);editing=id;clearErrors();for(const field of editorFields)editor.elements[field].value=person[field];editorBaseline=editorValues();root.querySelector('[data-editor-legend]').textContent=`Edit ${person.name} (${person.id})`;status.textContent=`Editing ${person.name} (${person.id}).`;editor.elements.name.focus();});
  root.querySelector('[data-new-person]').addEventListener('click',()=>{if(!allowEditorChange())return;resetEditor();status.textContent='Adding a person.';editor.elements.name.focus();});
  root.querySelector('[data-discard-person]').addEventListener('click',()=>{resetEditor();status.textContent='Draft discarded. Directory records are unchanged.';});
  editor.addEventListener('submit',event=>{
    event.preventDefault();if(saving)return;const draft=Object.fromEntries(['name','email','role','status'].map(name=>[name,editor.elements[name].value.trim()]));const errors=validatePerson(draft,records,editing);clearErrors();
    if(Object.keys(errors).length){const summary=root.querySelector('#person-errors');summary.hidden=false;summary.replaceChildren(element('p','Review the fields below. Your draft has been retained.'));const list=element('ul');for(const[name,message]of Object.entries(errors)){const li=element('li');const link=element('a',message,{href:`#person-${name}`});link.addEventListener('click',event=>{event.preventDefault();editor.elements[name].focus();});li.append(link);list.append(li);const input=editor.elements[name];input.setAttribute('aria-invalid','true');input.setAttribute('aria-describedby',`person-${name}-error`);const hint=root.querySelector(`#person-${name}-error`);hint.hidden=false;hint.textContent=message;}summary.append(list);summary.tabIndex=-1;summary.focus();return;}
    saving=true;queueMicrotask(()=>{saving=false;});
    const id=editing||nextPersonId(records);
    records=editing?records.map(person=>person.id===editing?{id,...draft}:person):[...records,{id,...draft}];selected.clear();resetEditor();render();status.textContent=`Saved ${draft.name} (${id}) locally. Reload restores the original fixture.`;
  });
  root.querySelectorAll('[data-bulk]').forEach(button=>button.addEventListener('click',()=>{if(editing&&selected.has(editing)&&editorDirty()){status.textContent='Unsaved changes. Save or discard this draft before changing this person in bulk.';editor.elements.name.focus();return;}pending={ids:[...selected],status:button.dataset.bulk};returnFocus=button;root.querySelector('[data-bulk-description]').textContent=`Set ${pending.ids.length} selected people to ${pending.status}: ${records.filter(person=>selected.has(person.id)).map(person=>person.name).join(', ')}.`;dialog.showModal();root.querySelector('[data-bulk-cancel]').focus();}));
  root.querySelector('[data-bulk-cancel]').addEventListener('click',()=>dialog.close());
  root.querySelector('[data-bulk-confirm]').addEventListener('click',()=>{if(!pending)return;records=applyBulk(records,pending.ids,pending.status);if(editing&&pending.ids.includes(editing)){editor.elements.status.value=pending.status;editorBaseline.status=pending.status;}const count=pending.ids.length;selected.clear();dialog.close();render();status.textContent=`Updated ${count} selected people locally. No unselected records were changed.`;});
  dialog.addEventListener('close',()=>{if(dialog.open)return;pending=null;if(returnFocus&&!returnFocus.disabled)returnFocus.focus();else selectPage.focus();});
  // Preserve the interactive rows and focus while printing the applied result set.
  let prePrintStatus=null;
  window.addEventListener('beforeprint',()=>{
    if(filters.elements.state.value!=='ready'||!current.total)return;
    if(prePrintStatus===null)prePrintStatus=status.textContent;status.textContent=`${current.total} matching people · All matching records shown for print · ${records.length} total synthetic records.`;
    table.querySelector('[data-print-people]')?.remove();
    const printBody=element('tbody',undefined,{'data-print-people':''});
    for(const person of current.filtered){
      const row=printBody.insertRow();row.insertCell().textContent='—';row.append(element('th',person.name,{scope:'row'}));
      for(const value of [person.email,person.role,person.status,person.id])row.insertCell().textContent=value;
    }
    table.append(printBody);table.dataset.printAll='true';
  });
  window.addEventListener('afterprint',()=>{table.querySelector('[data-print-people]')?.remove();delete table.dataset.printAll;if(prePrintStatus!==null){status.textContent=prePrintStatus;prePrintStatus=null;}});
  render();initializing=false;
  filters.querySelector('fieldset').disabled=false;fallback.hidden=true;
}
if(root.dataset.dashboard==='administration')administration();
function operations(){
  const fallback=root.querySelector('[data-dashboard-fallback]');if(!fallback)return;
  const form=root.querySelector('#operations-filters');let alerts=structuredClone(fixture.alerts),localEvents=[];
  const requestedService=params.has('serviceId')?params.get('serviceId'):(params.get('service')==='All'?'':params.get('service')||'');
  const initial={hours:params.get('hours')||'6',threshold:params.get('threshold')||'250',service:requestedService,severity:params.get('severity')||'All'};
  for(const[name,value]of Object.entries(initial)){if(name==='threshold'||[...form.elements[name].options].some(option=>option.value===value))form.elements[name].value=value;}
  form.elements.hideAcknowledged.checked=params.get('hideAcknowledged')==='true';
  const defaultState={hours:6,threshold:250,service:'All',serviceId:null,severity:'All',hideAcknowledged:false};
  let state={...defaultState},initializing=true,urlError=false;
  const historyWarning=()=>urlError?' The address could not be updated. Previous results and local changes remain available; try again.':'';
  const buttonClass=root.querySelector('[data-reset-operations]').className;
  const render=(useApplied=false,updateAddress=true)=>{
    const error=root.querySelector('#operations-error');
    if(!useApplied){
      const threshold=Number(form.elements.threshold.value);
      if(!Number.isInteger(threshold)||threshold<50||threshold>1000){error.hidden=false;error.textContent='Enter a whole-number warning threshold from 50 to 1000 ms. Previous valid results remain visible.';form.elements.threshold.setAttribute('aria-invalid','true');form.elements.threshold.setAttribute('aria-describedby','threshold-help operations-error');error.tabIndex=-1;error.focus();return;}
      error.hidden=true;form.elements.threshold.removeAttribute('aria-invalid');form.elements.threshold.setAttribute('aria-describedby','threshold-help');
      const candidate={hours:Number(form.elements.hours.value),threshold,service:form.elements.service.value||'All',serviceId:form.elements.service.value==='All'?'All':null,severity:form.elements.severity.value,hideAcknowledged:form.elements.hideAcknowledged.checked};
      if(updateAddress&&!updateURL(candidate,!initializing)){urlError=true;status.textContent=historyWarning().trim();return;}
      if(updateAddress)urlError=false;state=candidate;
    }
    const {threshold}=state;
    const view=operationsView(fixture,state,alerts);
    root.querySelector('[data-sample-coverage]').textContent=view.partial?'Partial sample coverage: the trend shows only times with observations from every selected service. Latest service readings may have different times.':'';
    metric(root,'warnings',String(view.warnings),`Latest service latency ≥ ${threshold} ms.`);
    metric(root,'latency',view.latency+' ms',view.staggered?'Mean of latest samples; sample times differ.':'Mean of latest samples in scope.');
    metric(root,'open_alerts',String(view.open),'All severities in the selected service scope.');
    metric(root,'queue',String(view.queue),'Sum of latest queues in scope.');
    chart(root,'latency',view.points.map(point=>({label:point.time.slice(11,16)+' UTC',value:point.latency_ms})),{label:'Mean latency (ms)',threshold});
    const services=root.querySelector('#service-table');tableRows(services,view.services.map(service=>[service.name,service.latest.time,service.warning?'Warning':'Healthy',service.latest.latency_ms,service.latest.queue,service.latest.availability]),['Service','Latest sample (UTC)','Status','Latency (ms)','Queue','Sample availability (%)']);
    [...services.tBodies[0].rows].forEach((row,index)=>{const value=view.services[index].warning?'Warning':'Healthy';row.cells[2].replaceChildren(element('span',value,{class:'dash-badge dash-badge--'+value.toLowerCase()}));});
    root.querySelector('[data-availability]').textContent=view.availability===null?'No availability samples in this monitoring window.':`Minimum sampled availability in this ${state.hours}-hour scope: ${view.availability.toFixed(1)}%. Synthetic sample values, not a live SLA measurement.`;
    const alertTable=root.querySelector('#alert-table'),body=alertTable.tBodies[0];body.replaceChildren();
    for(const alert of view.alerts){const row=body.insertRow();row.append(element('th',`${alert.id} · ${alert.title}`,{scope:'row'}));row.insertCell().textContent=fixture.services.find(service=>service.id===alert.service_id).name;row.insertCell().append(element('span',alert.severity,{class:'dash-badge dash-badge--'+alert.severity.toLowerCase()}));row.insertCell().textContent=alert.time.slice(0,16).replace('T',' ')+' UTC';row.insertCell().textContent=alert.acknowledged?'Acknowledged':'Unacknowledged';const button=element('button',alert.acknowledged?'Undo acknowledgement':'Acknowledge',{class:buttonClass,type:'button','aria-label':`${alert.acknowledged?'Undo acknowledgement':'Acknowledge'} ${alert.id}`});button.dataset.acknowledge=alert.id;row.insertCell().append(button);}
    root.querySelector('[data-alert-count]').textContent=view.alerts.length?`${view.alerts.length} alerts match the severity and acknowledgement filters.`:'No alerts match these filters.';
    const events=[...localEvents,...fixture.activity].filter(event=>(state.serviceId===null&&state.service==='All')||event.service_id===(state.serviceId??state.service));
    const timeline=root.querySelector('[data-activity]');timeline.replaceChildren();for(const event of events){const item=element('li');if(event.time)item.append(element('time',event.time.slice(0,16).replace('T',' ')+' UTC',{datetime:event.time}));else item.append(element('span','Local preview action',{class:'example-help'}));item.append(element('p',event.title));timeline.append(item);}
    if(!events.length)timeline.append(element('li','No activity in the selected scope.'));
    status.textContent=`${view.services.length} services · Last ${state.hours} hours · ${threshold} ms warning threshold · ${view.alerts.length} visible alerts.${historyWarning()}`;
  };
  form.addEventListener('submit',event=>{event.preventDefault();render();});
  root.querySelector('#alert-table').addEventListener('click',event=>{const id=event.target.closest('[data-acknowledge]')?.dataset.acknowledge;if(!id)return;const target=alerts.find(alert=>alert.id===id);target.acknowledged=!target.acknowledged;localEvents.unshift({service_id:target.service_id,time:null,title:`${target.acknowledged?'Acknowledged':'Reopened'} ${id} locally.`});render(true,false);status.textContent=`${id} ${target.acknowledged?'acknowledged':'reopened'} locally. No live alert was changed.${historyWarning()}`;const replacement=[...root.querySelectorAll('[data-acknowledge]')].find(button=>button.dataset.acknowledge===id);if(replacement)replacement.focus();else form.elements.hideAcknowledged.focus();});
  root.querySelector('[data-reset-operations]').addEventListener('click',()=>{if(!updateURL(defaultState,true)){urlError=true;status.textContent=`Reset could not be completed.${historyWarning()}`;return;}urlError=false;alerts=structuredClone(fixture.alerts);localEvents=[];form.reset();render(false,false);status.textContent='Operations preview reset to the original synthetic snapshot.';});
  // Establish a valid default view before validating URL-provided draft controls.
  render(true,false);
  render();initializing=false;
  form.querySelector('fieldset').disabled=false;fallback.hidden=true;
}
if(root.dataset.dashboard==='operations'&&root.querySelector('#operations-filters'))operations();
