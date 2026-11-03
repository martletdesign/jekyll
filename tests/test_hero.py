"""Keep the approved panorama identity in the reproducible standalone source."""
import hashlib
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
APPROVED = {
    'hero-original.webp': ('6ee7d00a6b2b0c25a7ea24fa0d334cc5ea3782e1fea4a1d81b91449d32de78b4', 41024, 1536, 506),
    'hero-960.webp': ('c6bf5a34ea31741019dd9e25105d85efa826465ef1af3b68defd649a01261cce', 16090, 960, 316),
    'hero-640.webp': ('c1d22b655d0a6425d9ca85e95925c37d10afab40dc81d2fb42c3902ed77da564', 9494, 640, 211),
}

class ApprovedHeroTests(unittest.TestCase):
    def test_approved_artwork_and_derivatives_are_byte_exact(self):
        provenance = json.loads((ROOT/'assets/images/heroes/PROVENANCE.json').read_text())
        self.assertEqual(provenance['family'], 'martlet')
        self.assertFalse(provenance['later16by9RegenerationsUsed'])
        records = {r['file']: r for r in provenance['files']}
        self.assertEqual(set(records), set(APPROVED))
        for name, (digest, length, width, height) in APPROVED.items():
            with self.subTest(file=name):
                path = ROOT/'assets/images/heroes'/name
                self.assertFalse(path.is_symlink())
                data = path.read_bytes()
                self.assertEqual(data[8:12], b'WEBP')
                self.assertEqual(hashlib.sha256(data).hexdigest(), digest)
                self.assertEqual(len(data), length)
                self.assertEqual(records[name], {'file':name, 'width':width, 'height':height, 'bytes':length, 'sha256':digest})

    def test_source_archive_contains_the_approved_assets_and_provenance(self):
        manifest = json.loads((ROOT/'nightjar/source-files.json').read_text())
        for name in APPROVED:
            self.assertIn('assets/images/heroes/'+name, manifest)
        self.assertIn('assets/images/heroes/PROVENANCE.json', manifest)
        self.assertIn('HERO-PROVENANCE.md', manifest)

if __name__ == '__main__':
    unittest.main()
