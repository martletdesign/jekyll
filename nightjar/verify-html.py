#!/usr/bin/env python3
"""Check every rendered local destination, fragment, heading and ID without a browser."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote, urljoin
import argparse

class Document(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=True)
        self.ids=set(); self.duplicates=[]; self.links=[]; self.h1=0
        self.feed(text)
    def handle_starttag(self, tag, attrs):
        a=dict(attrs)
        if tag=='h1': self.h1+=1
        if a.get('id'):
            if a['id'] in self.ids:self.duplicates.append(a['id'])
            self.ids.add(a['id'])
        for key in ('href','src'):
            if key in a:self.links.append(a[key])

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('directory',type=Path)
parser.add_argument('--baseurl',default='')
a=parser.parse_args(); root=a.directory.resolve(); documents={}
for file in root.rglob('*.html'): documents[file]=Document(file.read_text())
errors=[]; count=0
for file,doc in documents.items():
    if doc.h1!=1:errors.append(f'{file.relative_to(root)}: {doc.h1} h1 elements')
    for duplicate in doc.duplicates:errors.append(f'{file.relative_to(root)}: duplicate ID {duplicate}')
    relative=file.relative_to(root).as_posix()
    public=a.baseurl+'/'+relative
    if relative.endswith('index.html'):public=public[:-10]
    for link in doc.links:
        parts=urlsplit(link)
        if parts.scheme or parts.netloc:continue
        target=urlsplit(urljoin(public,link)); path=unquote(target.path)
        if a.baseurl and not(path==a.baseurl or path.startswith(a.baseurl+'/')):
            errors.append(f'{relative}: lost baseurl in {link}');continue
        local=root/path.removeprefix(a.baseurl).lstrip('/')
        if local.is_dir():local=local/'index.html'
        count+=1
        if not local.exists():errors.append(f'{relative}: missing {link}')
        elif target.fragment and local.suffix=='.html' and unquote(target.fragment) not in documents.get(local,Document('')).ids:
            errors.append(f'{relative}: missing fragment {link}')
if errors:raise SystemExit('\n'.join(errors))
print(f'Checked {len(documents)} rendered pages and {count} local destinations/fragments under {a.baseurl or "/"}.')
