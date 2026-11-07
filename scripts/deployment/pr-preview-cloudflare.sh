#!/usr/bin/env bash
set -euo pipefail
# Unmerged branches may deploy a named, noindex Cloudflare Preview only.
# No custom-domain, environment, secret, or production route configuration.
branch="${WORKERS_CI_BRANCH:-${JEKYLL_DEPLOY_BRANCH:-}}"
[[ -n "$branch" && "$branch" != develop && "$branch" != main ]] || { echo "Not a PR preview branch" >&2; exit 1; }
test -d .cloudflare-site
test -f .cloudflare-pr-name
name="$(cat .cloudflare-pr-name)"
[[ "$name" =~ ^pr-[a-z0-9-]{1,40}$ ]] || { echo "Invalid preview name" >&2; exit 1; }
npm ci --prefix infra/deployment --ignore-scripts --no-audit --no-fund
python3 scripts/deployment/pr-preview-verify.py before-upload
timeout 300s node infra/deployment/node_modules/wrangler/bin/wrangler.js preview --name "$name" --config .cloudflare-wrangler.pr.json --ignore-base-config --message "$(git rev-parse HEAD)" --json > .cloudflare-pr-result.json
python3 scripts/deployment/pr-preview-verify.py record
echo "PR_PREVIEW_PUBLISHED name=$name sha=$(git rev-parse HEAD)"
