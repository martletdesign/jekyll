# Verification evidence — October 28, 2026

## Completed

- Portable schema, unique IDs, destination graph, rectangular tables, semantic article/event requirements, and four negative contract cases passed for all 46 recipes.
- Both materialised catalogs match the canonical content. Both exported authoritative shell SHA-256 values remain unchanged.
- Actual Jekyll 4.3.2 builds passed for Martlet and Krigsvold, both at `/` and at `/preview`. Initial local execution used Ruby 3.2.3 and Ubuntu-packaged Jekyll dependencies in an isolated runtime. CI exposed inherited Debian-patched dependency metadata in the old lockfiles. Both lockfiles were regenerated against RubyGems: Liquid 4.0.4 and safe_yaml 1.0.5 now match upstream Jekyll 4.3.2. Local builds and link checks also passed using the upstream Jekyll CLI and Liquid 4; CI installs the complete locked dependency set on a clean runner.
- Each build contains 53 HTML pages. The final link checker checks all local links, images, assets, and fragments, plus one h1 and unique IDs. Root/subpath results are reported by the check commands; the added setup-guide link increases the original 1,322 destinations to 1,323 per build.
- Cloud Chrome DOM sweeps visited all 46 recipes in both themes, in both light and dark modes. No horizontal page overflow or failed images with a source URL were observed at the available desktop viewport. An uninitialised image inside the closed enlargement dialog was excluded from the failed-image check because it has no source until opened.
- Visual review covered both catalogs, case-study compositions, the Martlet dark reading sequence, and the Krigsvold divided observation workspace.
- Browser interaction checks passed for query loading and no-results search, archive pagination, workspace selection/review/filter-to-empty/reset, local contact-form validation, sensor selection, scene selection, and gallery open/close.
- A chat message containing `<img src=x onerror=alert(1)>` appeared as literal text and created zero image elements. Local messaging uses text nodes, not rendered user HTML.

## Additional validation after final assembly

The final build, archive-content checks, source-sync idempotence, contract check, and root/subpath link checks are run before deployment. CI repeats canonical-export drift detection and both deployment-path builds using the checked-in Bundler lockfiles.

## Not established by these checks

The cloud browser's available viewport could not be resized through its supported control surface. Narrow-width behaviour is implemented in the family/shared media rules but is not claimed as a completed device-viewport test. No manual screen-reader, print-on-paper, Firefox, WebKit, production identity, message delivery, booking, payment, device, or VR test is claimed. Account and application examples intentionally require adapters for those live services.
