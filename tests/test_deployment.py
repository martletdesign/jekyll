"""Deployment boundaries and immutable artifact checks; no network or secrets."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('deployment_artifact',ROOT/'scripts/deployment/artifact.py')
artifact=importlib.util.module_from_spec(spec);spec.loader.exec_module(artifact)

class DeploymentTests(unittest.TestCase):
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

if __name__=='__main__':unittest.main()
