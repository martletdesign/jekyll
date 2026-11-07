# Native Cloudflare Jekyll delivery

Jekyll builds the site. Cloudflare Workers serves the generated static HTML, CSS, fonts and locally hosted images; it does not execute Ruby at request time.

The build command is `bash scripts/deployment/build-cloudflare.sh`. That script runs locked Bundler/Jekyll directly for root and `/preview`. Python only stages the source allowlist, verifies provenance, creates the deterministic source ZIP, retains frozen documentation, and hashes the already-built output. It does not invoke Ruby. Committed `.ruby-version` and `.node-version` files pin Ruby 3.2.11 and Node 24.19.0; no dashboard runtime or build variables are required. Bundler remains 2.4.19 and the existing Gemfile.lock pins Jekyll 4.3.2. Cloudflare may perform its normal dependency installation before the command; the script still explicitly verifies and installs the locked dependencies. `SKIP_DEPENDENCY_INSTALL=true` is an optional build-only optimization, never a runtime binding or a prerequisite. The integrity-locked local Wrangler is 4.156.2.

## Native build and deployment commands

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

Production deploy command:

```sh
bash scripts/deployment/deploy-cloudflare.sh
```

Production publishes accepted `main` source; development publishes accepted `develop` source. Keep production paused with `exit 1` only while an authorized production activation is still pending, then replace the entire field with the production command above. Do not use `exec 1`, a raw Wrangler deploy command, or automatic project initialization. A manual upload must be identified as manual evidence; it does not establish that a native Git-triggered build deployed successfully.

## GitFlow and one native deployment authority

The canonical policy is [GitFlow acceptance and deployment authority](https://github.com/k3jph/design-workbench/blob/develop/docs/GITFLOW-ACCEPTANCE.md). Feature and fix PRs target `develop`; eligible release changes are promoted into `main` through GitFlow. Integration into either accepted branch is the acceptance event. This repository has one required fast GitHub Actions check, `verify`, and zero required human reviewers. Browser, archive, compatibility and visual suites remain useful advisory measurements; candidate branches may fail without acquiring production authority.

Cloudflare checks the current accepted branch SHA against the checkout and any native builder-reported branch/SHA. It then validates the source allowlist, deterministic archive and artifact integrity before publication, followed by live payload verification and controlled rollback. It does not query PRs, reviews, check-runs or historical CI results. A bounded public Git ref lookup establishes current branch identity; it is not a second acceptance or attestation system. A GitHub credential or CLI is not required for that public lookup. An optional read-only token can handle authenticated API rate limits; source identity or artifact failures still fail safely.

Cloudflare's documented Preview Builds switch triggers a preview build on every nonproduction branch push; it is not a develop-only filter. Candidate branches can produce an isolated, noindex preview on a best-effort basis, but never authorize production or update the stable develop Preview. Only the current accepted `develop` commit may update that Preview. A candidate preview failure is advisory and is not a new integration requirement. See [Cloudflare build branches](https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/).

Cloudflare supplies `WORKERS_CI_BRANCH`; the build selects that Git branch automatically. `JEKYLL_DEPLOY_BRANCH` is only an explicit local override when the native branch is absent; conflicting nonempty branch signals fail before build or deploy. For the develop Preview, use the native nonproduction deploy command `bash scripts/deployment/preview-cloudflare.sh`. This invokes only `wrangler preview --name develop --ignore-base-config`, never production `wrangler deploy`. The exact parent Worker and supported native Preview URL are pinned in `infra/deployment/site.json`. The actual addresses are `develop-martletdesign-jekyll-reference.k3jph.workers.dev` and `develop-krigsvolddesign-jekyll-reference.k3jph.workers.dev`; the shorter proposed names would require different parent Workers. Preview runtime variables, secrets and bindings must be empty. Preview responses send `X-Robots-Tag: noindex, nofollow, noarchive` and a disallow-all robots.txt.

The production helper requires Cloudflare's `main` branch, the exact current `main` SHA and a matching verified artifact. It cannot accept `develop`. GitHub's protected-branch integration already supplies acceptance; deployment does not impose an additional PR approval, reviewer, CI-history or attestation stage. A completed build alone is not production evidence: verify the actual production URL against its accepted source and payload. Existing production Worker names, custom domains and routes remain unchanged; generated Wrangler configuration does not publish or replace routes.

Native Builds configuration requires a **user-scoped** token, which differs from a build deployment token. Account-owned tokens returning Invalid token do not establish a native Git connection. Do not claim a connection is active until Cloudflare settings/readback and an automatic Git-triggered build prove it. Do not enable a competing Actions deployment workflow. Connecting an existing production Worker may start an initial build; use a fail-closed paused production command during setup, never assume connection creation is nondeploying. Preview auto-build switches and Git connections must be read back from actual Cloudflare state.

## Authority and artifact boundaries

Use narrowly scoped build credentials and separate preview/production build settings. Native preview runtime isolation is distinct from build-token permissions: a parent-Worker Editor token may authorize production writes as well as previews. Do not claim that a preview-only deploy command makes that token preview-only. The supplied preview command cannot call production deploy, ignores dashboard Preview base bindings, and requires any emitted deployment `env` to be empty; the CLI may omit that field, so its omission does not prove the absence of runtime bindings or secrets. Any unresolved build-credential permission boundary must remain explicitly documented rather than silently accepting a broad account-wide token. Individual Worker Editor credentials can still configure bindings; the empty generated configuration is required, and complete runtime-binding readback remains a separate evidence requirement.

`infra/deployment/history.json` pins an archive of the existing `/docs/` and `/preview/docs/` history. Complete original file inventories and live manifests/source ZIPs were verified before capture. Extraction accepts only exact pinned regular files under those prefixes, rejects traversal/overwrites and never rebuilds v1.0.0 using new hero source. Original licenses, attribution and published ZIP bytes remain intact.

Current root and `/preview` source ZIPs are deterministic snapshots of this Git commit. Deployment does not replace historical versioned releases or publish a new source release by itself. Source publication separately requires the correct `VERSION`, an eligible protected `v*` tag and verified `source.zip`/`SHA256SUMS` GitHub Release assets. Existing tags, releases and assets must never be overwritten. No npm publication is part of Jekyll delivery. Advanced R2 remains disabled.

Native `_headers` adds `Cache-Control: public, no-transform`, preventing automatic edge beacon injection or HTML changes without altering other sites' zone analytics. Deployment extras are outside frozen snapshots.

## Provenance, verification and rollback

`/.well-known/deployment.json` identifies repository, branch, full source SHA/tree, build timestamp, source ZIP hash, frozen-history digest, artifact inventory hash, target Worker and URL. `deployment-inventory.json` identifies all payload files; only those two self-referential manifests are excluded from the payload hash, and both are separately checked by exact live bytes.

The native Preview receipt logs actual preview and deployment IDs, URLs, source SHA, time, artifact hash, configured empty runtime bindings/vars and verified live file count. The receipt records `deploymentEnvFieldPresent` separately and retains `completeBindingReadbackClaimed: false`; omitted CLI `env` is not treated as proof of empty runtime state. Full HTTPS byte comparison covers the public payload, local images, root, `/preview` and frozen documentation. HTML must retain no-transform, and development must retain noindex. It does not assert external website availability, manual accessibility certification or visual fidelity.

The main-only production helper records the prior single-version deployment, publishes exactly the checked artifact, reads actual version/deployment IDs, checks bindings and compares live bytes. Failed verification remains a failure. It restores the previous version only when the failed current version bears this job's exact source annotation and no newer actor replaced it; it will not overwrite another deployment. Rollback failures are reported explicitly. Preserve native build logs/receipts and the last-good revision.

Visual review still compares actual desktop/tablet/mobile, light/dark, imagery, source typography, navigation and cropping against jameshoward.us and krigsvold.org. Automated checks alone do not certify visual fidelity.

Live payload verification has a 300-second overall deadline, at most four in-flight requests, and a 25-second whole-request deadline. A 404 or a 200 response containing stale bytes may retry with capped exponential backoff for at most 30 seconds per file, within the same overall deadline. Matching bytes must still pass every header assertion; transport failures and other HTTP errors remain failures without retry. Permanent mismatch diagnostics include the path, attempt count, status, byte counts and expected/actual SHA-256. Cancellation stops further retries and unwinds within at most 30 additional seconds. The Preview upload command has its own 300-second limit. Failed checks and timeouts remain failures.

When Cloudflare supplies its documented native build UUID, commit and branch, `.well-known/deployment.json` records those three validated, whitelisted fields in `cloudflareBuild`. Builds outside native Cloudflare CI record `null`. These are environment-reported identifiers, not independent attestation; preserve the corresponding native build log/link to prove the trigger. No credentials or other environment values are copied.
