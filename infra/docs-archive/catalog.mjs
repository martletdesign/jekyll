// Append-only catalog objects plus a CAS-protected pointer. A bucket owner can
// still bypass this code, so clients must pin an independently trusted digest.
const enc=new TextEncoder(),hex=/^[a-f0-9]{64}$/;
const version=/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
const path=/^[A-Za-z0-9._~/-]+$/;
const sha=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
const bad=(status,msg)=>new Response(msg,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
const json=(bytes,cache='no-store')=>new Response(bytes,{headers:{'content-type':'application/json; charset=utf-8','cache-control':cache,'x-content-type-options':'nosniff'}});
function parse(bytes,env){
 const c=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
 if(c.schemaVersion!==1||c.family!==env.FAMILY||c.framework!=='jekyll'||!Array.isArray(c.versions)||!c.versions.length||c.versions.length>1000||!(c.previousSha256===null||hex.test(c.previousSha256||'')))throw Error('invalid catalog');
 const seen=new Set();for(const e of c.versions){const m=version.exec(e.version||'');if(!m||seen.has(e.version)||(m[4]&&m[4].split('.').some(x=>/^\d+$/.test(x)&&x.length>1&&x[0]==='0'))||e.channel!==(m[4]?'prerelease':'stable')||!hex.test(e.manifestSha256||'')||typeof e.supported!=='boolean'||!Array.isArray(e.topics)||e.topics.length>10000||new Set(e.topics).size!==e.topics.length||e.topics.some(x=>typeof x!=='string'||!path.test(x)||x.split('/').some(p=>!p||p==='.'||p==='..')))throw Error('invalid catalog entry');seen.add(e.version);}
 const supported=c.versions.filter(x=>x.channel==='stable'&&x.supported),latest=c.versions.find(x=>x.version===c.latestStable);if(supported.length?(!latest||latest.channel!=='stable'||!latest.supported):c.latestStable!==null)throw Error('invalid latest');
 const cmp=(a,b)=>{const x=a.split('.').map(BigInt),y=b.split('.').map(BigInt);for(let i=0;i<3;i++)if(x[i]!==y[i])return x[i]>y[i]?1:-1;return 0;};
 if(supported.some(x=>cmp(x.version,latest.version)>0))throw Error('latest is not newest supported');
 return c;
}
async function get(bucket,key){const obj=await bucket.get(key);if(!obj?.body)return null;return {bytes:new Uint8Array(await obj.arrayBuffer()),etag:obj.etag};}
async function load(bucket,key,expected,env){const o=await get(bucket,key);if(!o||await sha(o.bytes)!==expected)throw Error('catalog integrity');return {catalog:parse(o.bytes,env),bytes:o.bytes};}
function preserved(now,old){if(now.family!==old.family||now.framework!==old.framework)return false;for(const e of old.versions){const n=now.versions.find(x=>x.version===e.version);if(!n||n.manifestSha256!==e.manifestSha256||n.channel!==e.channel||JSON.stringify(n.topics)!==JSON.stringify(e.topics))return false;}return true;}
async function pointer(bucket,base){const p=await get(bucket,base+'catalog-pointer.json');if(!p)return null;const hash=new TextDecoder().decode(p.bytes);if(!hex.test(hash))throw Error('invalid pointer');return {hash,etag:p.etag};}
export async function catalogRequest(request,env,authorize,pathname){
 const url=new URL(request.url),base=`${env.FAMILY}/jekyll/`,bucket=env.ARCHIVES;
 if(pathname==='/_archive/catalog'){
  if(request.method!=='PUT')return bad(405,'method not allowed');if(!await authorize(request,env))return bad(401,'unauthorized');
  const bytes=new Uint8Array(await request.arrayBuffer());if(bytes.length>1024*1024)return bad(413,'too large');
  let c;try{c=parse(bytes,env);}catch{return bad(400,'invalid catalog');}
  try{
   const cur=await pointer(bucket,base),current=cur?await load(bucket,base+`catalogs/${cur.hash}.json`,cur.hash,env):null,digest=await sha(bytes);
   if(cur?.hash===digest)return new Response(null,{status:200});
   if(c.previousSha256!==(cur?.hash??null)||request.headers.get('x-previous-catalog-sha256')!==(cur?.hash??'none'))return bad(409,'catalog parent changed');
   if(current&&!preserved(c,current.catalog))return bad(409,'history changed');
   for(const entry of c.versions){
    const prefix=base+entry.version+'/',manifest=await get(bucket,prefix+'manifest.json');if(!manifest||await sha(manifest.bytes)!==entry.manifestSha256)return bad(409,'manifest missing or changed');
    const m=JSON.parse(new TextDecoder().decode(manifest.bytes));if(m.family!==env.FAMILY||m.framework!=='jekyll'||m.docsVersion!==entry.version||!Array.isArray(m.files)||m.files.length>10000)return bad(409,'manifest identity changed');
    const names=new Set();for(const f of m.files){if(typeof f.path!=='string'||!path.test(f.path)||f.path.split('/').some(x=>!x||x==='.'||x==='..')||names.has(f.path)||!hex.test(f.sha256||'')||!Number.isSafeInteger(f.size)||f.size<0||f.size>16*1024*1024)return bad(409,'invalid manifest entry');names.add(f.path);const o=await get(bucket,prefix+f.path);if(!o||o.bytes.length!==f.size||await sha(o.bytes)!==f.sha256)return bad(409,'archive bytes changed');}
    if(JSON.stringify([...names].filter(x=>x.endsWith('.html')).sort())!==JSON.stringify([...entry.topics].sort()))return bad(409,'catalog topics differ');
   }
   const key=base+`catalogs/${digest}.json`,created=await bucket.put(key,bytes,{onlyIf:new Headers({'if-none-match':'*'})});
   if(!created){const existing=await get(bucket,key);if(!existing||await sha(existing.bytes)!==digest)return bad(409,'catalog conflict');}
   const conditional=cur?new Headers({'if-match':`"${cur.etag}"`}):new Headers({'if-none-match':'*'});
   const advanced=await bucket.put(base+'catalog-pointer.json',enc.encode(digest),{onlyIf:conditional});
   if(!advanced)return bad(409,'catalog pointer changed');
   return new Response(digest,{status:201,headers:{'cache-control':'no-store'}});
  }catch{return bad(503,'catalog verification failed');}
 }
 if(request.method!=='GET'&&request.method!=='HEAD')return bad(405,'method not allowed');
 try {
  if(pathname==='/docs/catalog.json'){
   const p=await pointer(bucket,base);if(!p)return bad(404,'catalog unavailable');const c=await load(bucket,base+`catalogs/${p.hash}.json`,p.hash,env);return json(request.method==='HEAD'?null:c.bytes);
  }
  const match=/^\/docs\/catalog-history\/([a-f0-9]{64})\.json$/.exec(pathname);
  if(match){const c=await load(bucket,base+`catalogs/${match[1]}.json`,match[1],env);return json(request.method==='HEAD'?null:c.bytes,'public, max-age=31536000, immutable');}
  return bad(404,'not found');
 }catch{return bad(503,'catalog verification failed');}
}
