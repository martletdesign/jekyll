> **Standalone source:** `martletdesign/jekyll` is the authoritative Jekyll implementation. Its 50 recipes follow the shared workbench contract. Historical source attribution remains in `nightjar/PROVENANCE.json`.

# Martlet Jekyll

A genuine Jekyll template using the consolidated Martlet Astro shell.

- `bundle install`
- `bundle exec jekyll serve`
- `bundle exec jekyll build --destination dist`

Layouts: default, wide page with optional left index, and narrow post with inline contents. Date, author, and summary live in the masthead; tags use the source post-tag strip below it. Header/footer are shared includes; navigation and site identity are configurable. Appearance is progressive enhancement; content and links remain available without JavaScript.

The exported CSS is vendored intact, with its SHA-256 in `_data/shell.json`. Fonts and marks are self-hosted. Jekyll adaptations are separate. Original source websites are untouched.

Static hosting settings: build `bundle exec jekyll build --destination dist`; output `dist`. Suggested domain `jekyll.martletdesign.dev`. The same deterministic static output can be served by a private-source host without a runtime R2 binding.

## Complete example library

Browse `/examples/` for 50 matching content recipes. This standalone export contains its content in `_data/examples.json`, composition layouts in `_layouts/example-*.html`, and reusable section/class includes in `_includes/examples/`. The shared styles and browser enhancements live in `assets/css/examples.css` and `assets/js/examples.js`; the family's composition rules live in `assets/css/examples-family.css`.

Shared recipe definitions, representative fixture data and conformance schemas remain coordinated in [design-workbench](https://github.com/k3jph/design-workbench). This repository owns the Jekyll templates, styles, behaviors and standalone source releases. Port shared contract changes through conformance checks rather than overwriting the independent implementation. See `docs/archetypes/` for the shared contract and porting boundaries.

The source-download link is enabled only by the workbench archive build. Ordinary standalone Jekyll builds omit it unless an archive is explicitly provided with `source_archive: true`.

## Versioned source releases

The repository ships reproducible `source.zip` and `SHA256SUMS` assets from protected `v1.0.0`-style tags on main first-parent history. Build root and `/preview` with `python3 nightjar/build.py --destination /absolute/output [--baseurl /preview]`; both builds contain identical source ZIP bytes. Source releases retain the vendored historical theme CSS, fonts, licenses and registry integrity recorded in `scripts/source-shell-provenance.json`; they do not invent a Core package dependency.

The advanced remote R2 archive is explicitly disabled by `release-policy.json`. The normal static documentation and source-download path remains supported and verified. This release does not claim administrator-proof storage or independent anti-rollback protection.
