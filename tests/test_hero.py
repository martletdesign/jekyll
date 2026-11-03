"""Keep the approved panorama identity in the reproducible standalone source."""
import hashlib
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
APPROVED = {
    'martlet-hero-640.webp': ('98a0b5248a74203e32136301df707302d1274e5b3110a4b201ad5420edeaab7c', 10572, 640, 213),
    'martlet-hero-960.webp': ('a7c0713f8fa2faa1a10dd382c9d7c4bfea5a149a30def1e2fb29f6f2c158acf8', 17284, 960, 320),
    'martlet-hero-1440.webp': ('0135fb44890f4bf5092afa2c798fa7337800cfb021f1622d876733072181c877', 29386, 1440, 480),
    'martlet-hero-1920.webp': ('d726af09b175d474cffcfb1152c2b6b69e04e5b51ed85244396b39965c27e2e3', 42644, 1920, 640),
    'martlet-hero-2172.webp': ('325691c8e1468c19b809242f4b6b8cd49780afecbbf00800b1b8567efd74c55d', 50988, 2172, 724),
    'martlet-hero-master.png': ('2ab6f3b4ba63d7fd3ba51a8cd3db7e5782de1bf03eb31b0ec3b1fd44f100959a', 1665260, 2172, 724),
}

class ApprovedHeroTests(unittest.TestCase):
    def test_approved_artwork_and_derivatives_are_byte_exact(self):
        provenance = json.loads((ROOT/'assets/images/heroes/PROVENANCE.json').read_text())
        self.assertEqual(provenance['family'], 'martlet')
        self.assertFalse(provenance['optional16by9CropUsed'])
        self.assertFalse(provenance['underlyingImageColorsAltered'])
        records = {r['file']: r for r in provenance['files']}
        self.assertEqual(set(records), set(APPROVED))
        for name, (digest, length, width, height) in APPROVED.items():
            with self.subTest(file=name):
                path = ROOT/'assets/images/heroes'/name
                self.assertFalse(path.is_symlink())
                data = path.read_bytes()
                self.assertEqual(data[:8], b'\x89PNG\r\n\x1a\n') if name.endswith('.png') else self.assertEqual(data[8:12], b'WEBP')
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
