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
python3 - "$PWD" <<'PY'
import json,pathlib,sys
root=pathlib.Path(sys.argv[1])
site=json.loads((root/"infra/deployment/site.json").read_text())
assert site["targets"]["develop"]["worker"]==site["targets"]["main"]["worker"]
cfg={"name":site["targets"]["develop"]["worker"],"account_id":site["accountId"],"compatibility_date":"2026-11-03","workers_dev":True,"assets":{"directory":str((root/".cloudflare-site").resolve()),"html_handling":"auto-trailing-slash","not_found_handling":"404-page"},"previews":{"vars":{}}}
(root/".cloudflare-wrangler.pr.json").write_text(json.dumps(cfg,sort_keys=True)+"\n")
PY
npm ci --prefix infra/deployment --ignore-scripts --no-audit --no-fund
timeout 300s node infra/deployment/node_modules/wrangler/bin/wrangler.js preview --name "$name" --config .cloudflare-wrangler.pr.json --ignore-base-config --message "$(git rev-parse HEAD)" --json > .cloudflare-pr-result.json
cat .cloudflare-pr-result.json
echo "PR_PREVIEW_PUBLISHED name=$name sha=$(git rev-parse HEAD)"
