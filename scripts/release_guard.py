#!/usr/bin/env python3
"""Fail closed unless a protected tag identifies a version on main's first-parent history."""
import os
import re
import subprocess
from pathlib import Path

SEMVER = re.compile(r'(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?')

def require(ok, message):
    if not ok:
        raise SystemExit(message)

def git(*args):
    r = subprocess.run(['git', *args], text=True, capture_output=True, check=False)
    require(r.returncode == 0, f'git {args[0]} failed: {r.stderr.strip()}')
    return r.stdout.strip()

def main():
    ref = os.environ.get('GITHUB_REF', '')
    require(os.environ.get('GITHUB_EVENT_NAME') == 'push', 'expected tag push')
    require(os.environ.get('GITHUB_REF_TYPE') == 'tag' and ref.startswith('refs/tags/v'), 'expected version tag')
    require(os.environ.get('GITHUB_REF_PROTECTED') == 'true', 'tag is not protected')
    version = ref.removeprefix('refs/tags/v')
    m = SEMVER.fullmatch(version)
    require(m is not None, 'invalid semantic version')
    require(not m.group(4) or all(not (x.isdigit() and len(x)>1 and x.startswith('0')) for x in m.group(4).split('.')), 'invalid numeric prerelease identifier')
    require(Path('VERSION').read_text().strip() == version, 'VERSION does not match tag')
    sha = os.environ.get('GITHUB_SHA', '')
    require(re.fullmatch(r'[0-9a-f]{40}', sha) is not None, 'invalid event SHA')
    require(git('rev-parse', ref+'^{commit}') == sha, 'tag commit does not match event')
    require(git('rev-parse', 'HEAD') == sha, 'checked-out commit does not match event')
    require(sha in git('rev-list', '--first-parent', 'refs/remotes/origin/main').splitlines(), 'commit is not on first-parent main history')
    local = git('rev-parse', ref)
    remote = git('ls-remote', '--exit-code', 'origin', ref).splitlines()
    require(len(remote) == 1 and remote[0] == f'{local}\t{ref}', 'remote tag identity differs')
    print(f'Protected {ref} resolves to {sha} on main first-parent history')

if __name__ == '__main__':
    main()
