#!/usr/bin/env python3
"""Cloudflare Workers Builds commands: verified build, then exact static deploy."""
import argparse
import json
import re
import os
from pathlib import Path
import subprocess
import sys
import shutil

sys.path.insert(0,str(Path(__file__).resolve().parent))
from artifact import ROOT, finalize, digest, guard, github, github_list, json_bytes, read_config

REQUIRED_CHECKS={'verify','browser (chromium)','browser (firefox)','browser (webkit)','guard','archive-build'}

def verified_checks(checks):
    latest={}
    for check in sorted(checks,key=lambda r:r.get('id',0)):
        if check.get('app',{}).get('slug')=='github-actions':latest[check.get('name')]=check
    return all(name in latest and latest[name].get('status')=='completed' and latest[name].get('conclusion')=='success' for name in REQUIRED_CHECKS)

def source_verification(c,branch,sha):
    # Merge commit identity may differ from the PR head. Accept only an exactly
    # identical source tree already checked by all existing required test jobs.
    tree=subprocess.check_output(['git','rev-parse',sha+'^{tree}'],cwd=ROOT,text=True).strip()
    prs=github_list(f"repos/{c['repository']}/commits/{sha}/pulls")
    for pr in prs:
        if not(pr.get('merged_at') and pr.get('merge_commit_sha')==sha and pr.get('base',{}).get('ref')==branch):continue
        head=pr.get('head',{}).get('sha');assert head
        remote=github(f"repos/{c['repository']}/git/commits/{head}")
        if remote['tree']['sha']!=tree:continue
        checks=github(f"repos/{c['repository']}/commits/{head}/check-runs?per_page=100")
        if verified_checks(checks['check_runs']):
            return {'pullRequest':pr['number'],'checkedCommit':head,'sourceTree':tree,'exactTreeMatch':True,'checks':sorted(REQUIRED_CHECKS),'browserMatrix':'Chromium, Firefox, WebKit; all 50 recipes/root/subpath/JavaScript on and off'}
    raise AssertionError('No merged PR has this exact source tree and all existing successful GitHub test checks')

def run(args,timeout=300):subprocess.run(args,cwd=ROOT,check=True,timeout=timeout)

MAX_PREVIEW_OUTPUT_BYTES=2*1024*1024

def parse_preview_output(raw):
    """Parse one final JSON object after Wrangler's human asset-upload log."""
    assert isinstance(raw,str) and len(raw.encode('utf-8'))<=MAX_PREVIEW_OUTPUT_BYTES,'Preview output exceeds the bounded reporting limit'
    first=re.search(r'(?m)^[ \t]*([\{\[])',raw)
    assert first,'Wrangler did not emit a final Preview JSON object'
    try:data,end=json.JSONDecoder().raw_decode(raw,first.start(1))
    except json.JSONDecodeError as error:raise ValueError('Malformed final Wrangler Preview JSON') from error
    assert not raw[end:].strip(),'Unexpected trailing output or multiple JSON payloads'
    assert isinstance(data,dict) and set(data)=={'preview','deployment'},'Unexpected final Preview report schema'
    preview,deployment=data['preview'],data['deployment']
    assert isinstance(preview,dict) and isinstance(deployment,dict)
    assert isinstance(preview.get('id'),str) and re.fullmatch(r'[a-f0-9]{32}',preview['id'])
    assert preview.get('name')=='develop' and preview.get('slug')=='develop'
    assert isinstance(deployment.get('id'),str) and re.fullmatch(r'[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}',deployment['id'])
    assert isinstance(deployment.get('number'),int) and deployment['number']>=0
    assert isinstance(deployment.get('created_on'),str) and deployment['created_on']
    assert isinstance(deployment.get('main_module'),str) and deployment['main_module']
    assert isinstance(deployment.get('annotations'),dict)
    for item in (preview,deployment):
        assert isinstance(item.get('urls'),list) and item['urls']
        assert all(isinstance(url,str) and url.startswith('https://') for url in item['urls'])
    # Empty env may be omitted by this API. Absence is NOT a binding readback.
    if 'env' in deployment:assert deployment['env']=={},'Unexpected Preview runtime variables, secrets or bindings'
    return data

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('operation',choices=['stage','finalize','verify','record']);p.add_argument('--branch',required=True,choices=['develop','main']);a=p.parse_args()
    c=read_config();sha=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip();guard(c,a.branch,sha)
    state=ROOT/'.native-deployment-state.json';directory=ROOT/'.cloudflare-site'
    if a.operation=='stage':
        assert not state.exists() and not (ROOT/'.cloudflare-source').exists() and not directory.exists(),'Never reuse a previous native build'
        evidence=source_verification(c,a.branch,sha)
        run(['python3','-m','unittest','discover','-s','tests','-p','test_deployment.py'],120)
        run(['python3','-m','unittest','discover','-s','tests','-p','test_hero.py'],120)
        entries=json.loads((ROOT/'nightjar/source-files.json').read_text());assert entries and len(entries)==len(set(entries));inputs=[]
        for entry in entries:
            relative=Path(entry);assert not relative.is_absolute() and '..' not in relative.parts and str(relative)==entry
            source=ROOT
            for part in relative.parts:source=source/part;assert not source.is_symlink()
            assert source.is_file();target=ROOT/'.cloudflare-source'/relative;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,target)
            inputs.append({'path':entry,'sha256':digest(source.read_bytes())})
        (ROOT/'.cloudflare-source-inputs.json').write_bytes(json_bytes(inputs))
        (ROOT/'.cloudflare-render.yml').write_text('source_archive: true\n')
        state.write_bytes(json_bytes({'branch':a.branch,'sourceCommit':sha,'directory':str(directory),'sourceVerification':evidence}))
        print(json.dumps({'status':'source-staged-and-verified','sourceVerification':evidence},sort_keys=True))
    elif a.operation=='finalize':
        data=json.loads(state.read_text());assert data['branch']==a.branch and data['sourceCommit']==sha
        metadata=finalize(c,a.branch,sha,directory)
        data['artifactSha256']=metadata['artifactSha256'];state.write_bytes(json_bytes(data))
        run(['npm','ci','--prefix','infra/deployment','--ignore-scripts','--no-audit','--no-fund'])
        run(['python3','scripts/deployment/artifact.py','config','--branch',a.branch,'--sha',sha,'--directory',str(directory),'--output',str(ROOT/('.cloudflare-wrangler.'+a.branch+'.json'))],30)
        print(json.dumps({'status':'prebuilt-jekyll-artifact-verified','sourceCommit':sha,'artifactSha256':metadata['artifactSha256']},sort_keys=True))
    elif a.operation=='verify':
        from artifact import validate_artifact
        validate_artifact(c,a.branch,sha,directory)
        print(json.dumps({'status':'verified-before-wrangler','sourceCommit':sha},sort_keys=True))
    else:
        from artifact import verify_live
        raw_path=ROOT/'.cloudflare-preview-result.json';assert raw_path.stat().st_size<=MAX_PREVIEW_OUTPUT_BYTES,'Preview output exceeds the bounded reporting limit'
        data=parse_preview_output(raw_path.read_text());assert a.branch=='develop','Production must use reviewed deployment verification and rollback helper'
        (ROOT/'.cloudflare-preview-parsed.json').write_bytes(json_bytes(data))
        preview=data['preview'];deployment=data['deployment'];assert preview['name']=='develop' and preview['slug']=='develop' and deployment.get('env',{})=={}
        result=verify_live(c,a.branch,sha,directory)
        receipt={'status':'passed','repository':c['repository'],'branch':a.branch,'sourceCommit':sha,'worker':c['targets'][a.branch]['worker'],'previewId':preview['id'],'deploymentId':deployment['id'],'deployedAt':deployment['created_on'],'artifactSha256':result['artifactSha256'],'previewUrls':preview.get('urls'),'deploymentUrls':deployment.get('urls'),'configuredRuntimeBindings':[],'configuredRuntimeSecrets':False,'runtimeBindingEvidence':{'baseConfigIgnored':True,'deploymentEnvFieldPresent':'env' in deployment,'completeBindingReadbackClaimed':False},'productionDeployInvoked':False,'verification':result}
        (ROOT/'.cloudflare-deployment-receipt.json').write_bytes(json_bytes(receipt));print('NATIVE_DEPLOYMENT_RECEIPT '+json.dumps(receipt,sort_keys=True))

if __name__=='__main__':main()
