import {thermalDefaults,thermalModel,thermalNumber,thermalCsv} from './thermal-model.mjs';
for(const root of document.querySelectorAll('[data-science]')) {
 const form=root.querySelector('[data-science-form]'),fields=root.querySelector('[data-science-fields]'),fallback=root.querySelector('[data-science-fallback]'),download=root.querySelector('[data-science-download]'),errors=root.querySelector('[data-science-errors]'),status=root.querySelector('[data-science-status]');
 let applied={...thermalDefaults},rows=thermalModel(applied).rows;
 const keys=Object.keys(thermalDefaults),draft=()=>Object.fromEntries(keys.map(key=>[key,form.elements[key].value]));
 const updateStatus=()=>{const pending=draft(),message=keys.some(key=>pending[key]!==applied[key])?'Parameters have changed. Results show the last successful calculation.':'Results show the current calculation.';if(status.textContent!==message)status.textContent=message;};
 function draw(){
  const temperatures=rows.map(row=>Number(thermalNumber(row.temperature))),low=Math.min(...temperatures),high=Math.max(...temperatures),spread=high-low;
  root.querySelector('polyline').setAttribute('points',rows.map((row,index)=>`${20+index*52},${spread===0?70:120-(temperatures[index]-low)/spread*100}`).join(' '));
  root.querySelector('[data-science-caption]').textContent=`Temperature over time, from ${thermalNumber(low)} to ${thermalNumber(high)} °C across ${thermalNumber(rows[0].minutes)} to ${thermalNumber(rows.at(-1).minutes)} minutes. Displayed values are in the table below.`;
  root.querySelector('[data-science-parameters]').textContent=`Last run: ${applied.initial} °C initial; ${applied.ambient} °C ambient; ${applied.timeConstant} min time constant; ${applied.duration} min duration.`;
  const body=root.querySelector('tbody');body.replaceChildren(...rows.map(row=>{const tr=document.createElement('tr'),th=document.createElement('th'),td=document.createElement('td');th.scope='row';th.textContent=thermalNumber(row.minutes);td.textContent=thermalNumber(row.temperature);tr.append(th,td);return tr;}));
 }
 form.addEventListener('input',updateStatus);
 form.addEventListener('submit',event=>{
  event.preventDefault();const input=draft(),candidate=thermalModel(input),list=errors.querySelector('ul');list.replaceChildren();
  for(const key of keys){const message=candidate.errors[key]||'',field=form.elements[key],help=root.querySelector(`[data-field-error="${key}"]`);field.setAttribute('aria-invalid',String(!!message));help.textContent=message;help.hidden=!message;if(message){const item=document.createElement('li'),link=document.createElement('a');link.href=`#${field.id}`;link.textContent=message;item.append(link);list.append(item);}}
  if(Object.keys(candidate.errors).length){errors.hidden=false;errors.focus();return;}
  errors.hidden=true;applied=input;rows=candidate.rows;draw();updateStatus();
 });
 download.addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([thermalCsv(rows)],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='thermal-response.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 draw();updateStatus();fields.disabled=false;download.disabled=false;fallback.hidden=true;
}
