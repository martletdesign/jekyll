#!/usr/bin/env python3
"""Build and verify a Git-qualified static deployment; never publishes a package."""
import argparse
import concurrent.futures
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import tarfile
import tempfile
import time
import threading
import urllib.error
import urllib.parse
import urllib.request
import zipfile
import uuid
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[2]
SHA = re.compile(r'^[0-9a-f]{40}$')

def digest(data):
    return hashlib.sha256(data).hexdigest()

def json_bytes(value):
    return (json.dumps(value, sort_keys=True, separators=(',', ':'))+'\n').encode()

def read_config(root=ROOT):
    c=json.loads((root/'infra/deployment/site.json').read_text())
    assert c['schemaVersion']==1 and c['family'] in ('martlet','krigsvold')
    assert c['repository']==c['family']+'design/jekyll'
    assert re.fullmatch(r'[a-f0-9]{32}',c['accountId'])
    assert set(c['targets'])=={'develop','main'}
    for branch,t in c['targets'].items():
        assert re.fullmatch(r'[a-z0-9-]+',t['worker'])
        u=urllib.parse.urlsplit(t['origin'])
        assert u.scheme=='https' and not u.username and not u.password and not u.port and not u.query and not u.fragment and u.path in ('','/')
        assert t['environment']==('jekyll-development' if branch=='develop' else 'jekyll-production')
    assert c['targets']['main']['worker']==c['family']+'design-jekyll-reference'
    assert c['targets']['main']['origin']=='https://jekyll.'+c['family']+'design.dev'
    assert c['targets']['develop']['worker']==c['targets']['main']['worker']
    assert c['targets']['develop']['previewName']=='develop'
    assert c['targets']['develop']['origin']=='https://develop-'+c['family']+'design-jekyll-reference.k3jph.workers.dev'
    return c

# Both organizations have one human maintainer. Their production gate must
# verify source, review state and exact-head CI; it must not demand a second
# reviewer who cannot exist. Separate protected tag rules remain unchanged.
SOLO_MAINTAINER = 'howardjp'
PROMOTION_CHECKS = frozenset({'verify','guard','archive-build',
                              'browser (chromium)','browser (firefox)','browser (webkit)'})

def promotion_checks_ok(head, checks):
    if not SHA.fullmatch(head or '') or not isinstance(checks,dict):return False
    runs=checks.get('check_runs')
    if not isinstance(runs,list) or checks.get('total_count')!=len(runs) or len(runs)>100:return False
    for name in PROMOTION_CHECKS:
        matching=[run for run in runs if run.get('name')==name]
        if len(matching)!=1:return False
        run=matching[0]
        if (run.get('head_sha')!=head or run.get('status')!='completed' or
                run.get('conclusion')!='success' or
                run.get('app',{}).get('slug')!='github-actions'):return False
    return True

def promotion_ok(pr, sha, reviews, checks):
    head=pr.get('head',{})
    shape=(pr.get('merged_at') is not None and pr.get('merge_commit_sha')==sha and
           pr.get('base',{}).get('ref')=='main' and
           (head.get('ref')=='develop' or head.get('ref','').startswith(('release/','hotfix/'))))
    if not shape or not promotion_checks_ok(head.get('sha'),checks):return False
    latest={}
    for review in sorted(reviews,key=lambda r:r.get('id',0)):
        if review.get('state') in ('APPROVED','CHANGES_REQUESTED','DISMISSED'):
            latest[review.get('user',{}).get('login')]=review
    if any(r.get('state')=='CHANGES_REQUESTED' for r in latest.values()):return False
    independent_approval=any(r.get('state')=='APPROVED' and r.get('commit_id')==head.get('sha') and
                             login and login!=pr.get('user',{}).get('login') for login,r in latest.items())
    sole_maintainer_merge=(pr.get('user',{}).get('login')==SOLO_MAINTAINER and
                            pr.get('merged_by',{}).get('login')==SOLO_MAINTAINER)
    return independent_approval or sole_maintainer_merge

def github(path):
    headers={'Accept':'application/vnd.github+json','User-Agent':'JekyllNativeBuildVerification','X-GitHub-Api-Version':'2022-11-28'}
    token=os.environ.get('GITHUB_TOKEN') or os.environ.get('GH_TOKEN')
    if token:headers['Authorization']='Bearer '+token
    code,b,_=request('https://api.github.com/'+path,headers=headers)
    assert code==200,f'Public GitHub verification denied or failed ({code}); never deploy without evidence'
    return json.loads(b)

def github_list(path):
    result=[];page=1
    while True:
        values=github(path+('&' if '?' in path else '?')+f'per_page=100&page={page}')
        assert isinstance(values,list)
        result.extend(values)
        if len(values)<100:return result
        page+=1;assert page<=20,'Unexpected GitHub pagination'

def guard(c, branch, sha):
    assert branch in c['targets'] and SHA.fullmatch(sha),'Only exact main/develop commits can deploy'
    assert os.environ.get('GITHUB_REPOSITORY',c['repository'])==c['repository']
    assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()==sha
    live=github(f"repos/{c['repository']}/git/ref/heads/{branch}")
    assert live['object']['sha']==sha,'Superseded commit must not deploy'
    if branch=='main':
        prs=github_list(f"repos/{c['repository']}/commits/{sha}/pulls")
        approved=False
        for summary in prs:
            # The commit-associated PR collection is a GitHub summary response
            # and does not contain merged_by. Fetch the actual PR resource:
            # only it establishes who merged the production promotion.
            number=summary.get('number')
            head=summary.get('head',{}).get('sha','')
            if not isinstance(number,int) or number<1 or not SHA.fullmatch(head):continue
            pr=github(f"repos/{c['repository']}/pulls/{number}")
            assert pr.get('number')==number and pr.get('head',{}).get('sha')==head, 'Full promotion PR identity differs from commit association'
            assert pr.get('merge_commit_sha')==sha, 'Full promotion PR does not identify the current production commit'
            reviews=github_list(f"repos/{c['repository']}/pulls/{number}/reviews")
            checks=github(f"repos/{c['repository']}/commits/{head}/check-runs?filter=latest&per_page=100")
            if promotion_ok(pr,sha,reviews,checks):approved=True
        assert approved,'Production requires a merged GitFlow PR, six exact-head successful checks, and independent approval or the sole maintainer as merger'

def verify_history(directory, lock):
    files={x['path']:x for x in lock['files']}
    assert len(files)==len(lock['files'])
    actual={p.relative_to(directory).as_posix() for p in directory.rglob('*') if p.is_file()}
    assert actual==set(files),'Frozen history inventory differs'
    for name,f in files.items():
        p=directory/name;assert not p.is_symlink();b=p.read_bytes()
        assert len(b)==f['bytes'] and digest(b)==f['sha256'],f'Frozen bytes differ: {name}'

def extract_history(root, destination):
    lock=json.loads((root/'infra/deployment/history.json').read_text())
    archive=root/'infra/deployment'/lock['archive'];data=archive.read_bytes()
    assert digest(data)==lock['sha256'],'Frozen history archive digest differs'
    with tarfile.open(fileobj=io.BytesIO(data),mode='r:gz') as t:
        names=set()
        for m in t:
            p=PurePosixPath(m.name)
            assert m.isfile() and not p.is_absolute() and '..' not in p.parts and str(p)==m.name
            assert m.name.startswith(('docs/','preview/docs/')) and m.name not in names
            names.add(m.name);target=destination/m.name
            assert not target.exists(),'Never overwrite a generated path with frozen history'
            target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(t.extractfile(m).read())
        assert names=={f['path'] for f in lock['files']}
    for f in lock['files']:
        b=(destination/f['path']).read_bytes()
        assert len(b)==f['bytes'] and digest(b)==f['sha256']
    return lock

def inventory(directory):
    files=[]
    for p in sorted(directory.rglob('*')):
        assert not p.is_symlink(),'Symlinks are forbidden in deployment payloads'
        if p.is_file():
            b=p.read_bytes();files.append({'path':p.relative_to(directory).as_posix(),'bytes':len(b),'sha256':digest(b)})
    return files

def cloudflare_build_metadata(branch, sha, environ=None):
    """Whitelisted, overridable environment evidence; not an attestation."""
    environment=os.environ if environ is None else environ
    build_id=environment.get('WORKERS_CI_BUILD_UUID')
    commit=environment.get('WORKERS_CI_COMMIT_SHA')
    reported_branch=environment.get('WORKERS_CI_BRANCH')
    if commit is not None:assert SHA.fullmatch(commit) and commit==sha,'Cloudflare reported commit does not match the actual source'
    if reported_branch is not None:assert reported_branch==branch,'Cloudflare reported branch does not match the target'
    if build_id is None:return None
    assert re.fullmatch(r'[a-fA-F0-9]{8}(?:-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12}',build_id),'Invalid Cloudflare build UUID'
    return {'buildUuid':str(uuid.UUID(build_id)),'commitSha':commit,'branch':reported_branch,'evidence':'environment-reported','independentAttestationClaimed':False}

def finalize(c, branch, sha, destination):
    """Consume direct Jekyll output; this function never invokes Ruby."""
    assert branch in c['targets'] and SHA.fullmatch(sha)
    destination=destination.resolve();assert destination.is_dir() and not destination.is_symlink()
    assert destination==ROOT/'.cloudflare-site','Only the prebuilt deployment output is accepted'
    entries=json.loads((ROOT/'nightjar/source-files.json').read_text())
    inputs=json.loads((ROOT/'.cloudflare-source-inputs.json').read_text())
    assert {x['path'] for x in inputs}==set(entries)
    for f in inputs:
        assert digest((ROOT/f['path']).read_bytes())==f['sha256']
        assert digest((ROOT/'.cloudflare-source'/f['path']).read_bytes())==f['sha256']
    subprocess.run(['git','diff','--quiet','HEAD'],cwd=ROOT,check=True,timeout=30)
    with zipfile.ZipFile(destination/'template.zip','w',zipfile.ZIP_DEFLATED) as archive:
        for entry in entries:
            source=ROOT/entry;assert source.is_file() and not source.is_symlink()
            info=zipfile.ZipInfo(entry,date_time=(1980,1,1,0,0,0));info.create_system=3
            info.external_attr=(0o100755 if source.stat().st_mode&0o111 else 0o100644)<<16
            archive.writestr(info,source.read_bytes(),compress_type=zipfile.ZIP_DEFLATED,compresslevel=9)
    shutil.copyfile(destination/'template.zip',destination/'preview/template.zip')
    for base in ('','/preview'):
        d=destination/base.lstrip('/')
        subprocess.run(['python3','nightjar/verify-html.py',str(d),'--baseurl',base],cwd=ROOT,check=True,timeout=120)
    subprocess.run(['python3','scripts/verify_docs.py','--build',str(destination)],cwd=ROOT,check=True,timeout=120)
    history=extract_history(ROOT,destination)
    headers='/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Cache-Control: public, no-transform\n'
    if branch=='develop':
        headers+='  X-Robots-Tag: noindex, nofollow, noarchive\n'
        (destination/'robots.txt').write_text('User-agent: *\nDisallow: /\n')
    (destination/'_headers').write_text(headers)
    files=inventory(destination);artifact_sha=digest(json_bytes(files))
    metadata={'schemaVersion':1,'family':c['family'],'framework':'jekyll','repository':c['repository'],'branch':branch,'sourceCommit':sha,'sourceTree':subprocess.check_output(['git','rev-parse',sha+'^{tree}'],cwd=ROOT,text=True).strip(),'builtAt':datetime.now(timezone.utc).isoformat(),'artifactSha256':artifact_sha,'sourceZipSha256':digest((destination/'template.zip').read_bytes()),'sourceArchivePublication':'not-performed-by-deployment','frozenHistorySha256':history['sha256'],'worker':c['targets'][branch]['worker'],'url':c['targets'][branch]['origin'],'advancedArchiveEnabled':False,'runtimeBindings':[],'runtimeSecrets':False,'noindex':branch=='develop','deliveryMode':'native-cloudflare-static-assets','manualAccessibilityReviewPassed':False}
    metadata['cloudflareBuild']=cloudflare_build_metadata(branch,sha)
    path=destination/'.well-known/deployment.json';path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(json_bytes(metadata))
    (destination/'deployment-inventory.json').write_bytes(json_bytes({'schemaVersion':1,'artifactSha256':artifact_sha,'files':files}))
    return metadata

def validate_artifact(c, branch, sha, directory):
    m=json.loads((directory/'.well-known/deployment.json').read_text())
    assert m['repository']==c['repository'] and m['branch']==branch and m['sourceCommit']==sha
    assert m['worker']==c['targets'][branch]['worker'] and m['url']==c['targets'][branch]['origin']
    assert m['advancedArchiveEnabled'] is False and m['runtimeBindings']==[] and m['runtimeSecrets'] is False
    assert m['noindex']==(branch=='develop')
    inv=json.loads((directory/'deployment-inventory.json').read_text())
    assert inv['artifactSha256']==m['artifactSha256']==digest(json_bytes(inv['files']))
    expected={f['path']:f for f in inv['files']}
    assert len(expected)==len(inv['files'])
    actual={f['path']:f for f in inventory(directory) if f['path'] not in ('.well-known/deployment.json','deployment-inventory.json')}
    assert expected==actual,'Artifact bytes or paths changed after verified build'
    return m,inv

def request(url, *, data=None, headers=None, method=None):
    req=urllib.request.Request(url,data=data,headers=headers or {},method=method)
    try:
        with urllib.request.urlopen(req,timeout=25) as r:return r.status,r.read(),dict(r.headers)
    except urllib.error.HTTPError as e:
        return e.code,e.read(),dict(e.headers)

def public_bytes(url, timeout=25):
    """A real HTTPS fetch with a wall-clock deadline, including redirects/body."""
    with tempfile.TemporaryDirectory(prefix='jekyll-live-fetch-') as temporary:
        root=Path(temporary);body=root/'body';headers=root/'headers'
        command=['curl','--silent','--show-error','--location','--proto-redir','=https','--connect-timeout',str(min(10,timeout)),'--max-time',str(timeout),'--dump-header',str(headers),'--output',str(body),'--write-out','%{http_code}','--user-agent','Mozilla/5.0 JekyllDeploymentVerification','--header','Cache-Control: no-cache',url]
        completed=subprocess.run(command,check=False,text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=timeout+5)
        assert completed.returncode==0,f'Live request failed or exceeded {timeout}s: {url}'
        last=headers.read_bytes().strip().split(b'\r\n\r\n')[-1].decode('iso-8859-1')
        parsed={}
        for line in last.splitlines()[1:]:
            name,separator,value=line.partition(':')
            if separator:
                key=name.strip().lower();parsed[key]=(parsed[key]+', ' if key in parsed else '')+value.strip()
        return int(completed.stdout),body.read_bytes(),parsed

def verify_live(c, branch, sha, directory, *, overall_timeout=300, request_timeout=25, propagation_timeout=30, retry_delay=1):
    m,inv=validate_artifact(c,branch,sha,directory);origin=c['targets'][branch]['origin']
    deadline=time.monotonic()+overall_timeout;stopping=threading.Event()
    def one(f):
        if f['path']=='_headers':return None
        url=origin+'/'+urllib.parse.quote(f['path'],safe='/')
        attempt=0;propagation_deadline=None
        while True:
            attempt+=1
            left=deadline-time.monotonic()
            if stopping.is_set() or left<=0:raise TimeoutError('Live verification overall deadline or cancellation reached')
            if propagation_deadline is not None:left=min(left,propagation_deadline-time.monotonic())
            if left<=0:raise AssertionError(f'Live bytes did not converge within {propagation_timeout}s: {f["path"]}')
            code,b,h=public_bytes(url,timeout=min(request_timeout,left))
            actual=digest(b)
            matches=len(b)==f['bytes'] and actual==f['sha256']
            # Static asset edges may briefly retain the previous deployment.
            # Only missing/stale bytes retry; transport errors and 5xx fail fast.
            if code==404 or (code==200 and not matches):
                if propagation_deadline is None:propagation_deadline=min(deadline,time.monotonic()+propagation_timeout)
                remaining=propagation_deadline-time.monotonic()
                if remaining>0:
                    delay=min(retry_delay*2**min(attempt-1,3),remaining)
                    if not stopping.wait(delay) and time.monotonic()<propagation_deadline:continue
                raise AssertionError(f'Live bytes did not converge within {propagation_timeout}s after {attempt} attempts: {f["path"]}; status={code}; expectedBytes={f["bytes"]}; actualBytes={len(b)}; expectedSha256={f["sha256"]}; actualSha256={actual}')
            assert code==200,(f['path'],code)
            assert matches,f'Live bytes differ: {f["path"]}'
            headers={k.lower():v for k,v in h.items()}
            if f['path'].endswith('.html'):assert 'no-transform' in headers.get('cache-control','')
            if branch=='develop':assert 'noindex' in headers.get('x-robots-tag','')
            return {'path':f['path'],'sha256':f['sha256'],'status':code,'attempts':attempt}
    files=inv['files']+[{'path':'.well-known/deployment.json','bytes':len((directory/'.well-known/deployment.json').read_bytes()),'sha256':digest((directory/'.well-known/deployment.json').read_bytes())},{'path':'deployment-inventory.json','bytes':len((directory/'deployment-inventory.json').read_bytes()),'sha256':digest((directory/'deployment-inventory.json').read_bytes())}]
    # Submit at most four requests. executor.map would queue the entire site
    # and wait for that queue even after a failure, defeating the rollback bound.
    results=[];remaining=iter(files)
    pool=concurrent.futures.ThreadPoolExecutor(max_workers=4);pending=set()
    def fill():
        while len(pending)<4:
            try:f=next(remaining)
            except StopIteration:return
            pending.add(pool.submit(one,f))
    try:
        fill()
        while pending:
            left=deadline-time.monotonic()
            if left<=0:raise TimeoutError(f'Live verification exceeded {overall_timeout}s overall deadline')
            done,_=concurrent.futures.wait(pending,timeout=left,return_when=concurrent.futures.FIRST_COMPLETED)
            if not done:raise TimeoutError(f'Live verification exceeded {overall_timeout}s overall deadline')
            # Observe all completed failures before submitting any more work.
            batch=[future.result() for future in done]
            pending.difference_update(done);results.extend(batch);fill()
    finally:
        stopping.set()
        for future in pending:future.cancel()
        pool.shutdown(wait=True,cancel_futures=True)
    return {'status':'passed','verifiedAt':datetime.now(timezone.utc).isoformat(),'sourceCommit':sha,'artifactSha256':m['artifactSha256'],'origin':origin,'filesVerified':sum(r is not None for r in results),'noindex':branch=='develop','tlsVerificationDisabled':False,'externalSiteAvailabilityClaimed':False,'overallDeadlineSeconds':overall_timeout,'requestWallClockDeadlineSeconds':request_timeout,'maxInFlightRequests':4}

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('operation',choices=['guard','finalize','verify-artifact','verify-live','config']);p.add_argument('--branch',required=True,choices=['develop','main']);p.add_argument('--sha',required=True);p.add_argument('--directory',type=Path);p.add_argument('--output',type=Path)
    a=p.parse_args();c=read_config();assert SHA.fullmatch(a.sha)
    if a.operation=='guard':guard(c,a.branch,a.sha);out={'status':'passed','branch':a.branch,'sourceCommit':a.sha}
    elif a.operation=='finalize':out=finalize(c,a.branch,a.sha,a.directory)
    elif a.operation=='verify-artifact':out=validate_artifact(c,a.branch,a.sha,a.directory)[0]
    elif a.operation=='verify-live':out=verify_live(c,a.branch,a.sha,a.directory)
    else:
        out={'name':c['targets'][a.branch]['worker'],'account_id':c['accountId'],'compatibility_date':'2026-11-03','workers_dev':True,'assets':{'directory':str(a.directory.resolve()),'html_handling':'auto-trailing-slash','not_found_handling':'404-page'}}
        if a.branch=='develop':out['previews']={'vars':{}}
    if a.output:a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_bytes(json_bytes(out))
    print(json.dumps(out,sort_keys=True))

if __name__=='__main__':main()
