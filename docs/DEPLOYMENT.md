# Native Cloudflare Jekyll delivery

Jekyll builds the site. Cloudflare Workers serves the generated static HTML, CSS, fonts and locally hosted images; it does not execute Ruby at request time.

The build command is `bash scripts/deployment/build-cloudflare.sh`. That script runs locked Bundler/Jekyll directly for root and `/preview`. Python only stages the source allowlist, verifies provenance, creates the deterministic source ZIP, retains frozen documentation, and hashes the already-built output. It does not invoke Ruby. Ruby is pinned through the native build variable `RUBY_VERSION=3.2.11`; Bundler remains 2.4.19 and the existing Gemfile.lock pins Jekyll 4.3.2. Set `NODE_VERSION=24.19.0` and `SKIP_DEPENDENCY_INSTALL=true`. The integrity-locked local Wrangler is 4.156.2.

## GitFlow and one native deployment authority

Feature PRs target `develop`; GitHub Actions retains all existing source, archive, browser and release verification. Successful develop merges build the exact checked source tree through Cloudflare's native Git connection. Native preflight independently checks that the merged PR head has the identical Git tree and all six existing GitHub Actions checks passed, including Chromium, Firefox and WebKit. Public GitHub REST endpoints are used; a GitHub credential or CLI is not required. An optional read-only token can handle authenticated API rate limits, but missing verification never becomes a pass.

Cloudflare supplies `WORKERS_CI_BRANCH`; the build selects that Git branch automatically. `JEKYLL_DEPLOY_BRANCH` is only an explicit local override. For the develop Preview, use the native nonproduction deploy command `bash scripts/deployment/preview-cloudflare.sh`. This invokes only `wrangler preview --name develop --ignore-base-config`, never production `wrangler deploy`. The exact parent Worker and supported native Preview URL are pinned in `infra/deployment/site.json`. The actual addresses are `develop-martletdesign-jekyll-reference.k3jph.workers.dev` and `develop-krigsvolddesign-jekyll-reference.k3jph.workers.dev`; the shorter proposed names would require different parent Workers. Preview runtime variables, secrets and bindings must be empty. Preview responses send `X-Robots-Tag: noindex, nofollow, noarchive` and a disallow-all robots.txt.

Keep production activation paused while development is being validated. After development acceptance, the production native command is `bash scripts/deployment/deploy-cloudflare.sh`. It requires Cloudflare’s main branch and invokes the main-only deployment guard after a reviewed release promotion. It requires a merged release/develop/hotfix PR into main, an actual nondismissed approval of the exact PR head, a current branch SHA and matching verified artifact. It cannot accept develop. No production merge or deployment is needed to demonstrate this task's development previews. Existing production Worker names, custom domains and routes remain unchanged; generated Wrangler configuration does not publish or replace routes.

Native Builds configuration requires a **user-scoped** token, which differs from a build deployment token. Account-owned tokens returning Invalid token do not establish a native Git connection. Do not claim a connection is active until Cloudflare settings/readback and an automatic Git-triggered build prove it. Do not enable a competing Actions deployment workflow. Connecting an existing production Worker may start an initial build; use a fail-closed paused production command during setup, never assume connection creation is nondeploying. Preview auto-build switches and Git connections must be read back from actual Cloudflare state.

## Authority and artifact boundaries

Use narrowly scoped build credentials and separate preview/production build settings. Native preview runtime isolation is distinct from build-token permissions: a parent-Worker Editor token may authorize production writes as well as previews. Do not claim that a preview-only deploy command makes that token preview-only. The supplied preview command cannot call production deploy, ignores dashboard Preview base bindings, and verifies the emitted Preview has no runtime bindings or secrets. Any unresolved build-credential permission boundary must remain explicitly documented rather than silently accepting a broad account-wide token. Individual Worker Editor credentials can still configure bindings; the empty generated configuration and readback are therefore required checks.

`infra/deployment/history.json` pins an archive of the existing `/docs/` and `/preview/docs/` history. Complete original file inventories and live manifests/source ZIPs were verified before capture. Extraction accepts only exact pinned regular files under those prefixes, rejects traversal/overwrites and never rebuilds v1.0.0 using new hero source. Original licenses, attribution and published ZIP bytes remain intact.

Current root and `/preview` source ZIPs are deterministic snapshots of this Git commit, not a claim that a changed VERSION=1.0.0 development artifact replaced the published v1.0.0 release. No npm package, tag, source-release asset or publishing identity is altered. Advanced R2 remains disabled.

Native `_headers` adds `Cache-Control: public, no-transform`, preventing automatic edge beacon injection or HTML changes without altering other sites' zone analytics. Deployment extras are outside frozen snapshots.

## Provenance, verification and rollback

`/.well-known/deployment.json` identifies repository, branch, full source SHA/tree, build timestamp, source ZIP hash, frozen-history digest, artifact inventory hash, target Worker and URL. `deployment-inventory.json` identifies all payload files; only those two self-referential manifests are excluded from the payload hash, and both are separately checked by exact live bytes.

The native Preview receipt logs actual preview and deployment IDs, URLs, source SHA, time, artifact hash, empty runtime bindings and verified live file count. Full HTTPS byte comparison covers the public payload, local images, root, `/preview` and frozen documentation. HTML must retain no-transform, and development must retain noindex. It does not assert external website availability, manual accessibility certification or visual fidelity.

The main-only production helper records the prior single-version deployment, publishes exactly the checked artifact, reads actual version/deployment IDs, checks bindings and compares live bytes. Failed verification remains a failure. It restores the previous version only when the failed current version bears this job's exact source annotation and no newer actor replaced it; it will not overwrite another deployment. Rollback failures are reported explicitly. Preserve native build logs/receipts and the last-good revision.

Visual review still compares actual desktop/tablet/mobile, light/dark, imagery, source typography, navigation and cropping against jameshoward.us and krigsvold.org. Automated checks alone do not certify visual fidelity.

Live payload verification has a 300-second overall deadline, at most four in-flight requests, and a 25-second whole-request deadline. Cancellation unwinds within at most 30 additional seconds. The Preview upload command has its own 300-second limit. Failed checks and timeouts remain failures.
