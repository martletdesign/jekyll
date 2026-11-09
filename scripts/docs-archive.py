#!/usr/bin/env python3
"""Build a complete, local-only Jekyll documentation version from tracked source."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import zipfile

root=Path(__file__).resolve().parent.parent
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--destination',required=True,type=Path)
parser.add_argument('--version',required=True)
parser.add_argument('--known-version',action='append',default=[])
parser.add_argument('--prefix',default='')
args=parser.parse_args()
semver=re.compile(r'(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?')
def valid_version(v):
    m=semver.fullmatch(v)
    return bool(m and (not m.group(4) or all(not(p.isdigit() and len(p)>1 and p[0]=='0') for p in m.group(4).split('.'))))
if not valid_version(args.version) or any(not valid_version(v) for v in args.known_version):raise SystemExit('Invalid version')
if (root/'VERSION').read_text().strip()!=args.version:raise SystemExit('Version does not match VERSION')
if args.prefix and (not re.fullmatch(r'/(?:[A-Za-z0-9_-]+)(?:/[A-Za-z0-9_-]+)*',args.prefix)):raise SystemExit('Invalid deployment prefix')
versions=args.known_version+[args.version]
if len(versions)!=len(set(versions)):raise SystemExit('Duplicate versions')
parent=args.destination.resolve()
if parent==root or root in parent.parents:raise SystemExit('Destination must be outside the source checkout')
for version in args.known_version:
  previous=parent/'docs'/'v'/version
  if previous.is_symlink() or not previous.is_dir():raise SystemExit('Known version is missing or unsafe')
  manifest_path=previous/'nightjar-local-evidence.json'
  if manifest_path.is_symlink() or not manifest_path.is_file():raise SystemExit('Known version evidence is missing')
  evidence=json.loads(manifest_path.read_text())
  if evidence.get('version')!=version or evidence.get('base_path')!=args.prefix+'/docs/v/'+version+'/':raise SystemExit('Known version evidence mismatch')
  expected={f['path']:f for f in evidence['files']}
  actual=[]
  for file in previous.rglob('*'):
    if file.is_symlink():raise SystemExit('Known version contains symlink')
    if file.is_file() and file!=manifest_path:actual.append(file.relative_to(previous).as_posix())
  if len(expected)!=len(evidence['files']) or set(actual)!=set(expected):raise SystemExit('Known version file inventory mismatch')
  for name in actual:
    data=(previous/name).read_bytes();entry=expected[name]
    if len(data)!=entry['size'] or hashlib.sha256(data).hexdigest()!=entry['sha256']:raise SystemExit('Known version integrity mismatch')
target=parent/'docs'/'v'/args.version
# Reserve without replacement. Existing snapshots are never rewritten.
target.parent.mkdir(parents=True,exist_ok=True)
try: target.mkdir()
except FileExistsError: raise SystemExit('Documentation version already exists')
try:
  with tempfile.TemporaryDirectory(prefix='jekyll-docs-archive-') as temp:
    stage=Path(temp)/'source';stage.mkdir()
    entries=json.loads((root/'nightjar/source-files.json').read_text())
    if not isinstance(entries,list) or not entries or len(entries)!=len(set(entries)):raise SystemExit('Invalid source manifest')
    for entry in entries:
      relative=Path(entry)
      if not isinstance(entry,str) or relative.is_absolute() or str(relative)!=entry or any(p in ('.','..') for p in relative.parts):raise SystemExit('Unsafe source manifest')
      source=root
      for part in relative.parts:
        source=source/part
        if source.is_symlink():raise SystemExit('Source symlink not allowed')
      if not source.is_file():raise SystemExit('Missing source file')
      destination=stage/relative;destination.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,destination)
    overlay=Path(temp)/'archive.yml'
    overlay.write_text(json.dumps({'archive_mode':True,'archive_prefix':args.prefix,'archive_version':args.version,'archive_versions':versions,'archive_prerelease':'-' in args.version,'source_archive':True}))
    base=args.prefix+'/docs/v/'+args.version
    subprocess.run(['bundle','exec','jekyll','build','--config',f'{stage / "_config.yml"},{overlay}','--source',str(stage),'--destination',str(target),'--baseurl',base,'--strict_front_matter','--trace'],cwd=root,check=True)
    with zipfile.ZipFile(target/'template.zip','w',zipfile.ZIP_DEFLATED) as archive:
      for entry in entries:
        source=stage/entry
        info=zipfile.ZipInfo(entry,date_time=(1980,1,1,0,0,0));info.create_system=3
        info.external_attr=(0o100755 if source.stat().st_mode & 0o111 else 0o100644)<<16
        archive.writestr(info,source.read_bytes(),compress_type=zipfile.ZIP_DEFLATED,compresslevel=9)
    shell=json.loads((stage/'_data/shell.json').read_text())
    provenance=json.loads((stage/'scripts/source-shell-provenance.json').read_text())
    digest=hashlib.sha256((stage/'assets/css/shell.css').read_bytes()).hexdigest()
    # Capture records describe the original shell; Core owns the current CSS.
    if shell['sha256']!=provenance['source_shell_sha256'] or provenance['family']!=shell['family']:raise SystemExit('Source shell capture mismatch')
    core=json.loads((stage/'assets/css/core-styles.json').read_text())
    for name,expected in core['files'].items():
      if hashlib.sha256((stage/'assets/css'/name).read_bytes()).hexdigest()!=expected:raise SystemExit('Core stylesheet digest mismatch: '+name)
    files=[]
    for file in sorted(target.rglob('*')):
      if file.is_symlink():raise SystemExit('Symlink in generated output')
      if not file.is_file():continue
      data=file.read_bytes()
      if file.suffix=='.html' and not re.search(rb'<meta\s+name="robots"\s+content="noindex',data,re.I):raise SystemExit(f'Missing noindex: {file}')
      files.append({'path':file.relative_to(target).as_posix(),'size':len(data),'sha256':hashlib.sha256(data).hexdigest()})
    workbench=json.loads((stage/'nightjar/PROVENANCE.json').read_text())
    evidence={'format':'local-jekyll-docs-prototype-v1','framework':'jekyll','family':shell['family'],'version':args.version,'base_path':base+'/', 'implementation_commit':None,'implementation_commit_reason':'Local prototype does not authenticate a release commit','workbench_export_commit':workbench['workbench_commit'], 'core':core, 'source_shell':{**provenance,'sha256':digest,'contract_source':shell['contract_source'],'contract_sha256':shell['contract_sha256']},'files':files}
    (target/'nightjar-local-evidence.json').write_text(json.dumps(evidence,indent=2)+'\n')
    # A local, honest fallback keeps archived links usable without a deployed
    # catalog service. It lives outside immutable snapshots and is never replaced
    # by subsequent builds or used to advance the production latest pointer.
    versions_dir=parent/'docs'/'versions'
    if versions_dir.is_symlink() or (versions_dir.exists() and not versions_dir.is_dir()):raise SystemExit('Unsafe versions index directory')
    versions_dir.mkdir(parents=True,exist_ok=True)
    index=versions_dir/'index.html'
    if index.is_symlink() or (index.exists() and not index.is_file()):raise SystemExit('Unsafe versions index')
    if not index.exists():
      with index.open('x',encoding='utf-8') as out:
        out.write(f'<!doctype html><html lang="en" data-{shell["family"]}="light" data-appearance="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Documentation versions</title><link rel="stylesheet" href="{base}/assets/css/fonts.css"><link rel="stylesheet" href="{base}/assets/css/martlet.css"></head><body class="{shell["family"]}"><main><h1>Documentation versions</h1><p>The live version catalog is unavailable in this offline archive. Use the version links in the snapshot.</p></main></body></html>\n')
    print(f'Built {len(files)} local documentation files for {args.version} at {target}')
except BaseException:
  shutil.rmtree(target)
  raise
