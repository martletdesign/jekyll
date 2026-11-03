> **Snapshot context:** The paths and commands below refer to the upstream workbench, not files inside this standalone candidate. Shared catalog, fixtures, contracts and `sync.py` remain workbench-owned. For standalone build and verification use [the rehearsal instructions](../../nightjar/README.md). Do not treat this snapshot as an independent canonical source until a separately approved handoff.

# Page archetypes

A portable, MIT-licensed collection of **50 page recipes** rendered independently by Martlet and Krigsvold. The fictional Northlight Field Institute supplies the same content to both. Neither family has capability exclusions.

## Source ownership

| Path | Owns |
| --- | --- |
| `content/catalog.json` | Authored content, semantic class, composition choice, sections, destinations, and fixture provenance |
| `contracts/catalog.schema.json` | Versioned data contract, section discriminators, and semantic requirements |
| `jekyll/_layouts/` | Eight composition frames: landing, reading, document, collection, detail, dossier, workspace, dashboard |
| `jekyll/_includes/examples/` | Section renderers and class-specific context such as article navigation and event details |
| `jekyll/assets/` | Shared interaction mechanics, original illustrations, and sample data |
| `families/<family>/` | Family composition rules and mapping to existing shell roles |
| `../jekyll/<family>/` | Complete standalone Jekyll projects, including their authoritative exported shell and generated adapters |

Edit canonical files here, then run `python3 examples/page-archetypes/scripts/sync.py` from the repository root. Do not hand-edit generated example pages or `_data/examples.json`. Generated exports are committed so each project remains usable without Node or Python. The sync operation overlays owned files and preserves unrelated site content; removing or renaming a recipe requires explicitly removing its old generated page too.

A semantic class describes what the content is. A composition describes how it is arranged. A new content class warrants a class-specific include or layout when it introduces meaningful required fields, ordering, behaviour, or accessibility semantics. A new colour scheme or hero illustration does not, by itself, justify a new template. Shared frames may support several classes.

## Run and verify

Install Node dependencies at the workbench root (`npm ci --ignore-scripts`). In each standalone Jekyll project, run `bundle install` using the checked-in lockfile. Then:

```sh
python3 examples/page-archetypes/scripts/sync.py
node examples/page-archetypes/scripts/verify.mjs
python3 examples/page-archetypes/scripts/build.py
python3 examples/page-archetypes/scripts/verify-html.py examples/jekyll/martlet/dist
python3 examples/page-archetypes/scripts/verify-html.py examples/jekyll/krigsvold/dist
```

The cross-framework checks require a paired build directory that differs from the default Jekyll `dist` locations. From the workbench root, the following creates it and builds both families at `/`. It uses Node 24.19.x, Python 3, Ruby 3.2 and the Bundler version in each lockfile. For a nonprivileged Ruby setup, Bundler can be configured to install into `vendor/bundle` within each Jekyll project before `bundle install`.

```sh
npm ci --ignore-scripts
npm ci --prefix examples/astro-slice --ignore-scripts
(cd examples/jekyll/martlet && bundle install)
(cd examples/jekyll/krigsvold && bundle install)

export NIGHTJAR_JEKYLL_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/nightjar-paired.XXXXXX")"
python3 examples/page-archetypes/scripts/build.py --family martlet --destination "$NIGHTJAR_JEKYLL_ROOT/martlet"
python3 examples/page-archetypes/scripts/build.py --family krigsvold --destination "$NIGHTJAR_JEKYLL_ROOT/krigsvold"
NIGHTJAR_FAMILY=martlet NIGHTJAR_BASE=/ npm --prefix examples/astro-slice run build
NIGHTJAR_FAMILY=krigsvold NIGHTJAR_BASE=/ npm --prefix examples/astro-slice run build
npm run build --workspaces
NIGHTJAR_FAMILY=martlet NIGHTJAR_BASE=/ node examples/react-catalog/build.mjs
NIGHTJAR_FAMILY=krigsvold NIGHTJAR_BASE=/ node examples/react-catalog/build.mjs

# Install Playwright Chromium, or set CHROMIUM_PATH to an existing executable.
npx playwright install chromium
node examples/page-archetypes/tests/content-semantic-inventory.mjs
node examples/page-archetypes/tests/dashboard-framework-parity.mjs
```

These are local builds and checks; no site is published. The temporary Jekyll directory can be removed when the checks are complete. The checks below reuse these root-path builds unless they say they create their own fixtures. `CHROMIUM_PATH=/usr/bin/chromium` in the examples selects a system Chromium on Linux; omit that assignment when using Playwright's installed browser or set it to the executable on your system.

The cross-framework long-content reflow check runs against already-built root-path sites. Set `NIGHTJAR_JEKYLL_ROOT` to a directory containing `martlet` and `krigsvold` Jekyll builds, build both Astro and React families at `/`, then run `CHROMIUM_PATH=/usr/bin/chromium node examples/page-archetypes/tests/internationalization-stress.mjs`. Optional `NIGHTJAR_ASTRO_ROOT` and `NIGHTJAR_REACT_ROOT` select alternate paired output directories. The test checks multilingual unbroken titles and associated labels at 320 and 768 pixels in both LTR and RTL direction. It does not establish complete RTL, translation, locale formatting or assistive-technology support.

With the same root builds, `CHROMIUM_PATH=/usr/bin/chromium node examples/page-archetypes/tests/axe-route-inventory.mjs` scans the initial state of all 50 routes in both languages and all three frameworks with WCAG-tagged axe rules. Set `NIGHTJAR_AXE_APPEARANCE=dark` for the saved dark appearance; `light` explicitly selects light. It also samples button contrast while Astro contact controls change from disabled to enabled. This automated scan does not certify accessibility or cover every interaction, browser or assistive technology. For a focused run, `NIGHTJAR_AXE_SCOPE` accepts a framework/family pair such as `Astro/martlet`, and `NIGHTJAR_AXE_ROUTE` accepts a catalog ID.

The same paired builds also support `CHROMIUM_PATH=/usr/bin/chromium node examples/page-archetypes/tests/enlarged-text-motion.mjs`. It tests 200% root font size and reduced-motion emulation at 320 and 768 pixels across the three dashboards, including keyboard navigation, focus return and filter submission. Root font-size scaling is not browser zoom; these checks do not establish full reduced-motion or assistive-technology support.

Run `CHROMIUM_PATH=/usr/bin/chromium node examples/page-archetypes/tests/gallery-link-contract.mjs` against those paired builds to verify modified image links, keyboard dialog focus return and direct image access without JavaScript or when modal opening fails. For subpath builds, set `NIGHTJAR_GALLERY_BASE=/preview/` and point the paired build roots at outputs built for that base.

Run `CHROMIUM_PATH=/usr/bin/chromium node examples/page-archetypes/tests/gallery-composition.mjs` to build disposable Jekyll and Astro pages with two galleries and a potentially conflicting section ID. It checks distinct accessible dialogs, Escape focus return, unique IDs, axe and direct links without JavaScript in both families at root and subpaths. Ruby, Bundler and the Astro dependencies are required.

Run `CHROMIUM_PATH=/usr/bin/chromium node examples/page-archetypes/tests/chat-composition.mjs` for disposable paired Jekyll/Astro two-conversation fixtures. It covers independent state, whitespace validation recovery, keyboard submission and focus, reset, axe and disabled no-JavaScript controls at root and subpaths.

Run `CHROMIUM_PATH=/usr/bin/chromium node examples/page-archetypes/tests/form-composition.mjs` to build disposable catalog pages with two forms and two conversations across Jekyll, Astro and React, both families and root/subpaths. It checks unique IDs, label and description associations, independent keyboard interaction and reset, automated axe and no-JavaScript fallback. Ruby, Bundler and both Node dependency sets are required.

Local form and chat controls remain disabled until their handlers are ready, and an unavailable message is shown while scripts are absent or blocked. The composition check also simulates partial Jekyll initialization failure and a malformed Jekyll/Astro form, verifying that affected controls stay disabled and that an independent valid form can still operate.

Run `CHROMIUM_PATH=/usr/bin/chromium node examples/page-archetypes/tests/workspace-composition.mjs` to build disposable catalog pages with two workspaces across all three frameworks and both families at root and subpaths. It checks unique IDs, independent filter/review/reset state, keyboard focus recovery, automated axe and no-JavaScript fallback.

Run `CHROMIUM_PATH=/usr/bin/chromium node examples/page-archetypes/tests/content-semantic-inventory.mjs` against paired root-path builds to audit all 50 routes without JavaScript. It checks canonical titles, summaries, section headings and structured content, actions, table headers, image descriptions, prose against Jekyll, application dashboard navigation and full directory fixture visibility. Footnote marker formatting and Astro's fingerprinted CSV URL are normalized; the CSV bytes are compared. This is a bounded semantic inventory, not a complete visual or assistive-technology audit.

Run `CHROMIUM_PATH=/usr/bin/chromium node examples/page-archetypes/tests/dashboard-static-chart-data.mjs` against the same paired builds to compare four no-JavaScript chart data tables to the shared dashboard model. Sparse, disjoint and unsafe fixtures are exercised by the separate analytics and operations regression suites.

Run `CHROMIUM_PATH=/usr/bin/chromium node examples/page-archetypes/tests/zoom-reflow-equivalence.mjs` against the same paired builds to exercise reflow and keyboard behavior at 640×450 and 320×225 CSS pixels with device pixel ratios 2 and 4. These emulate the CSS viewport of a 1280×900 desktop at 200% and 400% zoom; they do not operate the browser's zoom controls or validate zoom rasterization, browser chrome or pinch zoom.

Run `CHROMIUM_PATH=/usr/bin/chromium node examples/page-archetypes/tests/print-media-inventory.mjs`, `CHROMIUM_PATH=/usr/bin/chromium node examples/page-archetypes/tests/print-directory.mjs`, and `CHROMIUM_PATH=/usr/bin/chromium node examples/page-archetypes/tests/print-disclosures.mjs` against the same paired builds to check Chromium print media across all 50 routes, both families, three frameworks and both appearance modes. The inventory checks text contrast against white, content overflow and hidden navigation; the directory check exercises all matching records and preserves screen pagination and selection. Browsers supporting the standard `details::details-content` pseudo-element reveal closed disclosure contents for print without changing their open state; in unsupported browsers, open the desired answers or chart data before printing. These automated checks do not certify physical printers, other browser engines, or PDF page-break fidelity.

Run `CHROMIUM_PATH=/usr/bin/chromium node examples/page-archetypes/tests/content-security.mjs` with the locked Jekyll and Astro dependencies installed to build disposable hostile-content fixtures across both families, root/subpaths, and all three frameworks. The Jekyll example sanitizes rendered Markdown using the locked `sanitize` gem and its local Liquid filter; the source archive includes that filter. Jekyll `--safe` disables local plugins, so this adapter instead displays escaped HTML markup as text in that mode. Build without `--safe` when rich Markdown and MathML are needed; never remove the escape fallback. Across all adapters, root-relative Markdown links and images receive the deployment base once; already-prefixed paths, ordinary relative paths, fragments and protocol-relative links retain their destinations.

Run `CHROMIUM_PATH=/usr/bin/chromium node examples/page-archetypes/tests/search-composition.mjs` to check two search sections in disposable catalog builds across all three frameworks, both families and root/subpaths. Both controls share the page query, synchronize on submission and history navigation, and retain keyboard and no-JavaScript access.

Search controls remain disabled until initialization succeeds; a browse-index link is available while JavaScript is disabled, blocked or unable to initialize. The query string is left intact on initialization failure. Jekyll and Astro isolate an invalid embedded index to its own search section.

Run `CHROMIUM_PATH=/usr/bin/chromium node examples/page-archetypes/tests/administration-duplicate-names.mjs` to check duplicate and unique accessible control names before and after edits in paired Jekyll, Astro and React dashboards. `node examples/react-catalog/test-administration-large.mjs` exercises 2,500 synthetic people, stable sorting, filters and pagination, bounded enhanced rows, no-JavaScript records and collection recomputation; timings are informational rather than thresholds.

Run `CHROMIUM_PATH=/usr/bin/chromium node examples/page-archetypes/tests/dense-table-reflow.mjs` against the same builds to check 100-row, 19-column tables with long words at 320px. The check verifies useful column widths and a named, keyboard-scrollable region; users must scroll horizontally to inspect wide tables.

Simulation controls derive IDs from the unique section ID using reserved `_simulation-` and `_scene-` prefixes. Existing links to the former fixed `#simulation-mode`, `#ventilation`, or `#scene-view` control IDs must be updated.

For the multiple-simulation composition check, also install the locked Astro example dependencies with `npm ci --prefix examples/astro-slice --ignore-scripts`, then run `CHROMIUM_PATH=/usr/bin/chromium node examples/page-archetypes/tests/simulation-composition.mjs` from the workbench root. Omit `CHROMIUM_PATH` if Playwright’s Chromium is installed. The check builds disposable fixtures; Ruby, Bundler and both Jekyll lockfiles must be available.

The build uses `bundle exec jekyll` by default. `JEKYLL_COMMAND_JSON` can select an installed Jekyll command as a JSON argument array. Both the generated site and `dist/template.zip` are built from the files explicitly listed in `contracts/jekyll-source-files.json`; unlisted local files are excluded, and missing files, symlinks in listed paths, or destinations that would overwrite source files fail before Jekyll runs. Changes to listed files are included, so do not put secrets in them. To add or remove a source file, stage the intended Jekyll source changes, run `python3 examples/page-archetypes/scripts/update-source-manifest.py`, then stage the updated manifest. CI checks the manifest against the Git index. The resulting archive can be built from a source checkout without Git metadata. Each standalone project can also be built with ordinary `bundle exec jekyll build --destination dist` (without regenerating the source archive).

See [porting](PORTING.md), [acceptance criteria](ACCEPTANCE.md), and [verification evidence](VERIFICATION.md). These examples are experimental, not a declaration that every role has been promoted into a stable component package.

## Coverage

Presentation: home, about, announcement. Publishing: article, archive, category, category index, changelog. People: profile, opportunities, opportunity detail. Research: project index, case study, reference document, report. Support: documentation index, guide, contact, FAQ, privacy, terms, search, integration guide. Commerce: service, place, plan comparison, software, product. Collections: index, object detail, exhibition. Events: index and detail. Accounts: sign-in, sign-up, reset, two-factor. Recovery: 404 and server-error specimen. Applications: observation workspace, messaging, station sensors, fleet register, scene viewer. Verification: stress test and section library.

The application specimens are intentionally local. Identity, messaging delivery, payments, bookings, device access, and immersive rendering require service adapters. The integration guide explains each boundary in both demos. No real organisation, vacancy, event, measurement, transaction, or scientific finding is represented by the fixture content.

The collection now includes three paired dashboard applications and their reusable capability reference. See [dashboard contracts](DASHBOARDS.md).

Structured catalog links preserve query parameters through HTML escaping. Listing and page dates use calendar-valid `YYYY-MM-DD` values with years 0001–9999; other strings are displayed as inert “Invalid date” text. `node examples/page-archetypes/tests/catalog-structured-safety.mjs url` and `date` exercise schema-valid structured text and link edge cases across both families, all three frameworks and root/subpath builds.
