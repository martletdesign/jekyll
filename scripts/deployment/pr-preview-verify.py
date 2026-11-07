#!/usr/bin/env python3
"""Bounded PR-preview verification. Never invokes a production deployment."""
import argparse
import concurrent.futures
import json
import os
from pathlib import Path
import re
import subprocess
import threading
import time
import urllib.parse

import artifact
from native import parse_preview_output

ROOT=artifact.ROOT

def context():
    c=artifact.read_config()
    assert os.environ.get('GITHUB_REPOSITORY',c['repository'])==c['repository']
    ci=os.environ.get('WORKERS_CI_BRANCH');local=os.environ.get('JEKYLL_DEPLOY_BRANCH')
    assert not(ci and local and ci!=local),'Conflicting native and local branch signals'
    branch=ci or local
    assert branch and branch not in ('main','develop'),'Only isolated feature previews are accepted'
    assert re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._/-]{0,180}',branch) and '..' not in branch and not branch.endswith('/')
    sha=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
    assert artifact.SHA.fullmatch(sha)
    assert not os.environ.get('WORKERS_CI_COMMIT_SHA') or os.environ['WORKERS_CI_COMMIT_SHA']==sha
    subprocess.run(['git','diff','--quiet','HEAD'],cwd=ROOT,check=True,timeout=30)
    import hashlib
    slug=re.sub(r'[^a-z0-9-]+','-',branch.lower()).strip('-')[:12].strip('-')
    name='pr-'+slug+'-'+hashlib.sha256(branch.encode()).hexdigest()[:10]
    assert re.fullmatch(r'pr-[a-z0-9-]{1,40}',name)
    staged=json.loads((ROOT/'.cloudflare-pr-source.json').read_text())
    assert staged=={'branch':branch,'sourceCommit':sha,'previewName':name},'Staged preview identity differs'
    assert (ROOT/'.cloudflare-pr-name').read_text()==name+'\n'
    target=dict(c['targets']['develop'])
    assert len(name+'-'+target['worker'])<=63,'Preview hostname label exceeds DNS limit'
    target.update(previewName=name,origin='https://'+name+'-'+target['worker']+'.k3jph.workers.dev')
    c['targets'][branch]=target
    return c,branch,sha,name

def current_pr_by_git_refs(c,branch,sha,base):
    """Public Git transport fallback if GitHub's anonymous REST access is denied.

    This operates ONLY on isolated, noindex previews, never production.
    Require an exact public branch and a unique GitHub-generated PR merge
    whose parents are the current target branch and exact reviewed head.
    """
    remote='https://github.com/'+c['repository']+'.git'
    patterns=['refs/heads/'+branch,'refs/heads/'+base,'refs/pull/*/head','refs/pull/*/merge']
    result=subprocess.run(['git','ls-remote',remote,*patterns],cwd=ROOT,capture_output=True,text=True,timeout=45,check=True)
    assert len(result.stdout)<1024*1024,'GitHub refs output exceeds bounded allowance'
    refs={}
    for line in result.stdout.splitlines():
        match=re.fullmatch(r'([0-9a-f]{40})\t(refs/(?:heads/[A-Za-z0-9._/-]+|pull/[1-9][0-9]*/(?:head|merge)))',line)
        assert match,'Unexpected GitHub ref output'
        ref=match.group(2)
        assert ref not in refs,'Duplicate GitHub ref'
        refs[ref]=match.group(1)
    assert refs.get('refs/heads/'+branch)==sha,'Remote preview branch no longer matches reviewed HEAD'
    target=refs.get('refs/heads/'+base)
    assert target and artifact.SHA.fullmatch(target),'Missing current GitFlow target branch'
    candidates=[]
    for ref,head in refs.items():
        match=re.fullmatch(r'refs/pull/([1-9][0-9]*)/head',ref)
        if match and head==sha and 'refs/pull/'+match.group(1)+'/merge' in refs:
            candidates.append(int(match.group(1)))
    assert len(candidates)==1,'Expected one exact-head GitHub-generated PR merge ref'
    number=candidates[0]
    merge_ref='refs/pull/'+str(number)+'/merge'
    merge_sha=refs[merge_ref]
    subprocess.run(['git','fetch','--no-tags','--quiet',remote,merge_ref],cwd=ROOT,capture_output=True,text=True,timeout=60,check=True)
    commit=subprocess.run(['git','cat-file','-p','FETCH_HEAD'],cwd=ROOT,capture_output=True,text=True,timeout=15,check=True)
    assert commit.stdout.startswith('tree '),'Expected a GitHub virtual merge commit'
    parents=[line.split(' ',1)[1] for line in commit.stdout.splitlines() if line.startswith('parent ')]
    actual=subprocess.run(['git','rev-parse','FETCH_HEAD'],cwd=ROOT,capture_output=True,text=True,timeout=15,check=True).stdout.strip()
    assert actual==merge_sha and parents==[target,sha],'GitHub PR merge parents must match the current target and source'
    return number

def current_pr(c,branch,sha):
    base='main' if branch.startswith(('release/','hotfix/')) else 'develop'
    try:
        live=artifact.github('repos/'+c['repository']+'/git/ref/heads/'+urllib.parse.quote(branch,safe=''))
        assert live['object']['sha']==sha,'Superseded PR source must not upload'
        prs=artifact.github_list('repos/'+c['repository']+'/pulls?state=open&base='+base+'&head='+urllib.parse.quote(c['repository'].split('/')[0]+':'+branch,safe=''))
        matches=[p for p in prs if p.get('state')=='open' and not p.get('merged_at') and p.get('base',{}).get('ref')==base and p.get('base',{}).get('repo',{}).get('full_name')==c['repository'] and p.get('head',{}).get('repo',{}).get('full_name')==c['repository'] and p.get('head',{}).get('ref')==branch and p.get('head',{}).get('sha')==sha]
        assert len(matches)==1,'An open same-repository PR targeting '+base+' at the exact source SHA must exist before preview upload'
        return matches[0]['number']
    except AssertionError as error:
        denial='Public GitHub verification denied or failed ('
        if not (str(error).startswith(denial) and ('(403)' in str(error) or '(429)' in str(error))):
            raise
        return current_pr_by_git_refs(c,branch,sha,base)

def validate(c,branch,sha,name):
    site=ROOT/'.cloudflare-site'
    m=json.loads((site/'.well-known/deployment.json').read_text())
    assert m['repository']==c['repository'] and m['sourceCommit']==sha and m['branch']==branch
    assert m['sourceTree']==subprocess.check_output(['git','rev-parse',sha+'^{tree}'],cwd=ROOT,text=True).strip()
    assert m['sourceZipSha256']==artifact.digest((site/'template.zip').read_bytes())
    assert m['worker']==c['targets'][branch]['worker'] and m['url']==c['targets'][branch]['origin']
    assert m['deploymentKind']=='isolated-pull-request-preview' and m['previewName']==name
    assert m['runtimeBindings']==[] and m['runtimeSecrets'] is False and m['noindex'] is True and m['advancedArchiveEnabled'] is False
    inv=json.loads((site/'deployment-inventory.json').read_text())
    assert inv['artifactSha256']==m['artifactSha256']==artifact.digest(artifact.json_bytes(inv['files']))
    actual=[f for f in artifact.inventory(site) if f['path'] not in ('.well-known/deployment.json','deployment-inventory.json')]
    assert inv['files']==actual,'PR artifact changed after finalization'
    for required in ('index.html','preview/index.html','template.zip','preview/template.zip','robots.txt','_headers'):
        assert any(f['path']==required for f in actual),required
    assert (site/'robots.txt').read_text()=='User-agent: *\nDisallow: /\n'
    assert '  X-Robots-Tag: noindex, nofollow, noarchive\n' in (site/'_headers').read_text()
    return m,inv

def finalize(c,branch,sha,name):
    site=ROOT/'.cloudflare-site'
    m=artifact.finalize(c,branch,sha,site)
    # Keep actual feature provenance, add the same nonproduction safety headers.
    with (site/'_headers').open('a') as f:f.write('  X-Robots-Tag: noindex, nofollow, noarchive\n')
    (site/'robots.txt').write_text('User-agent: *\nDisallow: /\n')
    files=[f for f in artifact.inventory(site) if f['path'] not in ('.well-known/deployment.json','deployment-inventory.json')]
    m.update(noindex=True,deploymentKind='isolated-pull-request-preview',previewName=name,artifactSha256=artifact.digest(artifact.json_bytes(files)))
    (site/'.well-known/deployment.json').write_bytes(artifact.json_bytes(m))
    (site/'deployment-inventory.json').write_bytes(artifact.json_bytes({'schemaVersion':1,'artifactSha256':m['artifactSha256'],'files':files}))
    validate(c,branch,sha,name)

def verify_live(c,branch,sha,name,*,overall_timeout=300,request_timeout=25):
    m,inv=validate(c,branch,sha,name);site=ROOT/'.cloudflare-site';origin=c['targets'][branch]['origin']
    files=inv['files']+[{'path':p,'bytes':len((site/p).read_bytes()),'sha256':artifact.digest((site/p).read_bytes())} for p in ('.well-known/deployment.json','deployment-inventory.json')]
    deadline=time.monotonic()+overall_timeout;stop=threading.Event()
    def one(f):
        if f['path']=='_headers':return None
        propagation=None;attempt=0
        while True:
            left=deadline-time.monotonic()
            if propagation is not None:left=min(left,propagation-time.monotonic())
            if stop.is_set() or left<=0:raise TimeoutError('PR live verification deadline: '+f['path'])
            attempt+=1
            code,b,h=artifact.public_bytes(origin+'/'+urllib.parse.quote(f['path'],safe='/'),timeout=min(request_timeout,left))
            match=len(b)==f['bytes'] and artifact.digest(b)==f['sha256']
            if code==404 or (code==200 and not match):
                if propagation is None:propagation=min(deadline,time.monotonic()+30)
                delay=min(2**min(attempt-1,3),max(0,propagation-time.monotonic()))
                if delay and not stop.wait(delay):continue
                raise AssertionError('PR live bytes failed to converge: '+f['path'])
            assert code==200 and match,('PR live payload mismatch',f['path'],code)
            h={k.lower():v for k,v in h.items()}
            assert 'noindex' in h.get('x-robots-tag',''),f['path']
            if f['path'].endswith('.html'):assert 'no-transform' in h.get('cache-control',''),f['path']
            return f['path']
    pending=set();remaining=iter(files);count=0
    pool=concurrent.futures.ThreadPoolExecutor(max_workers=4)
    def fill():
        while len(pending)<4:
            try:f=next(remaining)
            except StopIteration:return
            pending.add(pool.submit(one,f))
    try:
        fill()
        while pending:
            left=deadline-time.monotonic()
            assert left>0,'PR live overall deadline reached'
            done,_=concurrent.futures.wait(pending,timeout=left,return_when=concurrent.futures.FIRST_COMPLETED)
            assert done,'PR live overall deadline reached'
            count+=sum(f.result() is not None for f in done);pending.difference_update(done);fill()
    finally:
        stop.set()
        for f in pending:f.cancel()
        pool.shutdown(wait=True,cancel_futures=True)
    return {'status':'passed','filesVerified':count,'artifactSha256':m['artifactSha256'],'origin':origin,'overallDeadlineSeconds':overall_timeout,'requestWallClockDeadlineSeconds':request_timeout,'maxInFlightRequests':4,'tlsVerificationDisabled':False}

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('operation',choices=['finalize','before-upload','record']);a=p.parse_args()
    c,branch,sha,name=context()
    if a.operation=='finalize':finalize(c,branch,sha,name);return
    validate(c,branch,sha,name)
    number=current_pr(c,branch,sha)
    if a.operation=='before-upload':
        cfg={'name':c['targets'][branch]['worker'],'account_id':c['accountId'],'compatibility_date':'2026-11-03','workers_dev':True,'assets':{'directory':str((ROOT/'.cloudflare-site').resolve()),'html_handling':'auto-trailing-slash','not_found_handling':'404-page'},'previews':{'vars':{}}}
        (ROOT/'.cloudflare-wrangler.pr.json').write_bytes(artifact.json_bytes(cfg));return
    path=ROOT/'.cloudflare-pr-result.json';assert path.stat().st_size<=2*1024*1024
    result=parse_preview_output(path.read_text(),expected_name=name)
    assert result['deployment']['annotations'].get('workers/message')==sha
    origin=c['targets'][branch]['origin']
    assert origin in [u.rstrip('/') for u in result['preview']['urls']],'Unexpected named preview origin'
    receipt={'status':'passed','pullRequest':number,'sourceCommit':sha,'sourceBranch':branch,'previewName':name,'previewId':result['preview']['id'],'deploymentId':result['deployment']['id'],'verification':verify_live(c,branch,sha,name),'configuredRuntimeBindings':[],'configuredRuntimeSecrets':False,'deploymentEnvFieldPresent':'env' in result['deployment'],'completeBindingReadbackClaimed':False,'productionDeployInvoked':False,'releasePublicationPerformed':False}
    (ROOT/'.cloudflare-pr-receipt.json').write_bytes(artifact.json_bytes(receipt));print(json.dumps(receipt,sort_keys=True))

if __name__=='__main__':main()
