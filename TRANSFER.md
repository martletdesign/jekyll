# Nightjar IV source transfer candidate

This draft imports the attributed Jekyll snapshot from the Nightjar III landmark correction, preserving its per-file provenance in `nightjar/PROVENANCE.json`. The dedicated repository is the proposed future owner; the current shared workbench catalog, fixtures and generator remain in place until a separate reviewed authority transition. Its existing consumers and publishing paths are not changed by this draft.

Run `bundle install --deployment` and `BUNDLE_FROZEN=true python3 nightjar/verify.py` to verify root and subpath builds, safe rendering, the source archive, archive reconstruction and unsafe-source rejection without a workbench checkout. See `nightjar/README.md` for details. GitHub Actions runs this nonpublishing verification on pull requests to develop.

The snapshot is a genuine Jekyll source tree, not rendered HTML. Release tagging, versioned documentation infrastructure, archive hosting, cross-framework conformance and an ownership transition are not yet implemented by this import. No release, deployment or publication is enabled here.
