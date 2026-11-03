#!/usr/bin/env python3
"""Verify the explicitly selected static documentation/source release path."""
import argparse
import json
from pathlib import Path, PurePosixPath
import subprocess
import stat
import zipfile

ROOT = Path(__file__).resolve().parents[1]

def require(condition, message):
    if not condition:
        raise SystemExit('Documentation release is blocked: ' + message)

def verify_archive(path):
    entries = json.loads((ROOT/'nightjar/source-files.json').read_text())
    require(isinstance(entries,list) and entries and len(entries)==len(set(entries)), 'invalid source allowlist')
    with zipfile.ZipFile(path) as archive:
        names = archive.namelist()
        require(len(names)==len(set(names)) and set(names)==set(entries), 'archive inventory differs from the reviewed source allowlist')
        for name in names:
            info=archive.getinfo(name)
            require(info.create_system==3 and stat.S_ISREG(info.external_attr >> 16), 'non-regular archive member')
            part = PurePosixPath(name)
            require(not part.is_absolute() and all(p not in ('.','..') for p in part.parts) and str(part)==name, 'unsafe archive member')
            source = ROOT/name
            require(source.is_file() and not source.is_symlink(), 'missing or unsafe source member')
            require(archive.read(name)==source.read_bytes(), f'archive source bytes differ: {name}')
    return len(entries)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--build',type=Path)
    parser.add_argument('--archive',type=Path)
    args=parser.parse_args()
    require(bool(args.build) != bool(args.archive), 'select exactly one verified build or source archive')
    policy=json.loads((ROOT/'release-policy.json').read_text())
    require(policy.get('schemaVersion')==1 and policy.get('framework')=='jekyll' and policy.get('family') in ['martlet','krigsvold'], 'invalid release identity')
    require(policy.get('authority')==policy['family']+'design/jekyll', 'invalid source authority')
    require(policy.get('documentationPath')=='static-source' and policy.get('advancedArchiveEnabled') is False, 'unverified advanced archive pathway is disabled')
    if args.build:
        directory=args.build.resolve()
        recipes=json.loads((ROOT/'_data/examples.json').read_text())['pages']
        require(len(recipes)==50 and len({p['id'] for p in recipes})==50, 'canonical recipe inventory must contain 50 unique recipes')
        require(all((directory/'examples'/p['id']/'index.html').is_file() for p in recipes), 'incomplete rendered recipe inventory')
        result=subprocess.run(['python3',str(ROOT/'nightjar/verify-html.py'),str(directory)],check=False,timeout=120)
        require(result.returncode==0, 'rendered local links, assets or fragments failed')
        count=verify_archive(directory/'template.zip')
    else:
        count=verify_archive(args.archive.resolve())
    print(f'Verified {count} exact standalone source files; advanced R2 archive remains disabled.')

if __name__=='__main__':
    try:
        main()
    except (OSError,ValueError,zipfile.BadZipFile,KeyError,TypeError) as error:
        raise SystemExit('Documentation release is blocked: '+str(error))
