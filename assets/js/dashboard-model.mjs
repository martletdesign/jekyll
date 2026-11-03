/* Portable behaviour and calculations. No DOM, theme, framework, or network dependencies. */
export const dayMillis = 86400000;
// Only intentional view state crosses to the separately configured peer host.
const comparisonKeys = Object.freeze({
  analytics:['start','end','category','categoryId'],
  administration:['q','status','sort','direction','page','size','density'],
  operations:['hours','threshold','service','serviceId','severity','hideAcknowledged']
});
export function comparisonSearch(route, search) {
  if (!Object.hasOwn(comparisonKeys, route)) throw new Error('Unsupported dashboard route');
  const incoming = new URLSearchParams(search), outgoing = new URLSearchParams();
  for (const key of comparisonKeys[route]) if (incoming.has(key)) outgoing.set(key, incoming.get(key));
  return outgoing.toString();
}
export function rangeError(start, end, min, max) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return 'Enter both dates.';
  if ([start,end].some(value=>!Number.isFinite(Date.parse(value))||new Date(Date.parse(value)).toISOString().slice(0,10)!==value)) return 'Enter valid calendar dates.';
  if (start > end) return 'The start date must be on or before the end date.';
  if (start < min || end > max) return `Choose dates from ${min} to ${max}.`;
  return '';
}
export function aggregate(rows) {
  const totals={sessions:0,downloads:0,completions:0,duration_seconds:0};
  for(const row of rows) for(const key of Object.keys(totals)) {
    const value=row[key];
    if(!Number.isInteger(value)||value<0) throw new RangeError('Analytics observations must be nonnegative whole numbers.');
    if(!Number.isSafeInteger(value)||!Number.isSafeInteger(totals[key]+value)) throw new RangeError('Analytics totals exceed supported safe integer precision.');
    totals[key]+=value;
  }
  return {...totals, conversion:totals.sessions ? 100*totals.completions/totals.sessions : null, mean_duration:totals.sessions ? totals.duration_seconds/totals.sessions : null};
}
// A complete period requires one or more observations for every expected date/category.
function missingAnalyticsObservations(rows,start,length,categories) {
  const observed=new Set(rows.map(row=>`${row.date}\0${row.category}`));
  let missing=0;
  for(let offset=0;offset<length;offset++) {
    const date=new Date(Date.parse(start)+offset*dayMillis).toISOString().slice(0,10);
    for(const category of categories) if(!observed.has(`${date}\0${category}`)) missing++;
  }
  return missing;
}
export function analyticsCoverageMessage(view) {
  if (!view.rows.length) return 'No observations are available for the selected range and category.';
  if (view.missingObservations) return `Partial data: ${view.missingObservations} expected observation${view.missingObservations===1?' is':'s are'} missing. Totals use available observations.`;
  return '';
}
export function analyticsComparison(view,key) {
  if (view.missingObservations) return 'Comparison unavailable: selected period has missing observations.';
  if (!view.previous) return 'No complete preceding period available.';
  if (view.previous[key]===0) return 'Comparison unavailable: preceding value is zero.';
  return `${((view.totals[key]/view.previous[key]-1)*100).toFixed(1)}% versus preceding period.`;
}
export const analyticsCalendarError='Analytics data unavailable: observation dates must be valid calendar dates.';
export function analyticsCalendarIssue(fixture) {
  return fixture.analytics.some(row=>rangeError(row.date,row.date,row.date,row.date))?analyticsCalendarError:'';
}
export function analyticsView(fixture, {start, end, category='All', categoryId=/** @type {string|null} */ (null), coverage}) {
  if (!fixture.analytics.length) return {error:'No analytics data is available in this snapshot.',empty:true};
  const calendarError=analyticsCalendarIssue(fixture);
  if(calendarError)return {error:calendarError,dataError:true,calendarError:true};
  const observedMin=fixture.analytics.reduce((date,row)=>row.date<date?row.date:date,fixture.analytics[0].date);
  const observedMax=fixture.analytics.reduce((date,row)=>row.date>date?row.date:date,fixture.analytics[0].date);
  const declared=coverage!==undefined;
  if (declared && (!coverage || typeof coverage.start!=='string' || typeof coverage.end!=='string' || rangeError(coverage.start,coverage.end,coverage.start,coverage.end))) return {error:'Analytics coverage dates are invalid.'};
  const min=declared?coverage.start:observedMin, max=declared?coverage.end:observedMax;
  const error=rangeError(start,end,min,max);
  if(error) return {error};
  const selectedCategory=categoryId!==null?categoryId:(category==='All'?null:category);
  const categoryNames=[...new Set(fixture.categories)];
  const categoryOrder=new Map(categoryNames.map((name,index)=>[name,index]));
  const rows=fixture.analytics.filter(row=>row.date>=start&&row.date<=end&&(selectedCategory===null||row.category===selectedCategory)).sort((a,b)=>a.date.localeCompare(b.date)||(categoryOrder.get(a.category)??Infinity)-(categoryOrder.get(b.category)??Infinity)||a.category.localeCompare(b.category));
  const length=Math.round((Date.parse(end)-Date.parse(start))/dayMillis)+1;
  const previousEnd=new Date(Date.parse(start)-dayMillis).toISOString().slice(0,10);
  const previousStart=new Date(Date.parse(start)-length*dayMillis).toISOString().slice(0,10);
  const previousRows=fixture.analytics.filter(row=>row.date>=previousStart&&row.date<=previousEnd&&(selectedCategory===null||row.category===selectedCategory));
  try {
    const days=[...new Set(rows.map(row=>row.date))].map(date=>({date,...aggregate(rows.filter(row=>row.date===date))}));
    const categories=categoryNames.map(name=>({name,...aggregate(rows.filter(row=>row.category===name))}));
    const expected=selectedCategory===null?categoryNames:[selectedCategory];
    const missingObservations=missingAnalyticsObservations(rows,start,length,expected);
    const precedingComplete=previousStart>=min && missingAnalyticsObservations(previousRows,previousStart,length,expected)===0;
    const previous=!missingObservations&&precedingComplete ? aggregate(previousRows) : null;
    const previousCategories=previous ? categoryNames.map(name=>({name,...aggregate(previousRows.filter(row=>row.category===name))})) : null;
    return {error:'', rows, days, categories, totals:aggregate(rows), missingObservations, previous, previousCategories};
  } catch(error) {
    if(error instanceof RangeError) return {error:error.message,dataError:true};
    throw error;
  }
}
export function collectionView(records,{query='',status='All',sort='name',direction='asc',page=1,size=5},fields={search:['name','email','role','id'],sort:['name','email','role','status','id'],defaultSort:'name'}) {
  const needle=query.trim().toLocaleLowerCase();
  const filtered=records.filter(record=>(status==='All'||record.status===status)&&fields.search.some(key=>String(record[key]??'').toLocaleLowerCase().includes(needle)));
  const safeSort=fields.sort.includes(sort)?sort:fields.defaultSort;
  filtered.sort((a,b)=>String(a[safeSort]).localeCompare(String(b[safeSort]),'en')*(direction==='desc'?-1:1)||String(a.id).localeCompare(String(b.id)));
  const pageSize=[5,10,20].includes(Number(size))?Number(size):5;
  const pages=Math.max(1,Math.ceil(filtered.length/pageSize));
  const requestedPage=Number(page);
  const current=Number.isSafeInteger(requestedPage) ? Math.max(1,Math.min(requestedPage,pages)) : 1;
  return {filtered,rows:filtered.slice((current-1)*pageSize,current*pageSize),page:current,pages,size:pageSize,total:filtered.length};
}
// Disambiguate controls for people with the same displayed name while keeping
// existing accessible names for unique records.
export function personControlLabels(records) {
  const key=name=>name.trim().toLocaleLowerCase();
  const counts=new Map();
  for(const person of records){const name=key(person.name);counts.set(name,(counts.get(name)||0)+1);}
  return new Map(records.map(person=>[person.id,counts.get(key(person.name))>1?`${person.name} (${person.id})`:person.name]));
}
// Allocate a distinct ID even when existing IDs use another vocabulary.
export function nextPersonId(records) {
  const used=new Set(records.map(record=>record.id));
  let number=1, id;
  do { id=`P-${String(number++).padStart(3,'0')}`; } while(used.has(id));
  return id;
}
export function validatePerson(draft,records,id=null) {
  const errors={};
  if(draft.name.trim().length<2)errors.name='Enter a name of at least two characters.';
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim()))errors.email='Enter an email address.';
  else if(records.some(record=>record.id!==id&&record.email.trim().toLocaleLowerCase()===draft.email.trim().toLocaleLowerCase()))errors.email='This email address is already in the directory.';
  if(!['Researcher','Editor','Coordinator'].includes(draft.role))errors.role='Choose an available role.';
  if(!['Active','Invited','Suspended'].includes(draft.status))errors.status='Choose an available status.';
  return errors;
}
export function applyBulk(records,ids,status) {
  if(!['Active','Suspended'].includes(status))throw new Error('Unsupported bulk action');
  const selected=new Set(ids);
  return records.map(record=>selected.has(record.id)?{...record,status}:record);
}
export function validOperationsTimestamp(value) {
  const time=Date.parse(value);
  return Number.isFinite(time)&&new Date(time).toISOString().replace('.000Z','+00:00')===value;
}
export function dashboardSnapshotLabel(value) {
  if(!validOperationsTimestamp(value))return null;
  const date=new Date(value),months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const day=String(date.getUTCDate()).padStart(2,'0'),hours=String(date.getUTCHours()).padStart(2,'0'),minutes=String(date.getUTCMinutes()).padStart(2,'0'),seconds=date.getUTCSeconds();
  return `${day} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}, ${hours}:${minutes}${seconds?`:${String(seconds).padStart(2,'0')}`:''} UTC`;
}
export const operationsSnapshotLabel=dashboardSnapshotLabel;
export const operationsCalendarError='Operations data unavailable: timestamps must be valid UTC calendar times.';
export const operationsDataError='Operations data unavailable: service observations contain duplicate timestamps or readings after the snapshot.';
export const operationsPrecisionError='Operations data unavailable: observations or totals exceed supported safe integer precision.';
export function operationsDataIssue(fixture) {
  if(!validOperationsTimestamp(fixture.as_of)||fixture.services.some(service=>service.samples.some(sample=>!validOperationsTimestamp(sample.time)))||fixture.alerts.some(alert=>!validOperationsTimestamp(alert.time))||fixture.activity.some(event=>!validOperationsTimestamp(event.time)))return operationsCalendarError;
  const end=Date.parse(fixture.as_of), totals=new Map();
  let latestLatency=0,latestQueue=0,precision=false;
  for(const service of fixture.services){
    const seen=new Set();let latest=null;
    for(const sample of service.samples){
      const time=Date.parse(sample.time);
      if(time>end||seen.has(time))return operationsDataError;
      seen.add(time);
      if(!latest||sample.time>latest.time)latest=sample;
      if(!Number.isSafeInteger(sample.latency_ms)||sample.latency_ms<0||!Number.isSafeInteger(sample.queue)||sample.queue<0){precision=true;continue;}
      const total=(totals.get(time)||0)+sample.latency_ms;
      if(!Number.isSafeInteger(total))precision=true;
      totals.set(time,total);
    }
    if(latest){latestLatency+=latest.latency_ms;latestQueue+=latest.queue;}
    if(!Number.isSafeInteger(latestLatency)||!Number.isSafeInteger(latestQueue))precision=true;
  }
  return precision?operationsPrecisionError:'';
}
// Round nonnegative integer ratios exactly, including near MAX_SAFE_INTEGER.
function roundedMean(total,count){return Number((2n*BigInt(total)+BigInt(count))/(2n*BigInt(count)));}
export function operationsView(fixture,{hours=6,threshold=250,service='All',serviceId=/** @type {string|null} */ (null),severity='All',hideAcknowledged=false},alerts=fixture.alerts) {
  const error=operationsDataIssue(fixture);
  if(error) return {error};
  const limit=[6,12,24].includes(Number(hours))?Number(hours):6;
  const warning=Math.max(50,Math.min(1000,Number(threshold)||250));
  const end=Date.parse(fixture.as_of),start=end-(limit-1)*3600000;
  const selectedService=serviceId!==null?serviceId:(service==='All'?null:service);
  const services=fixture.services.filter(item=>selectedService===null||item.id===selectedService).map(item=>{
    const ordered=[...item.samples].sort((a,b)=>a.time.localeCompare(b.time));
    return {...item,latest:ordered.at(-1),samples:ordered.filter(sample=>Date.parse(sample.time)>=start&&Date.parse(sample.time)<=end)};
  });
  // Plot only timestamps represented by every service; never pair by array position.
  const samplesByService=services.map(item=>new Map(item.samples.map(sample=>[sample.time,sample])));
  const points=(services[0]?.samples||[]).filter(sample=>samplesByService.every(samples=>samples.has(sample.time))).map(sample=>({time:sample.time,latency_ms:roundedMean(samplesByService.reduce((sum,samples)=>sum+samples.get(sample.time).latency_ms,0),services.length)}));
  const commonTimes=new Set(points.map(point=>Date.parse(point.time)));
  const partial=services.some(item=>item.samples.length!==limit)||Array.from({length:limit},(_,index)=>end-index*3600000).some(time=>!commonTimes.has(time));
  const staggered=new Set(services.map(item=>item.latest.time)).size>1;
  const relevant=alerts.filter(alert=>(selectedService===null||alert.service_id===selectedService));
  const visible=relevant.filter(alert=>(severity==='All'||alert.severity===severity)&&(!hideAcknowledged||!alert.acknowledged));
  const last=services.map(item=>({...item,warning:item.latest.latency_ms>=warning}));
  const availabilities=services.flatMap(item=>item.samples.map(sample=>sample.availability));
  return {services:last,points,alerts:visible,open:relevant.filter(alert=>!alert.acknowledged).length,warnings:last.filter(item=>item.warning).length,queue:last.reduce((sum,item)=>sum+item.latest.queue,0),latency:last.length?roundedMean(last.reduce((sum,item)=>sum+item.latest.latency_ms,0),last.length):0,partial,staggered,availability:availabilities.length?Math.min(...availabilities):null,threshold:warning};
}
