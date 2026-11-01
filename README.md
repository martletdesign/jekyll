> **Local extraction rehearsal:** This is an attributed snapshot, not a source-authority transfer. See [standalone build and verification instructions](nightjar/README.md); `python3 nightjar/build.py --destination /absolute/output` creates the source download without the workbench. The historical export instructions below describe the original context.

# Martlet Jekyll

A genuine Jekyll template using the consolidated Martlet Astro shell.

- `bundle install`
- `bundle exec jekyll serve`
- `bundle exec jekyll build --destination dist`

Layouts: default, wide page with optional left index, and narrow post with inline contents. Date, author, and summary live in the masthead; tags use the source post-tag strip below it. Header/footer are shared includes; navigation and site identity are configurable. Appearance is progressive enhancement; content and links remain available without JavaScript.

The exported CSS is vendored intact, with its SHA-256 in `_data/shell.json`. Fonts and marks are self-hosted. Jekyll adaptations are separate. Original source websites are untouched.

Cloudflare Pages settings: build `bundle exec jekyll build --destination dist`; output `dist`. Suggested domain `jekyll.martletdesign.dev`. Sites hosts the same static Jekyll output for review.

## Complete example library

Browse `/examples/` for 50 matching content recipes. This standalone export contains its content in `_data/examples.json`, composition layouts in `_layouts/example-*.html`, and reusable section/class includes in `_includes/examples/`. The shared styles and browser enhancements live in `assets/css/examples.css` and `assets/js/examples.js`; the family's composition rules live in `assets/css/examples-family.css`.

Canonical editable sources and regeneration tools are in `examples/page-archetypes` in [design-workbench](https://github.com/k3jph/design-workbench). See `docs/archetypes/` for the contract, porting boundaries, and verification criteria. Editing this exported project independently is supported, but those edits are not automatically imported back into the canonical adapter.

The source-download link is enabled only by the workbench archive build. Ordinary standalone Jekyll builds omit it unless an archive is explicitly provided with `source_archive: true`.
