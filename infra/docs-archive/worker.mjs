// A deliberately narrow R2 gateway: only the Worker may possess bucket write
// access. R2 conditional writes provide create-only object creation; the
// public endpoint exposes only the immutable committed manifest's inventory.
const encoder = new TextEncoder();
const versionRE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
const digestRE = /^[a-f0-9]{64}$/;
const pathRE = /^[A-Za-z0-9._~/-]+$/;
const maxBytes = 16 * 1024 * 1024;
function fail(status, message) { return new Response(message, {status, headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}}); }
function validVersion(v) { const m = versionRE.exec(v); return !!m && !(m[4] && m[4].split('.').some(x => /^\d+$/.test(x) && x.length > 1 && x[0] === '0')); }
function validPath(p) { return !!p && pathRE.test(p) && p.split('/').every(x => x && x !== '.' && x !== '..'); }
async function digest(bytes) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join(''); }
async function authorized(request, env) {
  if (typeof env.ARCHIVE_WRITE_TOKEN !== 'string' || env.ARCHIVE_WRITE_TOKEN.length < 32) return false;
  const supplied = request.headers.get('authorization') || '';
  // Compare fixed-length digests in constant-time. No secret is reflected in errors.
  const [a,b] = await Promise.all([crypto.subtle.digest('SHA-256',encoder.encode(supplied)),crypto.subtle.digest('SHA-256',encoder.encode(`Bearer ${env.ARCHIVE_WRITE_TOKEN}`))]);
  return crypto.subtle.timingSafeEqual(a,b);
}
function parseManifest(bytes, env, version) {
  let m; try { m = JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)); } catch { throw Error('invalid manifest'); }
  if (m.schemaVersion !== 1 || m.family !== env.FAMILY || m.framework !== 'jekyll' || m.docsVersion !== version || m.basePath !== `/docs/v/${version}/` ||
      m.implementation?.kind !== 'git' || m.implementation.name !== `${env.FAMILY}design/jekyll` || m.implementation.version !== version || m.implementation.tag !== `v${version}` ||
      m.source?.repository !== `${env.FAMILY}design/jekyll` || m.source.tag !== `v${version}` || !/^[a-f0-9]{40}$/.test(m.source.commit || '') ||
      m.core !== null || m.legacyTheme?.name !== `@${env.FAMILY}/theme` || !validVersion(m.legacyTheme?.version || '') || !/^sha512-[A-Za-z0-9+/]{86}==$/.test(m.legacyTheme?.integrity || '') || !digestRE.test(m.legacyTheme?.sourceShellSha256 || '') ||
      m.indexing !== 'noindex' || !Array.isArray(m.files) || m.files.length === 0 || m.files.length > 10000) throw Error('invalid manifest identity');
  const seen = new Set();
  for (const f of m.files) {
    if (!validPath(f.path) || f.path === 'manifest.json' || seen.has(f.path) || !Number.isSafeInteger(f.size) || f.size < 0 || f.size > maxBytes || !digestRE.test(f.sha256 || '')) throw Error('invalid manifest entry');
    seen.add(f.path);
  }
  if (!seen.has('index.html')) throw Error('missing index');
  return m;
}
async function readObject(bucket, key) {
  const object = await bucket.get(key); if (!object || !object.body) return null;
  return new Uint8Array(await object.arrayBuffer());
}
async function create(bucket, key, bytes) {
  return bucket.put(key,bytes,{onlyIf:new Headers({'if-none-match':'*'})});
}
function contentType(path) {
  const ext = path.slice(path.lastIndexOf('.')+1).toLowerCase();
  return ({html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8',json:'application/json; charset=utf-8',svg:'image/svg+xml',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',woff:'font/woff',woff2:'font/woff2',ttf:'font/ttf',pdf:'application/pdf',txt:'text/plain; charset=utf-8'})[ext] || 'application/octet-stream';
}
export default { async fetch(request, env) {
  if (!['martlet','krigsvold'].includes(env.FAMILY) || !env.ARCHIVES) return fail(503,'archive configuration unavailable');
  const url = new URL(request.url); if (url.search || url.pathname.includes('%')) return fail(400,'invalid path');
  const prefixPath=env.DEPLOY_PREFIX||'';
  if(prefixPath && (!/^\/(?:[A-Za-z0-9._~-]+)(?:\/[A-Za-z0-9._~-]+)*$/.test(prefixPath)||prefixPath.split('/').some(x=>x==='.'||x==='..')))return fail(503,'invalid deployment prefix');
  if(prefixPath&&!url.pathname.startsWith(prefixPath+'/'))return fail(404,'not found');
  const pathname=url.pathname.slice(prefixPath.length);
  // The shared catalog contract currently requires a /core identity and cannot
  // represent this legacy-theme snapshot honestly. Keep promotion unavailable.
  if(pathname==='/_archive/catalog'||pathname==='/docs/catalog.json'||pathname.startsWith('/docs/catalog-history/')||pathname==='/_archive/promotion'||pathname==='/docs/latest.json'||pathname==='/docs/'||pathname.startsWith('/docs/promotion-history/'))return fail(503,'Jekyll catalog and promotion are not configured');
  const segments = pathname.split('/');
  const upload = segments[1] === '_archive' && segments[2] === 'v';
  const read = segments[1] === 'docs' && segments[2] === 'v';
  if ((!upload && !read) || !validVersion(segments[3] || '')) return fail(404,'not found');
  const version = segments[3], prefix = `${env.FAMILY}/jekyll/${version}/`;
  let path = segments.slice(4).join('/'); if (read && (!path || path.endsWith('/'))) path += 'index.html';
  if (!validPath(path)) return fail(400,'invalid path');
  const markerKey = `${prefix}manifest.json`;
  if (upload) {
    if (request.method !== 'PUT' && request.method !== 'GET') return fail(405,'method not allowed');
    if (!await authorized(request,env)) return fail(401,'unauthorized');
    // This private read supports interrupted, byte-for-byte idempotent uploads.
    if (request.method === 'GET') {
      const bytes = await readObject(env.ARCHIVES,prefix+path);
      return bytes ? new Response(bytes,{headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}}) : fail(404,'not found');
    }
    if (request.headers.get('content-length') && Number(request.headers.get('content-length')) > maxBytes) return fail(413,'too large');
    const bytes = new Uint8Array(await request.arrayBuffer()); if (bytes.length > maxBytes) return fail(413,'too large');
    if (await env.ARCHIVES.head(markerKey)) return fail(409,'snapshot already committed');
    if (path === 'manifest.json') {
      let manifest; try { manifest = parseManifest(bytes,env,version); } catch { return fail(400,'invalid manifest'); }
      if (request.headers.get('x-manifest-sha256') !== await digest(bytes)) return fail(400,'manifest digest mismatch');
      for (const file of manifest.files) {
        const object = await readObject(env.ARCHIVES,prefix+file.path);
        if (!object || object.length !== file.size || await digest(object) !== file.sha256) return fail(409,'archive object missing or corrupt');
      }
    }
    if (!await create(env.ARCHIVES,prefix+path,bytes)) return fail(409,'object already exists');
    const saved=await readObject(env.ARCHIVES,prefix+path);
    if (!saved || await digest(saved)!==await digest(bytes)) return fail(503,'stored object could not be verified');
    return new Response(null,{status:201,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') return fail(405,'method not allowed');
  const manifestBytes=await readObject(env.ARCHIVES,markerKey); if(!manifestBytes)return fail(404,'not found');
  let manifest; try {manifest=parseManifest(manifestBytes,env,version);}catch{return fail(503,'archive integrity failure');}
  if(path==='manifest.json') return new Response(request.method==='HEAD'?null:manifestBytes,{headers:{'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=31536000, immutable','x-content-type-options':'nosniff','x-robots-tag':'noindex, follow'}});
  const entry=manifest.files.find(x=>x.path===path); if(!entry)return fail(404,'not found');
  const bytes=await readObject(env.ARCHIVES,prefix+path);
  if(!bytes||bytes.length!==entry.size||await digest(bytes)!==entry.sha256)return fail(503,'archive integrity failure');
  return new Response(request.method==='HEAD'?null:bytes,{headers:{'content-type':contentType(path),'cache-control':'public, max-age=31536000, immutable','x-content-type-options':'nosniff','x-robots-tag':'noindex, follow'}});
}};
