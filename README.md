> **Standalone source:** `martletdesign/jekyll` is the authoritative Jekyll implementation. Its 50 recipes follow the shared workbench contract. Historical source attribution remains in `nightjar/PROVENANCE.json`.

# Martlet Jekyll

Version 2 is the standalone Martlet Jekyll implementation on Core 3. It shares the canonical family stylesheet with Astro and React. See [upgrading to Jekyll 2](docs/migration-2.md).

- `bundle install`
- `bundle exec jekyll serve`
- `bundle exec jekyll build --destination dist`

Layouts: default, wide page with optional left index, and narrow post with inline contents. Date, author, and summary live in the masthead; tags use the source post-tag strip below it. Header/footer are shared includes; navigation and site identity are configurable. Appearance is progressive enhancement; content and links remain available without JavaScript.

The canonical Core stylesheet is copied intact to `assets/css/martlet.css`, with its SHA-256 in `assets/css/core-styles.json`. Fonts and marks are self-hosted. All stylesheet changes originate in Core; Jekyll owns its templates and controllers.

Static hosting settings: build `bundle exec jekyll build --destination dist`; output `dist`. Suggested domain `jekyll.martletdesign.dev`. The same deterministic static output can be served by a private-source host without a runtime R2 binding.

## Complete example library

Browse `/examples/` for 50 matching content recipes. This standalone export contains its content in `_data/examples.json`, composition layouts in `_layouts/example-*.html`, and reusable section/class includes in `_includes/examples/`. The Core stylesheet is copied to `assets/css/martlet.css`; browser enhancements live in `assets/js/examples.js`.

Shared recipe definitions, representative fixture data and conformance schemas remain coordinated in [design-workbench](https://github.com/k3jph/design-workbench). This repository owns the Jekyll templates, behaviors and standalone source releases; Core owns stylesheet definitions. Port shared contract changes through conformance checks rather than overwriting the independent implementation. See `docs/archetypes/` for the shared contract and porting boundaries.

The source-download link is enabled only by the workbench archive build. Ordinary standalone Jekyll builds omit it unless an archive is explicitly provided with `source_archive: true`.

## Versioned source releases

The repository ships reproducible `source.zip` and `SHA256SUMS` assets from protected `v1.0.0`-style tags on main first-parent history. Build root and `/preview` with `python3 nightjar/build.py --destination /absolute/output [--baseurl /preview]`; both builds contain identical source ZIP bytes. Source archives include the generated Core CSS and its asset manifest, alongside the historical shell provenance, fonts and licenses. Building an archive with Jekyll does not require Node; Node verifies and refreshes the committed Core assets during development.

The advanced remote R2 archive is explicitly disabled by `release-policy.json`. The normal static documentation and source-download path remains supported and verified. This release does not claim administrator-proof storage or independent anti-rollback protection.

## Approved panoramic homepage

The homepage opts into the locally hosted, approved responsive 2172 × 724 footless Martlet bird panorama. See [hero provenance and behavior](HERO-PROVENANCE.md) for original/derivative hashes, responsive cropping, dark/header behavior, fallback and review limits. The [hero composition contract](HERO-CONTRACT.md) adds distinct credited section photography and restrained compact/plain mastheads; canonical tokens and application surfaces remain intact.

### Shared stylesheet ownership

All reference CSS is exported by `@martlet/core`. Astro and Jekyll use identical `martlet.css` and `fonts.css` files. Edit Core, update the exact dependency and lockfile, then run `npm run styles:sync`. Development previews may pin a full Core Git commit; this does not require an npm release. Publishing a new package is a separate release decision. `npm run styles:check` rejects edited or extra CSS assets. The generated asset manifest records the package version, dependency source and SHA-256 of each file.

Page templates and client code must not contain style elements, style attributes, CSS mutation calls, or local stylesheet definitions. Source and rendered-page checks enforce this. Use the Core markup classes and named data attributes instead.
