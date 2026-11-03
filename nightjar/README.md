# Martlet Jekyll standalone source

This repository owns the standalone Jekyll implementation. The shared catalog, representative fixtures, schemas and conformance contract remain coordinated in design-workbench. `PROVENANCE.json` retains the immutable extraction mapping from workbench `5141857be03d103732275fb18e05e042505381df`; later commits in this repository identify subsequent changes.

Install the locked gems, then run `BUNDLE_FROZEN=true python3 nightjar/verify.py`. Build with `python3 nightjar/build.py --destination /absolute/output` and optionally `--baseurl /preview` or `--safe`. The build reads only this checkout and preinstalled locked gems, then creates a deterministic allowlisted source archive. Verification unpacks and rebuilds that archive without Git metadata, checks links/security fallbacks and rejects unsafe inputs.

The advanced R2 archive extension remains disabled. Ordinary static builds and versioned source releases use the policy and validation documented in `DOCS-GATE.md`. No historic theme release is modified.
