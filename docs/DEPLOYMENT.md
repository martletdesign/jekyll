# Native Cloudflare Jekyll delivery

Jekyll builds the site. Cloudflare Workers serves the generated static HTML, CSS, fonts and locally hosted images; it does not execute Ruby at request time.

The build command is `bash scripts/deployment/build-cloudflare.sh`. That script runs locked Bundler/Jekyll directly for root and `/preview`. Python only stages the source allowlist, verifies provenance, creates the deterministic source ZIP, retains frozen documentation, and hashes the already-built output. It does not invoke Ruby. Committed `.ruby-version` and `.node-version` files pin Ruby 3.2.11 and Node 24.19.0; no dashboard runtime or build variables are required. Bundler remains 2.4.19 and the existing Gemfile.lock pins Jekyll 4.3.2. Cloudflare may perform its normal dependency installation before the command; the script still explicitly verifies and installs the locked dependencies. `SKIP_DEPENDENCY_INSTALL=true` is an optional build-only optimization, never a runtime binding or a prerequisite. The integrity-locked local Wrangler is 4.156.2.

## Dashboard command fields during development validation

Replace each entire command field; do not append these commands to a generated `npm run build` or another existing value. Both repositories use the same three fields. No dashboard variables are mandatory.

In the parent Worker's Settings → Builds section, select **Previews Base** for the preview build and Preview commands below. The production deploy command belongs to the separate **Production** tab. The top environment breadcrumb may still say Production while the Previews Base tab is selected. Keep the repository root directory `/`.

Cloudflare copies base build settings into each new Preview. Updating the base does not automatically update every existing Preview; the Builds API supports `patch_existing_previews=true` for that purpose. A deleted `develop` Preview has no settings panel to inspect. Its absence must not be confused with a missing Git branch or a deleted parent Worker. See the [Builds API configuration rules](https://developers.cloudflare.com/workers/ci-cd/builds/api-reference/).

Check the actual run's `Executing user build command` line. During recovery, recorded retries continued to execute an older malformed command even while the current base showed the correct command. A corrected base screenshot therefore does not prove that a queued or retried job uses it. After correcting the base and deleting a Preview, verify a fresh Git-triggered build of a normally checked `develop` merge. Do not repeatedly retry the same stale run, make direct empty commits to develop, or count a manual artifact upload as this verification.


Build command:

```sh
bash scripts/deployment/build-cloudflare.sh
```

Nonproduction / Preview command:

```sh
bash scripts/deployment/preview-cloudflare.sh
```

Production deploy command while validation is paused:

```sh
exit 1
```

The paused production command must remain in place until an explicitly reviewed GitFlow production promotion is approved. A manual nonproduction upload is identified as manual evidence; it does not establish that the native Git-triggered build deployed successfully.

## GitFlow and one native deployment authority

Feature PRs target `develop`; GitHub Actions retains all existing source, archive, browser and release verification. Successful develop merges build the exact checked source tree through Cloudflare's native Git connection. Native preflight independently checks that the merged PR head has the identical Git tree and all six existing GitHub Actions checks passed, including Chromium, Firefox and WebKit. Public GitHub REST endpoints are used; a GitHub credential or CLI is not required. An optional read-only token can handle authenticated API rate limits, but missing verification never becomes a pass.

Cloudflare's documented Preview Builds switch triggers a preview build on every nonproduction branch push; it is not a develop-only filter. Feature branch native builds therefore appear as Cloudflare checks, while the source scripts reject unsupported branches before building or uploading. Only a verified `develop` merge may update the stable develop Preview. Keep the six GitHub verification checks separate from those expected native branch-guard rejections. See [Cloudflare build branches](https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/).

Cloudflare supplies `WORKERS_CI_BRANCH`; the build selects that Git branch automatically. `JEKYLL_DEPLOY_BRANCH` is only an explicit local override when the native branch is absent; conflicting nonempty branch signals fail before build or deploy. For the develop Preview, use the native nonproduction deploy command `bash scripts/deployment/preview-cloudflare.sh`. This invokes only `wrangler preview --name develop --ignore-base-config`, never production `wrangler deploy`. The exact parent Worker and supported native Preview URL are pinned in `infra/deployment/site.json`. The actual addresses are `develop-martletdesign-jekyll-reference.k3jph.workers.dev` and `develop-krigsvolddesign-jekyll-reference.k3jph.workers.dev`; the shorter proposed names would require different parent Workers. Preview runtime variables, secrets and bindings must be empty. Preview responses send `X-Robots-Tag: noindex, nofollow, noarchive` and a disallow-all robots.txt.

Keep production activation paused while development is being validated. After development acceptance, the production native command is `bash scripts/deployment/deploy-cloudflare.sh`. It requires Cloudflare’s main branch and invokes the main-only deployment guard after a reviewed release promotion. It requires a merged release/develop/hotfix PR into main, an actual nondismissed approval of the exact PR head, a current branch SHA and matching verified artifact. It cannot accept develop. No production merge or deployment is needed to demonstrate this task's development previews. Existing production Worker names, custom domains and routes remain unchanged; generated Wrangler configuration does not publish or replace routes.

Native Builds configuration requires a **user-scoped** token, which differs from a build deployment token. Account-owned tokens returning Invalid token do not establish a native Git connection. Do not claim a connection is active until Cloudflare settings/readback and an automatic Git-triggered build prove it. Do not enable a competing Actions deployment workflow. Connecting an existing production Worker may start an initial build; use a fail-closed paused production command during setup, never assume connection creation is nondeploying. Preview auto-build switches and Git connections must be read back from actual Cloudflare state.

## Authority and artifact boundaries

Use narrowly scoped build credentials and separate preview/production build settings. Native preview runtime isolation is distinct from build-token permissions: a parent-Worker Editor token may authorize production writes as well as previews. Do not claim that a preview-only deploy command makes that token preview-only. The supplied preview command cannot call production deploy, ignores dashboard Preview base bindings, and requires any emitted deployment `env` to be empty; the CLI may omit that field, so its omission does not prove the absence of runtime bindings or secrets. Any unresolved build-credential permission boundary must remain explicitly documented rather than silently accepting a broad account-wide token. Individual Worker Editor credentials can still configure bindings; the empty generated configuration is required, and complete runtime-binding readback remains a separate evidence requirement.

`infra/deployment/history.json` pins an archive of the existing `/docs/` and `/preview/docs/` history. Complete original file inventories and live manifests/source ZIPs were verified before capture. Extraction accepts only exact pinned regular files under those prefixes, rejects traversal/overwrites and never rebuilds v1.0.0 using new hero source. Original licenses, attribution and published ZIP bytes remain intact.

Current root and `/preview` source ZIPs are deterministic snapshots of this Git commit, not a claim that a changed VERSION=1.0.0 development artifact replaced the published v1.0.0 release. No npm package, tag, source-release asset or publishing identity is altered. Advanced R2 remains disabled.

Native `_headers` adds `Cache-Control: public, no-transform`, preventing automatic edge beacon injection or HTML changes without altering other sites' zone analytics. Deployment extras are outside frozen snapshots.

## Provenance, verification and rollback

`/.well-known/deployment.json` identifies repository, branch, full source SHA/tree, build timestamp, source ZIP hash, frozen-history digest, artifact inventory hash, target Worker and URL. `deployment-inventory.json` identifies all payload files; only those two self-referential manifests are excluded from the payload hash, and both are separately checked by exact live bytes.

The native Preview receipt logs actual preview and deployment IDs, URLs, source SHA, time, artifact hash, configured empty runtime bindings/vars and verified live file count. The receipt records `deploymentEnvFieldPresent` separately and retains `completeBindingReadbackClaimed: false`; omitted CLI `env` is not treated as proof of empty runtime state. Full HTTPS byte comparison covers the public payload, local images, root, `/preview` and frozen documentation. HTML must retain no-transform, and development must retain noindex. It does not assert external website availability, manual accessibility certification or visual fidelity.

The main-only production helper records the prior single-version deployment, publishes exactly the checked artifact, reads actual version/deployment IDs, checks bindings and compares live bytes. Failed verification remains a failure. It restores the previous version only when the failed current version bears this job's exact source annotation and no newer actor replaced it; it will not overwrite another deployment. Rollback failures are reported explicitly. Preserve native build logs/receipts and the last-good revision.

Visual review still compares actual desktop/tablet/mobile, light/dark, imagery, source typography, navigation and cropping against jameshoward.us and krigsvold.org. Automated checks alone do not certify visual fidelity.

Live payload verification has a 300-second overall deadline, at most four in-flight requests, and a 25-second whole-request deadline. A 404 or a 200 response containing stale bytes may retry with capped exponential backoff for at most 30 seconds per file, within the same overall deadline. Matching bytes must still pass every header assertion; transport failures and other HTTP errors remain failures without retry. Permanent mismatch diagnostics include the path, attempt count, status, byte counts and expected/actual SHA-256. Cancellation stops further retries and unwinds within at most 30 additional seconds. The Preview upload command has its own 300-second limit. Failed checks and timeouts remain failures.

When Cloudflare supplies its documented native build UUID, commit and branch, `.well-known/deployment.json` records those three validated, whitelisted fields in `cloudflareBuild`. Builds outside native Cloudflare CI record `null`. These are environment-reported identifiers, not independent attestation; preserve the corresponding native build log/link to prove the trigger. No credentials or other environment values are copied.
