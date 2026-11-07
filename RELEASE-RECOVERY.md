# Jekyll source-release recovery

The source-release workflow is enabled under Issue #81 standing authorization. A versioned release follows GitFlow and requires a protected immutable tag identifying the exact `VERSION` on main first-parent history. The guard rechecks remote main and tag identity. No npm publication is involved.

If a run stops before GitHub Release creation, preserve the run and its source archive and investigate the failing check. Never replace a tag. If creation might have succeeded, inspect the existing release and download both `source.zip` and `SHA256SUMS` from GitHub; verify the checksum against the source archive retained by the original run, confirm the exact repository, tag, commit, version and approved build. If any result differs or cannot be established, stop and investigate; never overwrite assets or retry publication automatically. If the release and assets are present and exactly match, record the run and recovery evidence. If a release exists with missing assets, coordinate manual recovery only after comparing the retained build, immutable tag and existing assets. Re-running the release job is intentionally rejected whenever a release already exists.

The ordinary static documentation/source path is verified explicitly; advanced remote archive serving is disabled in `release-policy.json`. No administrator-immutable archive or independent anti-rollback guarantee is asserted. Protected tag rules remain mandatory for source release execution.

The release guard compares fetched `origin/main` with the live remote main tip before trusting first-parent ancestry. Missing or stale production refs fail closed; review remote changes, fetch approved main, and retry verification. This does not replace administrator-enforced protection or prove later concurrent branch updates cannot occur.

## Accepted branches and separate source publication

Follow the canonical [GitFlow acceptance policy](https://github.com/k3jph/design-workbench/blob/develop/docs/GITFLOW-ACCEPTANCE.md). Pull-request integration into protected `develop` or `main` is the acceptance event. Jekyll has one required fast check, `verify`, and zero required human reviewers. Extended browser, archive, compatibility and visual checks remain advisory; their historical results are not reconstructed by the deployment host.

Production delivery verifies the current accepted `main` SHA, builder/checkout identity, deterministic artifact and live payload. It does not query PR approvals, reviewers or check-run history. Source or artifact identity failures remain failures, and controlled rollback is preserved.

After production verification, source publication separately requires the exact release `VERSION`, a new protected immutable tag on eligible main first-parent history, deterministic `source.zip`, verified `SHA256SUMS` and genuine GitHub Release assets. Never replace an existing tag, release or asset. These publication safeguards remain mandatory and do not introduce another human review or deployment-attestation stage. No npm publication is involved.
