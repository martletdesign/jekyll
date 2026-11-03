#!/usr/bin/env python3
"""A missing GitHub release is the only acceptable pre-publication response."""
import os
import json
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

repository = os.environ['GITHUB_REPOSITORY']
tag = os.environ['GITHUB_REF_NAME']
token = os.environ['GH_TOKEN']
headers = {'Authorization': f'Bearer {token}', 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28'}
base = f'https://api.github.com/repos/{repository}'
try:
    with urlopen(Request(base, headers=headers), timeout=15) as response:
        if json.load(response).get('full_name', '').lower() != repository.lower():
            raise SystemExit('GitHub repository identity mismatch')
except (HTTPError, URLError, ValueError) as error:
    raise SystemExit(f'Cannot verify GitHub repository identity: {error}')
request = Request(f'{base}/releases/tags/{quote(tag, safe="")}', headers=headers)
try:
    with urlopen(request, timeout=15):
        raise SystemExit('Release already exists; use documented recovery and do not publish again')
except HTTPError as error:
    if error.code != 404:
        raise SystemExit(f'GitHub release lookup failed: HTTP {error.code}')
except URLError as error:
    raise SystemExit(f'GitHub release lookup failed: {error.reason}')
print('No existing release')
