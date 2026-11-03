"""Render actual Liquid adapters against consumer edits, retaining content safely."""
from html.parser import HTMLParser
import json
from pathlib import Path
import subprocess
import unittest
ROOT=Path(__file__).resolve().parents[1]
class Structure(HTMLParser):
    def __init__(self): super().__init__(); self.tags=[]; self.text=[]
    def handle_starttag(self,tag,attrs): self.tags.append((tag,dict(attrs)))
    def handle_data(self,text): self.text.append(text)
class GrammarTests(unittest.TestCase):
    def render(self,name,context):
        code="require 'liquid'; require 'json'; module F; def markdownify(v); v; end; def nightjar_sanitize(v,*); v; end; end; Liquid::Template.register_filter(F); print Liquid::Template.parse(File.read(ARGV[0])).render!(JSON.parse(STDIN.read))"
        result=subprocess.run(['bundle','exec','ruby','-e',code,f'_includes/examples/{name}.html'],cwd=ROOT,input=json.dumps(context),capture_output=True,text=True,check=True,timeout=20)
        parsed=Structure();parsed.feed(result.stdout);return parsed
    def test_release_titles_safe_fallback_and_authored_dates(self):
        for title,expected in [('1.2 · October 28, 2026','2026-10-28'),('1.1 · October 10, 2026','2026-10-10'),('1.0 · September 29, 2026','2026-09-29'),('Correction without a date',None),('Preview · not a date',None),('A · B · C',None)]:
            with self.subTest(title=title):
                p=self.render('release-history',{'include':{'record':{'sections':[{'id':'entry','title':title,'body':'Full unchanged account.'}]}}})
                text=' '.join(''.join(p.text).split());self.assertIn(title,text);self.assertEqual(text.count(title),1)
                dates=[a.get('datetime') for t,a in p.tags if t=='time'];self.assertEqual(dates,[] if expected is None else [expected]);self.assertIn('Full unchanged account.',text)
    def test_adding_fifth_faq_preserves_every_disclosure(self):
        items=[{'question':f'Question {i}?','answer':f'Answer {i}.'} for i in range(5)]
        p=self.render('faq',{'page':{'record_id':'faq'},'include':{'items':items}})
        self.assertEqual(sum(t=='details' for t,a in p.tags),5);self.assertEqual(sum(t=='section' for t,a in p.tags),2)
        text=' '.join(p.text)
        for item in items:
            self.assertEqual(text.count(item['question']),1);self.assertEqual(text.count(item['answer']),1)
if __name__=='__main__':unittest.main()
