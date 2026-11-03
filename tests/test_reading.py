"""Consumer optional media survives the native documentation adapter."""
from html.parser import HTMLParser
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
ROOT=Path(__file__).resolve().parents[1]
class Images(HTMLParser):
    def __init__(self):super().__init__();self.images=[]
    def handle_starttag(self,tag,attrs):
        if tag=='img':self.images.append(dict(attrs))
class ReadingCompatibilityTests(unittest.TestCase):
    def test_documentation_optional_image_in_actual_safe_subpath_build(self):
        with tempfile.TemporaryDirectory(prefix='martlet-reading-consumer-') as temporary:
            source=Path(temporary)/'source';destination=Path(temporary)/'site';source.mkdir()
            for entry in json.loads((ROOT/'nightjar/source-files.json').read_text()):
                target=source/entry;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(ROOT/entry,target)
            data_path=source/'_data/examples.json';data=json.loads(data_path.read_text());record=next(p for p in data['pages'] if p['id']=='documentation')
            item=record['sections'][0]['items'][0];image='/assets/images/heroes/martlet-hero-640.webp';alt='An optional image with < & " characters'
            item.update(image=image,alt=alt);data_path.write_text(json.dumps(data))
            result=subprocess.run([sys.executable,str(source/'nightjar/build.py'),'--destination',str(destination),'--baseurl','/preview','--safe'],cwd=source,capture_output=True,text=True,timeout=120)
            self.assertEqual(result.returncode,0,result.stdout+result.stderr)
            parsed=Images();parsed.feed((destination/'examples/documentation/index.html').read_text())
            media=[img for img in parsed.images if img.get('src')=='/preview'+image];self.assertEqual(len(media),1)
            self.assertEqual(media[0]['alt'],alt);self.assertEqual(media[0]['width'],'720');self.assertEqual(media[0]['height'],'480');self.assertEqual(media[0]['loading'],'lazy')
            self.assertTrue((destination/image.lstrip('/')).is_file())
if __name__=='__main__':unittest.main()
