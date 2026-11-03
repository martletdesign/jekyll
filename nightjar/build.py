#!/usr/bin/env python3
"""Build this standalone snapshot and a complete allowlisted source archive."""
import argparse
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import zipfile

root = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--baseurl', default='')
parser.add_argument('--destination', type=Path, required=True)
parser.add_argument('--safe', action='store_true')
args = parser.parse_args()
destination = args.destination.resolve()
entries = json.loads((root / 'nightjar/source-files.json').read_text())
if not isinstance(entries, list) or not entries or not all(isinstance(x, str) for x in entries) or len(entries) != len(set(entries)):
    raise SystemExit('Invalid source manifest')
if root.is_relative_to(destination):
    raise SystemExit('Destination must not contain the source directory')
with tempfile.TemporaryDirectory(prefix='nightjar-standalone-') as temporary:
    stage = Path(temporary) / 'source'
    for entry in entries:
        relative = Path(entry)
        if relative.is_absolute() or str(relative) != entry or any(part in ('.', '..') for part in relative.parts):
            raise SystemExit(f'Unsafe source manifest path: {entry!r}')
        if (root / relative).is_relative_to(destination):
            raise SystemExit(f'Destination would overwrite source: {entry}')
        source = root
        for part in relative.parts:
            source = source / part
            if source.is_symlink():
                raise SystemExit(f'Symlink is not allowed: {source}')
        if not source.is_file():
            raise SystemExit(f'Missing source file: {source}')
        target = stage / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
    with tempfile.NamedTemporaryFile(mode='w', suffix='.yml') as config:
        config.write('source_archive: true\n')
        config.flush()
        command = ['bundle', 'exec', 'jekyll', 'build', '--config', f'{stage / "_config.yml"},{config.name}', '--source', str(stage), '--destination', str(destination), '--baseurl', args.baseurl, '--strict_front_matter', '--trace']
        if args.safe:
            command.append('--safe')
        subprocess.run(command, check=True, cwd=root)
    with zipfile.ZipFile(destination / 'template.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
        for entry in entries:
            source = stage / entry
            info = zipfile.ZipInfo(entry, date_time=(1980, 1, 1, 0, 0, 0))
            info.create_system = 3
            info.external_attr = (0o100755 if source.stat().st_mode & 0o111 else 0o100644) << 16
            archive.writestr(info, source.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
