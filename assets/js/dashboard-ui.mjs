/* Small reusable DOM renderers. Authored and user-entered text never becomes HTML. */
const svgNS='http://www.w3.org/2000/svg';
export function element(tag,text,attrs={}){const node=document.createElement(tag);if(text!==undefined)node.textContent=String(text);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,String(value));return node;}
export function tableRows(table,rows,headers){
  const head=table.tHead||table.createTHead();head.replaceChildren();const heading=head.insertRow();
  headers.forEach(label=>heading.append(element('th',label,{scope:'col'})));
  const body=table.tBodies[0]||table.createTBody();body.replaceChildren();
  rows.forEach(values=>{const row=body.insertRow();values.forEach((value,index)=>row.append(element(index===0?'th':'td',value,index===0?{scope:'row'}:{})));});
}
export function metric(root,id,value,comparison=''){
  root.querySelector(`[data-metric="${id}"]`).textContent=value;
  const note=root.querySelector(`[data-comparison="${id}"]`);if(note)note.textContent=comparison;
}
function svgElement(tag,attrs={},text){const node=document.createElementNS(svgNS,tag);for(const[k,v]of Object.entries(attrs))node.setAttribute(k,v);if(text!==undefined)node.textContent=String(text);return node;}
// Keep the chart's coordinate space aligned with its available width. Scaling a
// fixed 720-unit viewBox down to a phone also scales 13px labels to ~4px.
const chartStates=new WeakMap();
function drawChart(mount,id,rows,{label,bars,previous,threshold}){
  mount.replaceChildren();
  const values=rows.flatMap(row=>[row.value,...(previous&&row.previous!==null?[row.previous]:[])]);
  const max=Math.max(1,...values,threshold||0)*1.15;
  const width=Math.min(720,mount.clientWidth||720),height=Math.max(160,Math.round(width/3)),left=48,right=16,top=18,bottom=width<420&&bars?52:42;
  const x=i=>left+(rows.length===1?.5:i/(rows.length-1))*(width-left-right);
  const y=value=>height-bottom-value/max*(height-top-bottom);
  const svg=svgElement('svg',{viewBox:`0 0 ${width} ${height}`,role:'img','aria-label':`${label}. ${rows.length} data points. Exact values are in the following data table.`});
  svg.append(svgElement('title',{},`${label} — synthetic data`));
  for(let tick=0;tick<4;tick++){const value=max*tick/3;svg.append(svgElement('line',{x1:left,x2:width-right,y1:y(value),y2:y(value),class:'dash-chart-grid'}));svg.append(svgElement('text',{x:left-8,y:y(value)+4,'text-anchor':'end',class:'dash-chart-label'},Math.round(value)));}
  if(bars){
    const defs=svgElement('defs');const pattern=svgElement('pattern',{id:`hatch-${id}`,width:8,height:8,patternUnits:'userSpaceOnUse'});pattern.append(svgElement('path',{d:'M-2 2L2 -2M0 8L8 0M6 10L10 6',stroke:'var(--dash-chart-secondary)','stroke-width':3}));defs.append(pattern);svg.append(defs);
    const slot=(width-left-right)/Math.max(1,rows.length),barWidth=slot*(previous?.27:.5);
    rows.forEach((row,i)=>{const middle=left+slot*(i+.5);svg.append(svgElement('rect',{x:middle-(previous?barWidth+2:barWidth/2),y:y(row.value),width:barWidth,height:height-bottom-y(row.value),class:'dash-chart-primary'}));if(previous&&row.previous!==null)svg.append(svgElement('rect',{x:middle+2,y:y(row.previous),width:barWidth,height:height-bottom-y(row.previous),fill:`url(#hatch-${id})`}));svg.append(svgElement('text',{x:middle,y:height-(width<420&&i%2===0?30:14),'text-anchor':'middle',class:'dash-chart-label'},row.label));});
  }else{
    svg.append(svgElement('polyline',{points:rows.map((row,i)=>`${x(i)},${y(row.value)}`).join(' '),class:'dash-chart-line',fill:'none'}));
    rows.forEach((row,i)=>{svg.append(svgElement('circle',{cx:x(i),cy:y(row.value),r:3,class:'dash-chart-primary'}));if(i===0||i===rows.length-1||(width>=420&&i===Math.floor(rows.length/2)))svg.append(svgElement('text',{x:x(i),y:height-14,'text-anchor':i===0?'start':i===rows.length-1?'end':'middle',class:'dash-chart-label'},row.label));});
  }
  if(threshold!==null)svg.append(svgElement('line',{x1:left,x2:width-right,y1:y(threshold),y2:y(threshold),class:'dash-chart-threshold'}));
  mount.append(svg);
}
export function chart(root,id,rows,{label='Count',bars=false,previous=false,threshold=null}={}){
  const mount=root.querySelector(`[data-chart="${id}"]`);
  const options={label,bars,previous,threshold};
  let state=chartStates.get(mount);
  if(!state){
    state={id,rows,options,width:0};
    chartStates.set(mount,state);
    if(typeof ResizeObserver!=='undefined'){
      new ResizeObserver(entries=>{
        const width=entries[0].contentRect.width;
        if(width>0&&Math.abs(width-state.width)>=1){state.width=width;drawChart(mount,state.id,state.rows,state.options);}
      }).observe(mount);
    }
  }
  Object.assign(state,{id,rows,options,width:mount.clientWidth});
  drawChart(mount,id,rows,options);
  const headers=previous?['Category','Current sessions','Previous sessions']:['Label',label];
  tableRows(root.querySelector(`[data-chart-table="${id}"]`),rows.map(row=>previous?[row.label,row.value,row.previous??'Unavailable']:[row.label,row.value]),headers);
  root.querySelector(`[data-chart-summary="${id}"]`).textContent=!rows.length?'No observations are available for this chart. Exact values appear in the data table.':previous?'Solid bars: current period. Striped bars: preceding period. Exact values appear in the data table.':`${rows.length} plotted observations.${threshold!==null?` Dashed line: warning threshold ${threshold} ms.`:''} Exact values appear in the data table.`;
}
export function downloadCSV(name,rows){
  const quote=value=>'"'+String(value).replaceAll('"','""')+'"';
  const csv=rows.map(row=>row.map(quote).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const anchor=element('a','',{href:url,download:name});anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
