const test = require('node:test');
const assert = require('node:assert/strict');
const release = require('../scripts/automatic-release.cjs');
const sha = 'a'.repeat(40);
function fixture({main=sha, tag=false, published=false, lookupError}={}) {
 const calls=[];
 const missing=()=>{throw Object.assign(new Error('missing'),{status:404});};
 return {calls,args:{version:'2.0.0',core:{info(){}},context:{repo:{owner:'example',repo:'jekyll'},payload:{workflow_run:{conclusion:'success',event:'push',head_branch:'main',head_repository:{full_name:'example/jekyll'},head_sha:sha}}},github:{rest:{
  git:{getRef:async ({ref})=>{if(ref==='heads/main')return {data:{object:{sha:main}}};if(lookupError)throw lookupError;return tag?{data:{object:{sha}}}:missing();},createRef:async x=>calls.push(['tag',x])},
  repos:{getReleaseByTag:async()=>published?{data:{draft:false}}:missing()},
  actions:{createWorkflowDispatch:async x=>calls.push(['dispatch',x])}
 }}}};
}
test('accepted main creates immutable tag then dispatches tag workflow',async()=>{const f=fixture();await release(f.args);assert.deepEqual(f.calls.map(x=>x[0]),['tag','dispatch']);assert.equal(f.calls[0][1].sha,sha);assert.equal(f.calls[1][1].ref,'v2.0.0');});
test('superseded main and completed versions do not publish again',async()=>{for(const options of [{main:'b'.repeat(40)},{tag:true,published:true}]){const f=fixture(options);await release(f.args);assert.equal(f.calls.length,0);}});
test('incomplete existing tag dispatches without moving tag',async()=>{const f=fixture({tag:true});await release(f.args);assert.deepEqual(f.calls.map(x=>x[0]),['dispatch']);});
test('ambiguous API errors never create tags',async()=>{const f=fixture({lookupError:Object.assign(new Error('forbidden'),{status:403})});await assert.rejects(release(f.args));assert.equal(f.calls.length,0);});
test('untrusted run and invalid versions fail before writes',async()=>{for(const patch of [{version:'02.0.0'},{version:'2.0.0-01'}]){const f=fixture();await assert.rejects(release({...f.args,...patch}));assert.equal(f.calls.length,0);}const f=fixture();f.args.context.payload.workflow_run.event='pull_request';await assert.rejects(release(f.args));assert.equal(f.calls.length,0);});
