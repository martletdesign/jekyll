# Jekyll source-release recovery

The source-release workflow is enabled under Issue #81 standing authorization. A versioned release follows GitFlow and requires a protected immutable tag identifying the exact `VERSION` on main first-parent history. The guard rechecks remote main and tag identity. No npm publication is involved.

If a run stops before GitHub Release creation, preserve the run and its source archive and investigate the failing check. Never replace a tag. If creation might have succeeded, inspect the existing release and download both `source.zip` and `SHA256SUMS` from GitHub; verify the checksum against the source archive retained by the original run, confirm the exact repository, tag, commit, version and approved build. If any result differs or cannot be established, stop and investigate; never overwrite assets or retry publication automatically. If the release and assets are present and exactly match, record the run and recovery evidence. If a release exists with missing assets, coordinate manual recovery only after comparing the retained build, immutable tag and existing assets. Re-running the release job is intentionally rejected whenever a release already exists.

The ordinary static documentation/source path is verified explicitly; advanced remote archive serving is disabled in `release-policy.json`. No administrator-immutable archive or independent anti-rollback guarantee is asserted. Protected tag rules remain mandatory for source release execution.

The release guard compares fetched `origin/main` with the live remote main tip before trusting first-parent ancestry. Missing or stale production refs fail closed; review remote changes, fetch approved main, and retry verification. This does not replace administrator-enforced protection or prove later concurrent branch updates cannot occur.

## Single-maintainer GitFlow production gate

Both design-language repositories have one human maintainer (`howardjp`).
GitHub does not permit a pull-request author to approve their own PR.
The production deployment gate therefore accepts either:

1. A genuine independent `APPROVED` review of the exact PR head, or
2. An actual merge by `howardjp` of a PR authored by `howardjp`, provided
   the PR targets `main`, uses an accepted `develop`/`release/*`/`hotfix/*`
   head, and all six GitHub Actions jobs succeed at that **exact head SHA**.

The six mandatory results are `verify`, `guard`, `archive-build`,
`browser (chromium)`, `browser (firefox)`, and `browser (webkit)`.
A stale, missing, duplicate, non-GitHub-Actions or failed check blocks release;
outstanding `CHANGES_REQUESTED` reviews also block promotion.
No comments are represented as independent approvals. This replaces an
impossible second-reviewer condition; it does not bypass any GitHub protection
or relax protected-tag, source-archive, payload, or deployment identity checks.

If the check-runs API is unreachable or incomplete, release fails closed.
