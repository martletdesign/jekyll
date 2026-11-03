# Martlet Jekyll — local extraction rehearsal

This is an attributed local snapshot of the generated export at workbench `5141857be03d103732275fb18e05e042505381df`. It is not an upstream source-authority transfer or a new published theme. See `PROVENANCE.json` for file-level mappings and immutable blob hashes. Shared catalog, fixtures, schemas and generator remain owned by the workbench.

Install the locked gems ahead of time, then run `BUNDLE_FROZEN=true python3 nightjar/verify.py`. Build with `python3 nightjar/build.py --destination /absolute/output` and optionally `--baseurl /preview` or `--safe`. The build reads only this checkout and preinstalled locked gems; it makes a source archive from the explicit allowlist. `verify.py` rebuilds an unpacked archive without Git metadata, checks links, security fallbacks and rejects unsafe source inputs. The included `ci-proposal.yml` is inactive and must be reviewed before any future use.

Conformance inputs must be explicitly pinned to workbench `5141857be03d103732275fb18e05e042505381df`; no runtime checkout or fetch is performed here. Do not make this snapshot authoritative or publish it without separate approval.
