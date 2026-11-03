#!/usr/bin/env bash
set -euo pipefail
python3 scripts/deployment/native.py verify --branch develop
timeout 300s node infra/deployment/node_modules/wrangler/bin/wrangler.js preview --name develop --config .cloudflare-wrangler.develop.json --ignore-base-config --message "$(git rev-parse HEAD)" --json > .cloudflare-preview-result.json
python3 scripts/deployment/native.py record --branch develop
