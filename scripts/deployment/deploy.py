#!/usr/bin/env python3
"""Deploy the verified artifact using an environment's single-Worker token."""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from urllib.parse import quote

sys.path.insert(0,str(Path(__file__).resolve().parent))
from artifact import read_config, guard, validate_artifact, verify_live, request, json_bytes, ROOT

def cf(config, worker, suffix, *, body=None):
    # This helper deliberately exposes only this pinned Worker's endpoints.
    assert suffix in ('/settings','/deployments') or re.fullmatch(r'/versions/[a-f0-9-]{36}',suffix)
    token=os.environ['CLOUDFLARE_API_TOKEN']
    url=f"https://api.cloudflare.com/client/v4/accounts/{config['accountId']}/workers/scripts/{quote(worker,safe='')}{suffix}"
    code,b,_=request(url,data=json_bytes(body) if body is not None else None,headers={'Authorization':'Bearer '+token,'Content-Type':'application/json','User-Agent':'JekyllGitFlowDeployment'})
    payload=json.loads(b)
    assert code==200 and payload.get('success'),f'Cloudflare {suffix} denied or failed ({code})'
    return payload['result']

def active(config,worker):
    d=cf(config,worker,'/deployments')['deployments']
    assert d and len(d[0]['versions'])==1 and d[0]['versions'][0]['percentage']==100,'Unexpected split deployment; inspect before changing it'
    version_id=d[0]['versions'][0]['version_id'];version=cf(config,worker,'/versions/'+version_id)
    annotations=version.get('annotations',version.get('metadata',{}).get('annotations',{}))
    return {'deploymentId':d[0]['id'],'versionId':version_id,'sourceMessage':annotations.get('workers/message')}

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--branch',required=True,choices=['main']);p.add_argument('--sha',required=True);p.add_argument('--directory',required=True,type=Path);p.add_argument('--receipt',required=True,type=Path);a=p.parse_args()
    c=read_config();t=c['targets'][a.branch];worker=t['worker'];guard(c,a.branch,a.sha)
    metadata,_=validate_artifact(c,a.branch,a.sha,a.directory)
    assert cf(c,worker,'/settings')['bindings']==[],'Unexpected runtime bindings; refuse to replace deployment'
    before=active(c,worker)
    receipt={'schemaVersion':1,'repository':c['repository'],'branch':a.branch,'sourceCommit':a.sha,'artifactSha256':metadata['artifactSha256'],'worker':worker,'url':t['origin'],'previousDeployment':before,'startedAt':datetime.now(timezone.utc).isoformat(),'status':'running'}
    def save():a.receipt.parent.mkdir(parents=True,exist_ok=True);a.receipt.write_bytes(json_bytes(receipt))
    save();config=a.receipt.parent/'wrangler.generated.json'
    subprocess.run(['python3','scripts/deployment/artifact.py','config','--branch',a.branch,'--sha',a.sha,'--directory',str(a.directory),'--output',str(config)],cwd=ROOT,check=True,timeout=30,stdout=subprocess.DEVNULL)
    published=None
    try:
        # Check the branch again immediately before the only publishing command.
        guard(c,a.branch,a.sha)
        cli=ROOT/'infra/deployment/node_modules/wrangler/bin/wrangler.js'
        command=['node',str(cli),'deploy','--config',str(config),'--message',f"{c['repository']} {a.branch} {a.sha}",'--keep-vars']
        completed=subprocess.run(command,cwd=ROOT,check=False,timeout=300)
        observed=active(c,worker)
        if observed!=before and observed.get('sourceMessage')==f"{c['repository']} {a.branch} {a.sha}":published=observed
        receipt['deployment']=observed;receipt['wranglerExitCode']=completed.returncode;save()
        assert completed.returncode==0,'Wrangler did not complete successfully'
        assert published is not None,'The new source version was not observed; inspect or restore our own failed replacement'
        assert cf(c,worker,'/settings')['bindings']==[],'Runtime authority changed unexpectedly'
        receipt['liveVerification']=verify_live(c,a.branch,a.sha,a.directory)
        receipt['status']='passed';receipt['deployedAt']=datetime.now(timezone.utc).isoformat();save()
        summary=os.environ.get('GITHUB_STEP_SUMMARY')
        if summary:
            with open(summary,'a') as f:f.write(f"## Verified Jekyll deployment\n\n- Repository: `{c['repository']}`\n- Branch: `{a.branch}`\n- Commit: `{a.sha}`\n- Build: passed\n- Artifact SHA-256: `{metadata['artifactSha256']}`\n- Worker version: `{published['versionId']}`\n- Deployment: `{published['deploymentId']}`\n- URL: {t['origin']}\n- Time: {receipt['deployedAt']}\n- Live files verified: {receipt['liveVerification']['filesVerified']}\n")
        print(json.dumps(receipt,sort_keys=True))
    except BaseException as error:
        receipt['status']='failed';receipt['error']=f'{type(error).__name__}: {error}';save()
        # Only roll back our own failed replacement. Never overwrite another actor.
        try:
            current=active(c,worker)
            own_version=current.get('sourceMessage')==f"{c['repository']} {a.branch} {a.sha}"
            if current!=before and own_version and (published is None or current==published):
                cf(c,worker,'/deployments',body={'strategy':'percentage','versions':[{'version_id':before['versionId'],'percentage':100}],'annotations':{'workers/message':f"Rollback failed Jekyll verification for {a.sha}"}})
                restored=active(c,worker);assert restored['versionId']==before['versionId']
                receipt['rollback']={'status':'restored','deployment':restored}
            else:receipt['rollback']={'status':'not-needed-or-newer-actor-preserved'}
        except Exception as rollback_error:
            receipt['rollback']={'status':'failed','error':f'{type(rollback_error).__name__}: {rollback_error}'}
        save();raise

if __name__=='__main__':main()
