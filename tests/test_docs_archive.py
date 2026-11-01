import hashlib
import json
import shutil
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]

def run(*args, expect=True, cwd=ROOT):
    p=subprocess.run(args,cwd=cwd,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
    if (p.returncode==0)!=expect: raise AssertionError(p.stdout)
    return p.stdout

def tree(path):
    return {str(p.relative_to(path)):hashlib.sha256(p.read_bytes()).hexdigest() for p in path.rglob('*') if p.is_file()}

class DocumentationBuildTests(unittest.TestCase):
    def test_sequential_snapshots_root_and_subpath(self):
        with tempfile.TemporaryDirectory(prefix='jekyll-docs-check-') as tmp:
            source=Path(tmp)/'source'
            for entry in json.loads((ROOT/'nightjar/source-files.json').read_text()):
                dest=source/entry;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(ROOT/entry,dest)
            for prefix in ('','/preview'):
                destination=Path(tmp)/('root' if not prefix else 'preview')
                command=['python3','scripts/docs-archive.py','--destination',str(destination),'--prefix',prefix]
                (source/'VERSION').write_text('1.0.0\n')
                run(*command,'--version','1.0.0',cwd=source)
                old=destination/'docs/v/1.0.0'; before=tree(old)
                self.assertTrue((old/'template.zip').is_file())
                evidence=json.loads((old/'nightjar-local-evidence.json').read_text())
                provenance=json.loads((source/'scripts/source-shell-provenance.json').read_text())
                self.assertIsNone(evidence['core'])
                self.assertIsNone(evidence['implementation_commit'])
                self.assertEqual(evidence['source_shell']['legacy_package'],provenance['legacy_package'])
                self.assertEqual(evidence['source_shell']['sha256'],provenance['source_shell_sha256'])
                recipes=json.loads((ROOT/'_data/examples.json').read_text())['pages']
                self.assertEqual(len(recipes),50)
                self.assertTrue(all((old/'examples'/v['id']/'index.html').is_file() for v in recipes))
                self.assertTrue((old/'examples/scientific-workspace/index.html').is_file())
                first=(old/'index.html').read_text()
                self.assertIn('name="robots" content="noindex',first)
                self.assertIn('aria-label="Documentation versions"',first)
                run(*command,'--version','1.0.0',expect=False,cwd=source)
                self.assertEqual(before,tree(old))
                (source/'VERSION').write_text('1.1.0-rc.1\n')
                run(*command,'--version','1.0.0',expect=False,cwd=source)
                run(*command,'--version','1.1.0-rc.1','--known-version','1.0.0',cwd=source)
                self.assertEqual(before,tree(old))
                second=(destination/'docs/v/1.1.0-rc.1/index.html').read_text()
                self.assertIn('(prerelease)',second)
                self.assertIn(prefix+'/docs/v/1.0.0/',second)
                self.assertIn('aria-current="page"',second)
                run('python3','nightjar/verify-html.py',str(destination),'--baseurl',prefix)
                (old/'index.html').write_text('tampered')
                (source/'VERSION').write_text('1.2.0\n')
                output=run(*command,'--version','1.2.0','--known-version','1.0.0',expect=False,cwd=source)
                self.assertIn('Known version integrity mismatch',output)

if __name__=='__main__':unittest.main()
