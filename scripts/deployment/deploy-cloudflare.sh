#!/usr/bin/env bash
set -euo pipefail
branch="${JEKYLL_DEPLOY_BRANCH:-${WORKERS_CI_BRANCH:-}}"
if [ "$branch" != main ]; then
  echo 'Production deployment requires the main branch' >&2
  exit 1
fi
python3 scripts/deployment/native.py verify --branch main
timeout 900s python3 scripts/deployment/deploy.py --branch main --sha "$(git rev-parse HEAD)" --directory .cloudflare-site --receipt .cloudflare-production-receipt.json
cat .cloudflare-production-receipt.json
