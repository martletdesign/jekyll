import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

class DocsGateTests(unittest.TestCase):
    def test_unconfigured_docs_block_release(self):
        result = subprocess.run(['python3', 'scripts/verify_docs.py'], cwd=ROOT, text=True, capture_output=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('release is blocked', result.stderr)
    def test_workflow_invokes_gate_before_artifact_and_release(self):
        workflow = (ROOT/'.github/workflows/tag-release.yml').read_text()
        self.assertEqual(workflow.count('python3 scripts/verify_docs.py'), 2)
        self.assertLess(workflow.index('python3 scripts/verify_docs.py'), workflow.index('actions/upload-artifact@v4'))
        self.assertLess(workflow.rindex('python3 scripts/verify_docs.py'), workflow.index('gh release create'))


class StaticSourceGateTests(unittest.TestCase):
    def setUp(self):
        import importlib.util
        import tempfile
        import json
        self.temporary=tempfile.TemporaryDirectory(prefix='jekyll-static-gate-')
        self.root=Path(self.temporary.name)
        (self.root/'nightjar').mkdir()
        self.files={'README.md':b'reviewed source\n','release-policy.json':b'{"advancedArchiveEnabled":false}\n'}
        (self.root/'nightjar/source-files.json').write_text(json.dumps(list(self.files)))
        for name,content in self.files.items():(self.root/name).write_bytes(content)
        spec=importlib.util.spec_from_file_location('jekyll_static_gate',ROOT/'scripts/verify_docs.py')
        self.gate=importlib.util.module_from_spec(spec);spec.loader.exec_module(self.gate);self.gate.ROOT=self.root
    def tearDown(self):
        self.temporary.cleanup()
    def archive(self, members):
        import zipfile
        path=self.root/'source.zip'
        with zipfile.ZipFile(path,'w') as archive:
            for name,content in members:
                info=zipfile.ZipInfo(name,date_time=(1980,1,1,0,0,0));info.create_system=3;info.external_attr=0o100644<<16
                archive.writestr(info,content)
        return path
    def test_exact_source_archive_passes(self):
        self.assertEqual(self.gate.verify_archive(self.archive(list(self.files.items()))),2)
    def test_missing_extra_and_conflicting_archive_members_are_rejected(self):
        exact=list(self.files.items())
        for members in [exact[:-1],exact+[('unexpected.txt',b'extra')],[(exact[0][0],b'corrupted'),exact[1]],exact+[exact[0]]]:
            with self.subTest(members=[name for name,_ in members]):
                with self.assertRaisesRegex(SystemExit,'release is blocked'):
                    self.gate.verify_archive(self.archive(members))

if __name__ == '__main__': unittest.main()
