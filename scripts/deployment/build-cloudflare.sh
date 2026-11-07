#!/usr/bin/env bash
set -euo pipefail
if [[ -n "${WORKERS_CI_BRANCH:-}" && -n "${JEKYLL_DEPLOY_BRANCH:-}" && "$WORKERS_CI_BRANCH" != "$JEKYLL_DEPLOY_BRANCH" ]]; then
  echo 'Conflicting native and local GitFlow branch signals' >&2
  exit 1
fi
branch="${WORKERS_CI_BRANCH:-${JEKYLL_DEPLOY_BRANCH:-develop}}"
case "$branch" in
  develop|main) ;;
  *)
    # PR/feature branches are allowed to create isolated previews only.
    # The protected develop/main verifier remains unchanged below.
    export BUNDLE_FROZEN=true
    export BUNDLE_PATH="${BUNDLE_PATH:-vendor/bundle}"
    python3 scripts/deployment/pr-preview-source.py
    gem install bundler --version 2.4.19 --no-document
    bundle _2.4.19_ install --jobs 4 --retry 2
    bundle _2.4.19_ exec jekyll build --source .cloudflare-source --config .cloudflare-source/_config.yml,.cloudflare-render.yml --destination .cloudflare-site --baseurl '' --strict_front_matter --trace
    bundle _2.4.19_ exec jekyll build --source .cloudflare-source --config .cloudflare-source/_config.yml,.cloudflare-render.yml --destination .cloudflare-site/preview --baseurl /preview --strict_front_matter --trace
    python3 scripts/deployment/pr-preview-verify.py finalize
    echo "PR_PREVIEW_ONLY: $branch"
    exit 0
    ;;
esac
export BUNDLE_FROZEN=true
export BUNDLE_PATH="${BUNDLE_PATH:-vendor/bundle}"
gem install bundler --version 2.4.19 --no-document
bundle _2.4.19_ install --jobs 4 --retry 2
# Python only stages the reviewed source allowlist and checks provenance.
python3 scripts/deployment/native.py stage --branch "$branch"
# Jekyll is the site builder. Ruby runs directly here, not through Python.
bundle _2.4.19_ exec jekyll build --source .cloudflare-source --config .cloudflare-source/_config.yml,.cloudflare-render.yml --destination .cloudflare-site --baseurl '' --strict_front_matter --trace
bundle _2.4.19_ exec jekyll build --source .cloudflare-source --config .cloudflare-source/_config.yml,.cloudflare-render.yml --destination .cloudflare-site/preview --baseurl /preview --strict_front_matter --trace
# Finalize the existing output: source ZIP, frozen history, headers and hashes.
python3 scripts/deployment/native.py finalize --branch "$branch"
