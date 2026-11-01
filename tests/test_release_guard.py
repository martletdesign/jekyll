import os
from pathlib import Path
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts/release_guard.py'

def run(*args, cwd, env=None):
    return subprocess.run(args, cwd=cwd, env=env, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, check=True).stdout.strip()

class ReleaseGuardTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        run('git','init','--bare','remote.git',cwd=self.root)
        run('git','init','-b','main','repo',cwd=self.root)
        self.repo = self.root / 'repo'
        run('git','config','user.name','Test',cwd=self.repo)
        run('git','config','user.email','test@example.invalid',cwd=self.repo)
        run('git','remote','add','origin',str(self.root/'remote.git'),cwd=self.repo)
        (self.repo/'VERSION').write_text('1.2.3\n')
        run('git','add','VERSION',cwd=self.repo)
        run('git','commit','-m','approved',cwd=self.repo)
        run('git','tag','v1.2.3',cwd=self.repo)
        run('git','push','origin','main','v1.2.3',cwd=self.repo)
        self.sha=run('git','rev-parse','HEAD',cwd=self.repo)
        self.env={**os.environ,'GITHUB_EVENT_NAME':'push','GITHUB_REF_TYPE':'tag','GITHUB_REF':'refs/tags/v1.2.3','GITHUB_REF_PROTECTED':'true','GITHUB_SHA':self.sha}
    def guard(self, **env):
        return subprocess.run(['python3',str(SCRIPT)],cwd=self.repo,env={**self.env,**env},text=True,capture_output=True)
    def test_approved_tag(self): self.assertEqual(self.guard().returncode,0)
    def test_annotated_tag(self):
        run('git','tag','-fa','v1.2.3','-m','annotated',cwd=self.repo)
        run('git','push','--force','origin','v1.2.3',cwd=self.repo)
        self.assertEqual(self.guard().returncode,0)
    def test_unprotected_wrong_event_or_sha(self):
        for e in ({'GITHUB_REF_PROTECTED':'false'},{'GITHUB_EVENT_NAME':'release'},{'GITHUB_SHA':'0'*40}): self.assertNotEqual(self.guard(**e).returncode,0)
    def test_mismatched_version_and_remote_tag(self):
        (self.repo/'VERSION').write_text('2.0.0\n')
        self.assertNotEqual(self.guard().returncode,0)
        (self.repo/'VERSION').write_text('1.2.3\n')
        run('git','tag','-fa','v1.2.3','-m','different tag object',cwd=self.repo)
        run('git','push','--force','origin','v1.2.3',cwd=self.repo)
        run('git','tag','-f','v1.2.3',self.sha,cwd=self.repo)
        result=self.guard()
        self.assertNotEqual(result.returncode,0)
        self.assertIn('remote tag identity differs',result.stderr)
    def test_noncanonical_semver(self):
        for version in ('01.2.3', '1.2.3-01', '1.2.3+build'):
            (self.repo/'VERSION').write_text(version+'\n')
            self.assertNotEqual(self.guard(GITHUB_REF='refs/tags/v'+version).returncode,0)
    def test_publication_jobs_remain_disabled(self):
        workflow = (SCRIPT.parents[1] / '.github/workflows/tag-release.yml').read_text()
        self.assertEqual(workflow.count('if: ${{ false }}'), 2)
        self.assertNotIn('npm publish', workflow)
    def test_side_branch_commit_is_not_first_parent(self):
        run('git','checkout','-b','feature',cwd=self.repo)
        (self.repo/'side').write_text('side')
        run('git','add','side',cwd=self.repo)
        run('git','commit','-m','side',cwd=self.repo)
        side=run('git','rev-parse','HEAD',cwd=self.repo)
        run('git','tag','-f','v1.2.3',cwd=self.repo)
        run('git','checkout','main',cwd=self.repo)
        run('git','merge','--no-ff','feature','-m','merge feature',cwd=self.repo)
        run('git','push','--force','origin','main','v1.2.3',cwd=self.repo)
        self.assertNotEqual(self.guard(GITHUB_SHA=side).returncode,0)

if __name__ == '__main__': unittest.main()
