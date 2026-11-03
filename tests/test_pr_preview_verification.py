"""PR preview safety gates and real HTTP verification; never uploads."""
import copy
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import http.server
import unittest
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts/deployment'))
spec=importlib.util.spec_from_file_location('prverify',ROOT/'scripts/deployment/pr-preview-verify.py')
pr=importlib.util.module_from_spec(spec);spec.loader.exec_module(pr)

class PrPreviewTests(unittest.TestCase):
 def test_open_same_repository_pr_exact_head_and_develop_required(self):
  repo='martletdesign/jekyll';sha='a'*40;branch='feature/example';c={'repository':repo}
  good={'number':90,'state':'open','merged_at':None,'base':{'ref':'develop','repo':{'full_name':repo}},'head':{'ref':branch,'sha':sha,'repo':{'full_name':repo}}}
  with patch.object(pr.artifact,'github',return_value={'object':{'sha':sha}}),patch.object(pr.artifact,'github_list',return_value=[good]):self.assertEqual(pr.current_pr(c,branch,sha),90)
  for modify in [('state','closed'),('head.sha','b'*40),('head.repo.full_name','attacker/fork'),('base.ref','main'),('head.ref','feature/other')]:
   bad=copy.deepcopy(good);obj=bad;parts=modify[0].split('.')
   for key in parts[:-1]:obj=obj[key]
   obj[parts[-1]]=modify[1]
   with self.subTest(change=modify),patch.object(pr.artifact,'github',return_value={'object':{'sha':sha}}),patch.object(pr.artifact,'github_list',return_value=[bad]),self.assertRaises(AssertionError):pr.current_pr(c,branch,sha)
  with patch.object(pr.artifact,'github',return_value={'object':{'sha':'b'*40}}),self.assertRaises(AssertionError):pr.current_pr(c,branch,sha)
 def test_result_parser_is_name_specific_without_changing_develop_default(self):
  data={'preview':{'id':'a'*32,'name':'pr-example','slug':'pr-example','urls':['https://example.test']},'deployment':{'id':'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','number':1,'created_on':'today','main_module':'static.js','annotations':{},'urls':['https://example.test']}}
  self.assertEqual(pr.parse_preview_output(json.dumps(data),expected_name='pr-example'),data)
  with self.assertRaises(AssertionError):pr.parse_preview_output(json.dumps(data))
  data['deployment']['env']={'SECRET':{}}
  with self.assertRaises(AssertionError):pr.parse_preview_output(json.dumps(data),expected_name='pr-example')
 def test_builds_both_bases_and_uses_real_newlines_source_archives(self):
  script=(ROOT/'scripts/deployment/build-cloudflare.sh').read_text();feature=script.split('esac')[0]
  self.assertIn('--destination .cloudflare-site/preview --baseurl /preview',feature)
  self.assertIn('pr-preview-verify.py finalize',feature)
  source=(ROOT/'scripts/deployment/pr-preview-source.py').read_text();self.assertIn('source_archive: true',source)
  self.assertNotIn('\\\\n',feature)
 def test_context_rejects_stale_staged_identity_and_reserved_branches(self):
  import hashlib
  branch='feature/safe';sha='a'*40
  name='pr-feature-safe-'+hashlib.sha256(branch.encode()).hexdigest()[:10]
  c={'repository':'martletdesign/jekyll','targets':{'develop':{'worker':'martletdesign-jekyll-reference'}}}
  with tempfile.TemporaryDirectory() as tmp:
   d=Path(tmp);(d/'.cloudflare-pr-name').write_text(name+'\n')
   state={'branch':branch,'sourceCommit':sha,'previewName':name}
   (d/'.cloudflare-pr-source.json').write_text(json.dumps(state))
   env={'WORKERS_CI_BRANCH':branch,'WORKERS_CI_COMMIT_SHA':sha}
   with patch.object(pr,'ROOT',d),patch.object(pr.artifact,'read_config',return_value=c),patch.object(pr.subprocess,'check_output',return_value=sha+'\n'),patch.object(pr.subprocess,'run'),patch.dict(os.environ,env,clear=True):
    self.assertEqual(pr.context()[3],name)
    for key,value in [('sourceCommit','b'*40),('previewName','develop'),('branch','feature/other')]:
     (d/'.cloudflare-pr-source.json').write_text(json.dumps({**state,key:value}))
     with self.subTest(key=key),self.assertRaises(AssertionError):pr.context()
    (d/'.cloudflare-pr-source.json').write_text(json.dumps(state))
    with patch.dict(os.environ,{'JEKYLL_DEPLOY_BRANCH':'main'}),self.assertRaises(AssertionError):pr.context()
    with patch.dict(os.environ,{'WORKERS_CI_BRANCH':'main'}),self.assertRaises(AssertionError):pr.context()
 def test_generated_names_fit_both_parents_and_separate_long_branches(self):
  names=[]
  for suffix in ['A','B']:
   branch='feature/'+('sameprefix'*10)+'-'+suffix
   with tempfile.TemporaryDirectory() as tmp:
    d=Path(tmp);(d/'scripts/deployment').mkdir(parents=True);(d/'nightjar').mkdir()
    script=d/'scripts/deployment/pr-preview-source.py';script.write_bytes((ROOT/'scripts/deployment/pr-preview-source.py').read_bytes())
    (d/'README.md').write_text('fixture');(d/'nightjar/source-files.json').write_text('["README.md"]')
    subprocess.run(['git','init','-q',str(d)],check=True)
    subprocess.run(['git','-C',str(d),'add','README.md'],check=True)
    subprocess.run(['git','-C',str(d),'-c','user.name=Fixture','-c','user.email=fixture@example.test','commit','-qm','fixture'],check=True)
    env={**os.environ,'WORKERS_CI_BRANCH':branch};env.pop('JEKYLL_DEPLOY_BRANCH',None);env.pop('WORKERS_CI_COMMIT_SHA',None)
    subprocess.run([sys.executable,str(script)],cwd=d,env=env,check=True,capture_output=True,text=True)
    name=(d/'.cloudflare-pr-name').read_text().strip();names.append(name)
    sha=subprocess.check_output(['git','-C',str(d),'rev-parse','HEAD'],text=True).strip()
    for family in ['martlet','krigsvold']:
     c={'repository':family+'design/jekyll','targets':{'develop':{'worker':family+'design-jekyll-reference'}}}
     with patch.object(pr,'ROOT',d),patch.object(pr.artifact,'read_config',return_value=c),patch.dict(os.environ,env,clear=True):
      actual,_,_,context_name=pr.context();self.assertEqual(context_name,name)
      label=actual['targets'][branch]['origin'].split('://')[1].split('.')[0]
      self.assertLessEqual(len(label),63);self.assertLessEqual(len(name),26)
  self.assertNotEqual(names[0],names[1],'Long branches sharing the slug must remain distinct')
 def fixture(self,mode):
  class Handler(http.server.BaseHTTPRequestHandler):
   def log_message(self,*args):pass
   def do_GET(self):
    body=b'{}';code=503 if mode=='503' else 200
    if mode=='tampered':body=b'bad'
    self.send_response(code)
    if mode!='noindex':self.send_header('X-Robots-Tag','noindex, nofollow')
    if mode!='transform':self.send_header('Cache-Control','public, no-transform')
    self.end_headers();self.wfile.write(body)
  server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler);server.daemon_threads=True
  t=threading.Thread(target=server.serve_forever,daemon=True);t.start()
  try:
   with tempfile.TemporaryDirectory() as tmp:
    d=Path(tmp);(d/'.cloudflare-site/.well-known').mkdir(parents=True);site=d/'.cloudflare-site'
    for name in ['.well-known/deployment.json','deployment-inventory.json']:(site/name).write_bytes(b'{}')
    files=[{'path':'index.html','bytes':2,'sha256':pr.artifact.digest(b'{}')}]
    c={'targets':{'feature/test':{'origin':f'http://127.0.0.1:{server.server_port}'}}}
    with patch.object(pr,'ROOT',d),patch.object(pr,'validate',return_value=({'artifactSha256':'fixture'},{'files':files})):
     if mode=='good':self.assertEqual(pr.verify_live(c,'feature/test','a'*40,'pr-example',overall_timeout=.2)['filesVerified'],3)
     else:
      with self.assertRaises((AssertionError,TimeoutError)):pr.verify_live(c,'feature/test','a'*40,'pr-example',overall_timeout=.2)
  finally:server.shutdown();server.server_close();t.join(timeout=1)
 def test_real_http_exact_payload_passes(self):self.fixture('good')
 def test_real_http_missing_noindex_fails(self):self.fixture('noindex')
 def test_real_http_missing_no_transform_fails(self):self.fixture('transform')
 def test_real_http_503_fails(self):self.fixture('503')
 def test_real_http_corruption_cannot_pass_deadline(self):self.fixture('tampered')

if __name__=='__main__':unittest.main()
