# Upgrading to Martlet Jekyll 2

This source release adopts Core 3 and the same canonical stylesheet as the Astro and React references.

Custom layouts must stop loading the removed `jekyll.css`, `examples.css`, `examples-family.css`, `dashboard.css`, `dashboard-family.css`, and `scientific.css` files. Load `assets/css/martlet.css` instead, using Jekyll's `relative_url` filter for subpath hosting. Retain the separately supplied font assets. Use the current default layout as the complete stylesheet-loading example.

The root npm manifest and lockfile pin published `@martlet/core@3.0.0`. Run `npm ci --ignore-scripts`, `npm run styles:sync`, and `npm run styles:check` when updating the copied Core files. Do not edit the generated stylesheet or introduce page-local styles.

The reviewed dashboard shell keeps ownership and copyright in its independently scrolling navigation. Article subjects use the shared inline metadata row. Existing local filters, validation, results, and CSV interactions remain available.

## Source releases

The `VERSION` file identifies the source release. A `release/*` branch starts at `develop`; after checks and merge to `main`, automatic verification creates the version tag and invokes the existing source-archive release workflow. That workflow verifies the protected tag and publishes the source archive and checksum. Merge the release back into `develop`. Site deployments use their standard build commands and do not publish packages.
