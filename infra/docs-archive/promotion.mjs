// Append-only promotion decisions with a separately CAS-protected live pointer.
// No pointer update can delete historical records or snapshot objects.
import {readLimited} from './read-limited.mjs';
const enc=new TextEncoder(),hex=/^[a-f0-9]{64}$/;
const sha=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
const fail=(status,msg)=>new Response(msg,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
async function object(bucket,key){const o=await bucket.get(key);return o?.body?{bytes:new Uint8Array(await o.arrayBuffer()),etag:o.etag}:null;}
async function history(bucket,key,expected){const o=await object(bucket,key);if(!o||await sha(o.bytes)!==expected)throw Error('history integrity failure');return {value:JSON.parse(new TextDecoder().decode(o.bytes)),bytes:o.bytes};}
async function pointer(bucket,key){const o=await object(bucket,key);if(!o)return null;const hash=new TextDecoder().decode(o.bytes);if(!hex.test(hash))throw Error('invalid pointer');return {hash,etag:o.etag};}
export async function promotionRequest(request,env,authorize,pathname,prefixPath){
 const base=`${env.FAMILY}/jekyll/`,bucket=env.ARCHIVES;
 try{
  if(pathname==='/_archive/promotion'){
   if(request.method!=='PUT')return fail(405,'method not allowed');if(!await authorize(request,env))return fail(401,'unauthorized');
   const bytes=await readLimited(request,65536);if(!bytes)return fail(413,'too large');
   const x=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
   if(x.schemaVersion!==1||x.family!==env.FAMILY||x.framework!=='jekyll'||!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(x.version||'')||!hex.test(x.catalogSha256||'')||!(x.previousSha256===null||hex.test(x.previousSha256||''))||!['promote','rollback'].includes(x.operation)||typeof x.reason!=='string'||x.reason.length>500||(x.operation==='rollback'&&x.reason.trim().length<10))return fail(400,'invalid promotion');
   const catalogPointer=await pointer(bucket,base+'catalog-pointer.json');if(!catalogPointer||catalogPointer.hash!==x.catalogSha256)return fail(409,'catalog changed');
   const catalog=(await history(bucket,base+`catalogs/${catalogPointer.hash}.json`,catalogPointer.hash)).value;
   const target=catalog.versions?.find(v=>v.version===x.version);if(!target||target.channel!=='stable'||!target.supported||catalog.latestStable!==x.version)return fail(409,'target is not current latest supported stable');
   const manifest=await object(bucket,base+x.version+'/manifest.json');if(!manifest||await sha(manifest.bytes)!==target.manifestSha256)return fail(409,'target archive changed');
   const m=JSON.parse(new TextDecoder().decode(manifest.bytes));if(!Array.isArray(m.files)||m.files.length>10000)return fail(409,'target manifest invalid');for(const f of m.files){if(typeof f.path!=='string'||!/^[A-Za-z0-9._~/-]+$/.test(f.path)||f.path.split('/').some(p=>!p||p==='.'||p==='..')||!hex.test(f.sha256||''))return fail(409,'target manifest invalid');const o=await object(bucket,base+x.version+'/'+f.path);if(!o||o.bytes.length!==f.size||await sha(o.bytes)!==f.sha256)return fail(409,'target archive bytes changed');}
   const p=await pointer(bucket,base+'promotion-pointer.json'),digest=await sha(bytes);if(p?.hash===digest)return new Response(null,{status:200});
   if(x.previousSha256!==(p?.hash??null)||request.headers.get('x-previous-promotion-sha256')!==(p?.hash??'none'))return fail(409,'promotion parent changed');
   const previous=p?(await history(bucket,base+`promotions/${p.hash}.json`,p.hash)).value:null;
   const compare=(a,b)=>{const y=a.split('.').map(BigInt),z=b.split('.').map(BigInt);for(let i=0;i<3;i++)if(y[i]!==z[i])return y[i]>z[i]?1:-1;return 0;};
   if(x.operation==='rollback'&&(!previous||compare(x.version,previous.version)>=0))return fail(409,'rollback target must precede active version');
   if(x.operation==='promote'&&previous&&compare(x.version,previous.version)<0)return fail(409,'earlier version requires explicit rollback');
   const key=base+`promotions/${digest}.json`,created=await bucket.put(key,bytes,{onlyIf:new Headers({'if-none-match':'*'})});
   if(!created){const existing=await object(bucket,key);if(!existing||await sha(existing.bytes)!==digest)return fail(409,'promotion conflict');}
   // A catalog promotion cannot race a different catalog update undetected.
   const again=await pointer(bucket,base+'catalog-pointer.json');if(again?.hash!==x.catalogSha256)return fail(409,'catalog changed');
   const updated=await bucket.put(base+'promotion-pointer.json',enc.encode(digest),{onlyIf:p?new Headers({'if-match':`"${p.etag}"`}):new Headers({'if-none-match':'*'})});
   if(!updated)return fail(409,'promotion pointer changed');return new Response(digest,{status:201,headers:{'cache-control':'no-store'}});
  }
  if(request.method!=='GET'&&request.method!=='HEAD')return fail(405,'method not allowed');
  let x;if(pathname==='/docs/latest.json'||pathname==='/docs/'){
   const p=await pointer(bucket,base+'promotion-pointer.json');if(!p)return fail(404,'latest unavailable');x=await history(bucket,base+`promotions/${p.hash}.json`,p.hash);
   // Keep the old pointer live while a new catalog is being promoted, but
   // stop serving it as soon as its release has been explicitly withdrawn.
   const catalog=await pointer(bucket,base+'catalog-pointer.json');if(!catalog)return fail(503,'latest needs reconciliation');
   const current=(await history(bucket,base+`catalogs/${catalog.hash}.json`,catalog.hash)).value;
   if(!current.versions?.some(e=>e.version===x.value.version&&e.channel==='stable'&&e.supported))return fail(503,'latest needs reconciliation');
   if(pathname==='/docs/')return new Response(null,{status:302,headers:{location:`${prefixPath}/docs/v/${x.value.version}/`,'cache-control':'no-store'}});
  } else {const m=/^\/docs\/promotion-history\/([a-f0-9]{64})\.json$/.exec(pathname);if(!m)return fail(404,'not found');x=await history(bucket,base+`promotions/${m[1]}.json`,m[1]);}
  return new Response(request.method==='HEAD'?null:x.bytes,{headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
 }catch{return fail(503,'promotion verification failed');}
}
