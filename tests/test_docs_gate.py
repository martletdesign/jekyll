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

if __name__ == '__main__': unittest.main()
