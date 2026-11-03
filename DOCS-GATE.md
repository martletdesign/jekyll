# Jekyll documentation and source release gate

Issue #81 authorizes the normal static documentation build path while advanced remote archive guarantees remain unmet. `release-policy.json` therefore selects `static-source` and explicitly disables the advanced R2 pathway. No production Worker/R2 binding is introduced by this repository.

Before uploading a release artifact, `scripts/verify_docs.py --build DIRECTORY` checks all 50 rendered recipe destinations, all local links/assets/fragments through the existing HTML verifier, and the complete deterministic source ZIP against the current allowlist and exact checkout bytes. The release job rechecks the downloaded ZIP with `--archive` before creating a release; checksums and exact downloaded release bytes are also verified. Missing arguments, altered/missing source bytes, duplicate/unsafe ZIP members, unexpected archive entries, policy changes enabling an unverified remote pathway and incomplete static outputs fail closed.

R2 gateway, manifest-integrity, content-addressed history, CAS/promotion/rollback and interrupted-publication tests remain in the repository. Passing those does not establish Worker-only IAM, administrator immutability or independent current-head anti-rollback protection. Those advanced guarantees remain deferred, and the extension stays disabled until separately implemented and verified.
