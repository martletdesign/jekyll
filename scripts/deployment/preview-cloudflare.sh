#!/usr/bin/env bash
set -euo pipefail
if [[ -n "${WORKERS_CI_BRANCH:-}" && -n "${JEKYLL_DEPLOY_BRANCH:-}" && "$WORKERS_CI_BRANCH" != "$JEKYLL_DEPLOY_BRANCH" ]]; then
  echo "Conflicting native and local GitFlow branch signals" >&2
  exit 1
fi
branch="${WORKERS_CI_BRANCH:-${JEKYLL_DEPLOY_BRANCH:-develop}}"
if [[ "$branch" != develop ]]; then
  if [[ "$branch" = main ]]; then
    echo "Production cannot use a Preview command" >&2
    exit 1
  fi
  exec bash scripts/deployment/pr-preview-cloudflare.sh
fi
python3 scripts/deployment/native.py verify --branch develop
timeout 300s node infra/deployment/node_modules/wrangler/bin/wrangler.js preview --name develop --config .cloudflare-wrangler.develop.json --ignore-base-config --message "$(git rev-parse HEAD)" --json > .cloudflare-preview-result.json
python3 scripts/deployment/native.py record --branch develop
