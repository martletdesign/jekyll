# Standalone Jekyll source authority

Issue #81 authorizes integration of the attributed Jekyll snapshot and its reviewed follow-up safeguards. `martletdesign/jekyll` owns the standalone Jekyll implementation and versioned source releases. The public workbench remains the shared 50-recipe, fixture/schema and cross-framework conformance coordinator; it is not a competing Jekyll publishing authority. Historical file-level extraction provenance remains in `nightjar/PROVENANCE.json`.

Run locked `bundle install` and `BUNDLE_FROZEN=true python3 nightjar/verify.py` to verify root/subpath builds, safe rendering, exact deterministic source archives, archive reconstruction without Git or workbench metadata and unsafe-source rejection. Browser CI retains Chromium, Firefox and WebKit. The ordinary static build path is enabled; advanced R2 serving remains explicitly disabled and cannot claim unverified immutability or anti-rollback protection.
