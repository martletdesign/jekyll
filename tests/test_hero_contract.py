"""Executable compatibility and source-integrity checks for the host hero tiers."""
import hashlib
import json
from pathlib import Path
import subprocess
import unittest

ROOT=Path(__file__).resolve().parents[1]

class HeroContractTests(unittest.TestCase):
    def resolve(self,page):
        code="require 'liquid'; require 'json'; s=File.read('_includes/hero-config.html')+'{{hero_variant}}|{{hero_has_image}}'; print Liquid::Template.parse(s).render!({'page'=>JSON.parse(STDIN.read)})"
        r=subprocess.run(['bundle','exec','ruby','-e',code],cwd=ROOT,input=json.dumps(page),capture_output=True,text=True,timeout=20,check=True)
        return r.stdout.strip().split('|')
    def test_legacy_and_explicit_variant_resolution(self):
        cases=[({'url':'/','hero_image':'/local.webp'},['signature','true']),({'url':'/language/','hero_image':'/local.webp'},['section','true']),({'url':'/article/'},['compact','false']),({'url':'/article/','hero_variant':'signature','hero_image':'/local.webp'},['compact','false']),({'url':'/article/','hero_variant':'unknown','hero_image':'/local.webp'},['compact','false']),({'url':'/utility/','hero_variant':'plain','hero_image':'/local.webp'},['plain','false']),({'url':'/examples/dashboard/','dashboard':True,'hero_image':'/local.webp'},['plain','false']),({'url':'/language/','hero_variant':'section'},['section','false']),({'url':'/','hero_variant':'plain','hero_image':'/local.webp'},['plain','false']),({'url':'/','hero_variant':'compact','hero_image':'/local.webp'},['compact','false']),({'url':'/','hero_image':'   '},['compact','false']),({'url':'/','hero_image':''},['compact','false']),({'url':'/examples/dashboard/','dashboard':True,'hero_variant':'section','hero_image':'/local.webp'},['plain','false'])]
        for page,expected in cases:
            with self.subTest(page=page):self.assertEqual(self.resolve(page),expected)
    def test_secondary_sources_derivatives_licenses_and_archive_allowlist(self):
        index=json.loads((ROOT/'_hero_sources/provenance-index.json').read_text());allowlist=json.loads((ROOT/'nightjar/source-files.json').read_text())
        self.assertEqual(len(index['assets']),3)
        self.assertEqual(len({item['sourcePage'] for item in index['assets']}),3)
        for item in index['assets']:
            with self.subTest(asset=item['id']):
                path=ROOT/item['originalFile'];self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(),item['sourceSha256']);self.assertIn(item['originalFile'],allowlist)
                self.assertEqual(item['derivativeLicense'],item['license']);self.assertFalse(item['transformation']['tintAppliedToSource'])
                for derivative in item['derivatives']:
                    self.assertEqual(hashlib.sha256((ROOT/derivative['path']).read_bytes()).hexdigest(),derivative['sha256']);self.assertIn(derivative['path'],allowlist);self.assertEqual(derivative['license'],item['license'])
        for line in (ROOT/'_hero_sources/SHA256SUMS').read_text().splitlines():
            digest,path=line.split(None,1);self.assertEqual(hashlib.sha256((ROOT/path.strip()).read_bytes()).hexdigest(),digest)

if __name__=='__main__':unittest.main()
