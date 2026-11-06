"""Deployment boundaries and immutable artifact checks; no network or secrets."""
import importlib.util
import json
import os
import subprocess
from pathlib import Path
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('deployment_artifact',ROOT/'scripts/deployment/artifact.py')
artifact=importlib.util.module_from_spec(spec);spec.loader.exec_module(artifact)

class DeploymentTests(unittest.TestCase):
    def test_conflicting_native_and_local_branch_signals_fail_before_build_or_deploy(self):
        for name in ['build-cloudflare.sh','deploy-cloudflare.sh']:
            for native,override in [('develop','main'),('main','develop')]:
                with self.subTest(script=name,native=native,override=override):
                    env={**os.environ,'WORKERS_CI_BRANCH':native,'JEKYLL_DEPLOY_BRANCH':override}
                    result=subprocess.run(['bash',str(ROOT/'scripts/deployment'/name)],cwd=ROOT,env=env,capture_output=True,text=True,timeout=10)
                    self.assertEqual(result.returncode,1)
                    self.assertIn('Conflicting native and local GitFlow branch signals',result.stderr)

    def test_pr_preview_is_separate_from_protected_deployments(self):
        build=(ROOT/'scripts/deployment/build-cloudflare.sh').read_text()
        preview=(ROOT/'scripts/deployment/preview-cloudflare.sh').read_text()
        pr=(ROOT/'scripts/deployment/pr-preview-cloudflare.sh').read_text()
        self.assertIn('pr-preview-source.py',build)
        self.assertIn('PR_PREVIEW_ONLY:',build)
        self.assertIn('pr-preview-cloudflare.sh',preview)
        self.assertIn('exec bash scripts/deployment/pr-preview-cloudflare.sh',preview)
        self.assertIn('--ignore-base-config',pr)
        self.assertNotIn('deploy-cloudflare.sh',pr)
        self.assertNotIn('native.py record',pr)
        for script in ['build-cloudflare.sh','preview-cloudflare.sh','pr-preview-cloudflare.sh']:
            p=ROOT/'scripts/deployment'/script
            result=subprocess.run(['bash','-n',str(p)],capture_output=True,text=True)
            self.assertEqual(result.returncode,0,result.stderr)
        env={**os.environ,'WORKERS_CI_BRANCH':'main'}
        env.pop('JEKYLL_DEPLOY_BRANCH',None)
        denied=subprocess.run(['bash',str(ROOT/'scripts/deployment/preview-cloudflare.sh')],
                              env=env,capture_output=True,text=True,timeout=10)
        self.assertNotEqual(denied.returncode,0)
        self.assertIn('Production cannot use a Preview command',denied.stderr)

    def test_only_reviewed_gitflow_promotion_shape(self):
        sha='a'*40
        good={'merged_at':'2026-11-03T00:00:00Z','merge_commit_sha':sha,'base':{'ref':'main'},'head':{'ref':'release/hero','sha':sha},'user':{'login':'author'}}
        reviews=[{'id':1,'state':'APPROVED','user':{'login':'reviewer'},'commit_id':sha}]
        self.assertTrue(artifact.promotion_ok(good,sha,reviews))
        for head in ['feature/hero','main','anything']:
            self.assertFalse(artifact.promotion_ok({**good,'head':{'ref':head,'sha':sha}},sha,reviews))
        self.assertFalse(artifact.promotion_ok({**good,'merged_at':None},sha,reviews))
        self.assertFalse(artifact.promotion_ok(good,'b'*40,reviews))
        self.assertFalse(artifact.promotion_ok({**good,'base':{'ref':'develop'}},sha,reviews))
        self.assertFalse(artifact.promotion_ok(good,sha,[]))
        self.assertFalse(artifact.promotion_ok(good,sha,[{**reviews[0],'commit_id':'b'*40}]))
        self.assertFalse(artifact.promotion_ok(good,sha,reviews+[{'id':2,'state':'CHANGES_REQUESTED','user':{'login':'reviewer'}}]))

    def test_artifact_rejects_tampering_and_wrong_commit(self):
        c=artifact.read_config(ROOT);sha='a'*40
        with tempfile.TemporaryDirectory() as temp:
            d=Path(temp);(d/'index.html').write_text('reviewed bytes')
            files=artifact.inventory(d);h=artifact.digest(artifact.json_bytes(files))
            (d/'.well-known').mkdir()
            m={'repository':c['repository'],'branch':'develop','sourceCommit':sha,'worker':c['targets']['develop']['worker'],'url':c['targets']['develop']['origin'],'artifactSha256':h,'advancedArchiveEnabled':False,'runtimeBindings':[],'runtimeSecrets':False,'noindex':True}
            (d/'.well-known/deployment.json').write_bytes(artifact.json_bytes(m))
            (d/'deployment-inventory.json').write_bytes(artifact.json_bytes({'artifactSha256':h,'files':files}))
            artifact.validate_artifact(c,'develop',sha,d)
            with self.assertRaises(AssertionError):artifact.validate_artifact(c,'develop','b'*40,d)
            with self.assertRaises(AssertionError):artifact.validate_artifact(c,'main',sha,d)
            (d/'index.html').write_text('tampered bytes')
            with self.assertRaises(AssertionError):artifact.validate_artifact(c,'develop',sha,d)

    def test_frozen_history_has_exact_pinned_bytes_and_no_extra_paths(self):
        with tempfile.TemporaryDirectory() as temp:
            d=Path(temp);(d/'page').write_bytes(b'old immutable bytes')
            files=artifact.inventory(d);lock={'files':files}
            artifact.verify_history(d,lock)
            (d/'page').write_bytes(b'new bytes')
            with self.assertRaises(AssertionError):artifact.verify_history(d,lock)
            (d/'page').write_bytes(b'old immutable bytes');(d/'extra').write_bytes(b'unreviewed')
            with self.assertRaises(AssertionError):artifact.verify_history(d,lock)

    def test_symlinks_never_enter_payload(self):
        with tempfile.TemporaryDirectory() as temp:
            d=Path(temp);(d/'outside').write_text('sensitive synthetic data');(d/'alias').symlink_to(d/'outside')
            with self.assertRaises(AssertionError):artifact.inventory(d)


# Real HTTP faults prove bounded verification and rollback without Cloudflare writes.
import contextlib,hashlib,http.server,pathlib,subprocess,sys,threading,time
from unittest.mock import patch
sys.modules['artifact']=artifact
spec=importlib.util.spec_from_file_location('deployment_with_bounds',ROOT/'scripts/deployment/deploy.py')
deploy=importlib.util.module_from_spec(spec);spec.loader.exec_module(deploy)
REPORT=[]

@contextlib.contextmanager
def fixture(mode, count=500):
 with tempfile.TemporaryDirectory() as temp:
  directory=pathlib.Path(temp);(directory/'.well-known').mkdir();(directory/'.well-known/deployment.json').write_text('{}');(directory/'deployment-inventory.json').write_text('{}')
  paths=['fail.bin']+[f'stall-{i}.bin' for i in range(count)] if mode=='failure' else [f'stall-{i}.bin' for i in range(count)]
  if mode=='success':paths=['index.html','asset.bin']
  files=[{'path':p,'bytes':2,'sha256':hashlib.sha256(b'{}').hexdigest()} for p in paths]
  calls=[]
  class Handler(http.server.BaseHTTPRequestHandler):
   def log_message(self,*args):pass
   def do_GET(self):
    calls.append(self.path)
    if mode=='failure' and self.path=='/fail.bin':
     self.send_response(503);self.end_headers();self.wfile.write(b'no');return
    if mode!='success':time.sleep(.75)
    self.send_response(200);self.send_header('Content-Type','text/html' if self.path.endswith('.html') else 'application/octet-stream');self.send_header('Cache-Control','public, no-transform');self.send_header('X-Robots-Tag','noindex');self.send_header('Content-Length','2');self.end_headers()
    try:self.wfile.write(b'{}')
    except (BrokenPipeError,ConnectionResetError):pass
  server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler);server.daemon_threads=True;thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
  c={'targets':{'develop':{'origin':f'http://127.0.0.1:{server.server_port}'}}}
  try:
   with patch.object(artifact,'validate_artifact',return_value=({'artifactSha256':'fixture-only'}, {'files':files})):
    yield directory,c,calls
  finally:server.shutdown();server.server_close();thread.join(timeout=1)

class BoundsTests(unittest.TestCase):
 def test_first_failure_does_not_wait_for_500_queued_assets(self):
  with fixture('failure') as (d,c,calls):
   started=time.monotonic()
   with self.assertRaises((AssertionError,TimeoutError)):artifact.verify_live(c,'develop','a'*40,d,overall_timeout=.2,request_timeout=.35)
   elapsed=time.monotonic()-started;self.assertLess(elapsed,1.5);self.assertLessEqual(len(calls),4)
   REPORT.append({'case':'first503 with500stalledpendingassets','result':'rejected','elapsedSeconds':round(elapsed,3),'requestsStarted':len(calls),'maxRequests':4})
 def test_overall_deadline_stops_submission_and_inflight_requests_are_bounded(self):
  with fixture('stall') as (d,c,calls):
   started=time.monotonic()
   with self.assertRaises(TimeoutError):artifact.verify_live(c,'develop','a'*40,d,overall_timeout=.1,request_timeout=.35)
   elapsed=time.monotonic()-started;self.assertLess(elapsed,1.5);self.assertLessEqual(len(calls),4)
   REPORT.append({'case':'overall100ms with500stalledassets','result':'deadlinefailed','elapsedSeconds':round(elapsed,3),'requestsStarted':len(calls),'requestWallClockSeconds':.35})
 def test_real_bytes_headers_and_manifest_checks_still_pass(self):
  with fixture('success') as (d,c,calls):
   result=artifact.verify_live(c,'develop','a'*40,d,overall_timeout=3,request_timeout=1)
   self.assertEqual(result['status'],'passed');self.assertEqual(result['filesVerified'],4);self.assertEqual(len(calls),4)
   REPORT.append({'case':'real payload plusbothmanifestfiles/noindex/no-transform','result':'passed','filesVerified':4})
 def test_rollback_observes_own_new_version_after_initial_read_lag(self):
  sha='a'*40;message='martletdesign/jekyll main '+sha
  before={'deploymentId':'old-deploy','versionId':'old-version','sourceMessage':'old'}
  own={'deploymentId':'our-deploy','versionId':'our-version','sourceMessage':message}
  restored={'deploymentId':'rollback-deploy','versionId':'old-version','sourceMessage':'old'}
  c={'repository':'martletdesign/jekyll','targets':{'main':{'worker':'martletdesign-jekyll-reference','origin':'https://jekyll.martletdesign.dev'}}}
  with tempfile.TemporaryDirectory() as temp:
   d=pathlib.Path(temp);receipt=d/'receipt.json';cf_calls=[]
   def cf(*args,**kwargs):
    cf_calls.append((args,kwargs));return {'bindings':[]}
   with patch.object(deploy,'read_config',return_value=c),patch.object(deploy,'guard'),patch.object(deploy,'validate_artifact',return_value=({'artifactSha256':'fixture'},{})),patch.object(deploy,'cf',side_effect=cf),patch.object(deploy,'active',side_effect=[before,before,own,restored]),patch.object(deploy.subprocess,'run',return_value=subprocess.CompletedProcess([],0)),patch.object(sys,'argv',['deploy.py','--branch','main','--sha',sha,'--directory',temp,'--receipt',str(receipt)]):
    with self.assertRaises(AssertionError):deploy.main()
   result=json.loads(receipt.read_text());self.assertEqual(result['status'],'failed');self.assertEqual(result['rollback']['status'],'restored');self.assertEqual(result['rollback']['deployment']['versionId'],'old-version');self.assertTrue(any(call[1].get('body',{}).get('versions')==[{'version_id':'old-version','percentage':100}] for call in cf_calls))
   REPORT.append({'case':'before,before,ownnew API readlag','result':'failedverificationrestoresoldversion','rollback':'restored'})



class PreviewOutputTests(unittest.TestCase):
    def parser(self):
        spec=importlib.util.spec_from_file_location('native_output_reporting',ROOT/'scripts/deployment/native.py')
        module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
        return module
    def payload(self):
        return {'preview':{'id':'1'*32,'name':'develop','slug':'develop','urls':['https://develop-example.k3jph.workers.dev']},'deployment':{'id':'22222222-2222-2222-2222-222222222222','number':1,'created_on':'2026-11-03T13:45:00Z','main_module':'no-op-worker.js','annotations':{},'urls':['https://deployment-example.k3jph.workers.dev']}}
    def test_actual_upload_log_shape_and_absent_optional_env(self):
        module=self.parser();data=self.payload();raw='🌀 Building list of assets...\n+ /index.html\n✨ Success! Uploaded 12 files\n\n'+json.dumps(data,indent=2)+'\n'
        self.assertEqual(module.parse_preview_output(raw),data)
        self.assertEqual(module.parse_preview_output(json.dumps(data)),data)
        self.assertNotIn('env',data['deployment'])
    def test_malformed_json_and_missing_required_fields_fail(self):
        module=self.parser()
        for raw in ['upload only without JSON','upload\n{not-json',json.dumps({'preview':{}}),json.dumps([])]:
            with self.assertRaises((AssertionError,ValueError)):module.parse_preview_output(raw)
        data=self.payload();del data['deployment']['id']
        with self.assertRaises(AssertionError):module.parse_preview_output(json.dumps(data))
    def test_trailing_output_and_multiple_json_payloads_fail(self):
        module=self.parser();valid=json.dumps(self.payload())
        for raw in [valid+'\n'+valid,valid+'\n[]',valid+'\nnot-json',json.dumps({'diagnostic':True})+'\n'+valid]:
            with self.assertRaises((AssertionError,ValueError)):module.parse_preview_output(raw)
    def test_oversized_report_and_unexpected_runtime_env_fail(self):
        module=self.parser()
        with self.assertRaises(AssertionError):module.parse_preview_output('x'*(module.MAX_PREVIEW_OUTPUT_BYTES+1))
        data=self.payload();data['deployment']['env']={'unexpected':{'type':'plain_text','text':'synthetic'}}
        with self.assertRaises(AssertionError):module.parse_preview_output(json.dumps(data))

class CloudflareBuildMetadataTests(unittest.TestCase):
    def test_local_manual_build_has_no_native_build_claim(self):
        self.assertIsNone(artifact.cloudflare_build_metadata('develop','a'*40,{}))
    def test_native_fields_are_validated_and_secrets_never_copied(self):
        values={'WORKERS_CI_BUILD_UUID':'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','WORKERS_CI_COMMIT_SHA':'a'*40,'WORKERS_CI_BRANCH':'develop','CLOUDFLARE_API_TOKEN':'private-synthetic-value','WORKERS_CI':'not-required'}
        result=artifact.cloudflare_build_metadata('develop','a'*40,values)
        self.assertEqual(result['buildUuid'],values['WORKERS_CI_BUILD_UUID']);self.assertEqual(result['commitSha'],'a'*40);self.assertEqual(result['branch'],'develop');self.assertIs(result['independentAttestationClaimed'],False)
        self.assertNotIn('private-synthetic-value',json.dumps(result));self.assertNotIn('WORKERS_CI',result)
    def test_mismatched_or_malformed_reported_values_fail(self):
        valid={'WORKERS_CI_BUILD_UUID':'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','WORKERS_CI_COMMIT_SHA':'a'*40,'WORKERS_CI_BRANCH':'develop'}
        for key,value in [('WORKERS_CI_BUILD_UUID','not-a-uuid'),('WORKERS_CI_COMMIT_SHA','b'*40),('WORKERS_CI_COMMIT_SHA','not-a-hash'),('WORKERS_CI_BRANCH','main')]:
            with self.assertRaises(AssertionError):artifact.cloudflare_build_metadata('develop','a'*40,{**valid,key:value})
        with self.assertRaises(AssertionError):artifact.cloudflare_build_metadata('develop','a'*40,{'WORKERS_CI_COMMIT_SHA':'b'*40})


# Actual HTTP stale-edge behavior; no Cloudflare writes.
import collections
class PropagationTests(unittest.TestCase):
 def check(self,mode):
  calls=collections.Counter()
  class Handler(http.server.BaseHTTPRequestHandler):
   def log_message(self,*args):pass
   def do_GET(self):
    calls[self.path]+=1;n=calls[self.path];code=200;body=b'{}'
    if self.path=='/asset.bin':
     if mode=='stale' and n==1:body=b'old'
     if mode=='missing' and n==1:code=404
     if mode=='permanent':body=b'bad'
     if mode=='503':code=503
    self.send_response(code);self.send_header('X-Robots-Tag','noindex');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
  server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler);server.daemon_threads=True;t=threading.Thread(target=server.serve_forever,daemon=True);t.start()
  try:
   with tempfile.TemporaryDirectory() as tmp:
    d=pathlib.Path(tmp);(d/'.well-known').mkdir();(d/'.well-known/deployment.json').write_bytes(b'{}');(d/'deployment-inventory.json').write_bytes(b'{}')
    files=[{'path':'asset.bin','bytes':2,'sha256':artifact.digest(b'{}')}];c={'targets':{'develop':{'origin':f'http://127.0.0.1:{server.server_port}'}}}
    with patch.object(artifact,'validate_artifact',return_value=({'artifactSha256':'fixture'},{'files':files})):
     start=time.monotonic()
     if mode in ('permanent','503'):
      with self.assertRaises(AssertionError) as error:artifact.verify_live(c,'develop','a'*40,d,propagation_timeout=.3,retry_delay=.01)
      if mode=='permanent':self.assertIn('did not converge within 0.3s',str(error.exception));self.assertIn('actualSha256=',str(error.exception))
     else:self.assertEqual(artifact.verify_live(c,'develop','a'*40,d,propagation_timeout=.3,retry_delay=.01)['filesVerified'],3)
     elapsed=time.monotonic()-start
     self.assertGreaterEqual(calls['/asset.bin'],3) if mode=='permanent' else self.assertEqual(calls['/asset.bin'],1 if mode=='503' else 2)
     self.assertLess(elapsed,3 if mode!='503' else .5)
     print(mode,round(elapsed,3),dict(calls))
  finally:server.shutdown();server.server_close();t.join(timeout=1)
 def test_stale_then_current(self):self.check('stale')
 def test_missing_then_current(self):self.check('missing')
 def test_permanent_corruption_fails(self):self.check('permanent')
 def test_503_fails_without_retry(self):self.check('503')

class ReleasePreviewTargetTests(unittest.TestCase):
    """PR previews respect GitFlow's exact target branch without main deployment."""
    def verifier(self):
        import types
        with patch.dict(sys.modules,{'native':types.SimpleNamespace(parse_preview_output=lambda value:value)}):
            spec=importlib.util.spec_from_file_location('isolated_preview_target',ROOT/'scripts/deployment/pr-preview-verify.py')
            module=importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
        return module

    def test_feature_release_and_hotfix_have_only_their_gitflow_target(self):
        verifier=self.verifier();repo=json.loads((ROOT/'release-policy.json').read_text())['authority']
        c={'repository':repo};sha='a'*40
        for branch,expected_base in [('feature/readability','develop'),('fix/contrast','develop'),
                                     ('release/1.1.0','main'),('hotfix/1.0.1','main')]:
            for actual_base in ['develop','main']:
                pr={'number':42,'state':'open','merged_at':None,
                    'base':{'ref':actual_base,'repo':{'full_name':repo}},
                    'head':{'ref':branch,'sha':sha,'repo':{'full_name':repo}}}
                with self.subTest(branch=branch,base=actual_base):
                    with patch.object(artifact,'github',return_value={'object':{'sha':sha}}),patch.object(artifact,'github_list',return_value=[pr]) as listing:
                        if actual_base==expected_base:
                            self.assertEqual(verifier.current_pr(c,branch,sha),42)
                        else:
                            with self.assertRaisesRegex(AssertionError,'exact source SHA'):
                                verifier.current_pr(c,branch,sha)
                        self.assertIn('base='+expected_base,listing.call_args.args[0])

    def test_preview_rejects_stale_sha_or_foreign_repository(self):
        verifier=self.verifier();repo=json.loads((ROOT/'release-policy.json').read_text())['authority']
        c={'repository':repo};sha='a'*40;branch='release/1.1.0'
        pr={'number':42,'state':'open','merged_at':None,
            'base':{'ref':'main','repo':{'full_name':repo}},
            'head':{'ref':branch,'sha':sha,'repo':{'full_name':'untrusted/jekyll'}}}
        with patch.object(artifact,'github',return_value={'object':{'sha':sha}}),patch.object(artifact,'github_list',return_value=[pr]):
            with self.assertRaises(AssertionError):verifier.current_pr(c,branch,sha)
        with patch.object(artifact,'github',return_value={'object':{'sha':'b'*40}}),patch.object(artifact,'github_list') as listing:
            with self.assertRaisesRegex(AssertionError,'Superseded'):
                verifier.current_pr(c,branch,sha)
            listing.assert_not_called()



class CleanTrackedSourceGateTests(unittest.TestCase):
    """Production provenance must reject modifications in either Git index or worktree."""
    def test_clean_staged_and_unstaged_source(self):
        spec=importlib.util.spec_from_file_location('native_clean_source',ROOT/'scripts/deployment/native.py')
        native=importlib.util.module_from_spec(spec);spec.loader.exec_module(native)
        with tempfile.TemporaryDirectory() as directory:
            work=Path(directory)
            def git(*args):
                subprocess.run(['git','-C',str(work),*args],check=True,stdout=subprocess.DEVNULL)
            git('init','-q')
            tracked=work/'tracked.txt';tracked.write_text('reviewed\n')
            git('add','tracked.txt')
            git('-c','user.name=CI Test','-c','user.email=ci@example.invalid','commit','-qm','baseline')
            with patch.object(native,'ROOT',work):
                native.require_clean_tracked_checkout()
                tracked.write_text('different\n')
                with self.assertRaises(subprocess.CalledProcessError):
                    native.require_clean_tracked_checkout()
                git('add','tracked.txt')
                with self.assertRaises(subprocess.CalledProcessError):
                    native.require_clean_tracked_checkout()
        self.assertIn("['git','diff','--quiet','HEAD']", (ROOT/'scripts/deployment/artifact.py').read_text())

if __name__=='__main__':unittest.main()
