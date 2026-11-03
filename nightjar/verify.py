#!/usr/bin/env python3
"""Exercise the standalone snapshot without Git metadata or a workbench checkout."""
import json
import hashlib
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import zipfile

root = Path(__file__).resolve().parent.parent
entries = json.loads((root / 'nightjar/source-files.json').read_text())

def run(args, cwd, *, success=True):
    result = subprocess.run(args, cwd=cwd, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    if (result.returncode == 0) != success:
        raise AssertionError(f'{args}: exit {result.returncode}\n{result.stdout}')
    return result.stdout

with tempfile.TemporaryDirectory(prefix='nightjar-standalone-test-') as temp:
    temporary = Path(temp)
    copy = temporary / 'source'
    for entry in entries:
        source = root / entry
        if source.is_symlink() or not source.is_file():
            raise SystemExit(f'Missing or symlinked source: {entry}')
        target = copy / entry
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
    assert not (copy / '.git').exists()
    (copy / '.env').write_text('private synthetic canary')
    (copy / 'unlisted-private.txt').write_text('private synthetic canary')
    archive_hashes = []
    for base in ('', '/preview'):
        dest = temporary / ('root' if not base else 'preview')
        run([sys.executable, 'nightjar/build.py', '--destination', str(dest), '--baseurl', base], copy)
        run([sys.executable, 'nightjar/verify-html.py', str(dest), '--baseurl', base], copy)
        archive_hashes.append(hashlib.sha256((dest / 'template.zip').read_bytes()).hexdigest())
        with zipfile.ZipFile(dest / 'template.zip') as archive:
            assert set(archive.namelist()) == set(entries)
            assert '.env' not in archive.namelist() and 'unlisted-private.txt' not in archive.namelist()
            if not base:
                unpacked = temporary / 'unpacked'
                archive.extractall(unpacked)
                assert not (unpacked / '.git').exists()
                rebuilt = temporary / 'rebuilt'
                run(['bundle', 'exec', 'jekyll', 'build', '--destination', str(rebuilt)], unpacked)
                run([sys.executable, 'nightjar/verify-html.py', str(rebuilt)], copy)
        assert not (dest / '.env').exists() and not (dest / 'unlisted-private.txt').exists()
    assert archive_hashes[0] == archive_hashes[1], 'identical source snapshots must produce identical archive bytes'
    data_path = copy / '_data/examples.json'
    data = json.loads(data_path.read_text())
    home = next(page for page in data['pages'] if page['id'] == 'home')
    home['sections'][0]['body'] += '\n\n<script>nightjar_marker()</script><img src="x" onerror="nightjar_marker()">'
    data_path.write_text(json.dumps(data))
    sanitized = temporary / 'sanitized'
    run([sys.executable, 'nightjar/build.py', '--destination', str(sanitized)], copy)
    rendered = (sanitized / 'examples/home/index.html').read_text()
    assert '<script>nightjar_marker()' not in rendered and 'onerror="nightjar_marker()"' not in rendered
    safe = temporary / 'safe'
    run([sys.executable, 'nightjar/build.py', '--destination', str(safe), '--safe'], copy)
    rendered_safe = (safe / 'examples/home/index.html').read_text()
    assert '<script>nightjar_marker()' not in rendered_safe and 'onerror="nightjar_marker()"' not in rendered_safe
    assert '&lt;script&gt;' in rendered_safe, 'safe mode must retain escaped content instead of executing it'
    run([sys.executable, 'nightjar/verify-html.py', str(safe)], copy)
    mark = copy / 'assets/mark.svg'
    mark.unlink()
    mark.symlink_to(temporary / 'external')
    assert 'Symlink is not allowed' in run([sys.executable, 'nightjar/build.py', '--destination', str(temporary / 'bad')], copy, success=False)
    mark.unlink()
    assert 'Missing source file' in run([sys.executable, 'nightjar/build.py', '--destination', str(temporary / 'bad')], copy, success=False)
    shutil.copy2(root / 'assets/mark.svg', mark)
    manifest = copy / 'nightjar/source-files.json'
    manifest.write_text(json.dumps(entries + ['../outside']))
    assert 'Unsafe source manifest' in run([sys.executable, 'nightjar/build.py', '--destination', str(temporary / 'bad')], copy, success=False)
    print('Standalone root, subpath, safe mode, archive rebuild and unsafe-input checks passed.')
