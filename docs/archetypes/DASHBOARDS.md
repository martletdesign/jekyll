# Parallel dashboard contracts

Three canonical applications use exactly the same information architecture, records, controls, calculations, and recovery behaviour in Martlet and Krigsvold. The existing language shell, native buttons, typography, palette semantics, forms, bounded tables and disclosures remain authoritative. No framework, chart dependency, package, or repository is added.

## Source and component ownership

| Source | Responsibility |
| --- | --- |
| `content/dashboards.json` | Shared synthetic fixture, schema version, as-of time and domain records |
| `scripts/generate-dashboard-fixtures.py` | Reproducible generation; no randomness or external data |
| `contracts/dashboards.schema.json` | Types, enum values and fixture provenance |
| `jekyll/_layouts/example-dashboard.html` | Shared information architecture and application landmarks |
| `jekyll/_includes/examples/dashboard-*.html` | Domain-specific content classes composed from existing controls and reusable presentation |
| `jekyll/_includes/examples/metric.html`, `chart.html` | General metric and accessible chart frames |
| `jekyll/_includes/examples/table.html` | Existing table frame, extended with optional density |
| `jekyll/assets/js/dashboard-model.mjs` | Framework-neutral calculations and collection/workflow behaviour |
| `jekyll/assets/js/dashboard-ui.mjs` | Small reusable text-safe table, chart, metric, and CSV renderers |
| `jekyll/assets/js/dashboards.mjs` | Browser controllers and page-memory state |
| `jekyll/assets/css/dashboard.css` | Reflow and composition mechanics, without a new palette |
| `families/<family>/assets/css/dashboard-family.css` | Independent source-token mappings and family compositions |

Dashboard CSS and modules load only on dashboard pages. Ordinary examples retain their current assets; the general table-density addition preserves the default appearance. Both standalone exports receive generated copies and the same data, checked for drift.

## Shared fixture

Northlight is fictional. Data includes 168 daily category observations over 56 days ending October 28, 2026; 24 invented directory records using `example.invalid`; five services with 24 hourly synthetic samples each; three alerts and their corresponding activity entries. No personal or production data is used. Every page identifies its actual as-of time in UTC and its synthetic/page-memory boundary. Invalid snapshot timestamps are labelled as invalid; operations separately rejects invalid timestamps in its data.

## Analytics

Every observation date must be a valid calendar date. An impossible date anywhere in the snapshot produces an explicit unavailable state; correcting the source data restores analytics. The default range is October 22–28, 2026. Quick ranges cover 7, 14 and 28 days; custom start/end dates and category selection scope all metrics, charts, source records, and CSV export. Inputs outside the fixture or in reversed order produce a focusable alert, retain the last valid results, and disable export until corrected. Category labels are rendered as text. Repeated category declarations are treated as one category, while every observation for the same date and category contributes to totals and remains in the source table. Legacy `category=All` URLs retain their all-categories meaning; `categoryId=All` explicitly selects a category with the literal ID `All`, and peer comparison carries this scope.

Metrics: sessions, downloads, completion rate (`sum(completions) / sum(sessions)`), and mean duration (`sum(duration_seconds) / sum(sessions)`). Comparisons use the immediately preceding equal-length period only when fully available. Missing comparisons say unavailable. The charts show session and download trends and category totals against the preceding period. Exact values are available through native disclosures and accessible tables, including dates, category and units. CSV export contains the filtered source records.

## Administration

Search covers configured fields; status filtering, stable column sorting and direction, row count, page controls, and density remain independent. Page numbers clamp after filtering. The select-all checkbox affects only visible rows; selections may persist across pages, and filter changes clear selection. The bulk confirmation names the selected records and intended status. Cancel and Escape write nothing. Confirmation updates selected IDs only and returns focus to an available control. A bulk action that includes the person with an unsaved editor draft is blocked with save-or-discard guidance; the draft and selection are retained. When the open editor is pristine, confirmation synchronizes its status so a later save does not undo the bulk change. Bulk actions for other people remain available.

The person editor adds or edits names, invented email addresses, roles and statuses. It validates required fields, email syntax, duplicates excluding the current record, and enum values. Email duplicate comparisons ignore leading/trailing whitespace and case on both existing records and the draft. Validation retains drafts, marks fields invalid and links a focusable error summary to the fields. If a changed draft is present, choosing Add person or editing a different person retains the draft and errors, returns focus to the name field and asks the user to save or explicitly discard before switching. Reselecting the same person retains the draft without a warning; pristine editors can switch immediately. The guard covers these local editor actions; reload still resets the synthetic preview. Rendering uses text nodes, including user-entered names. Repeated submissions in one task are coalesced after a successful save, and React allocates IDs and validates against the latest page-memory records. Directory changes reset on reload. New records receive the first unused `P-` identifier, so existing stable IDs need not follow a numeric format.

The explicit state-preview control demonstrates ready, loading, error and empty states. Loading disables writes. Error recovery retains filters and drafts. Empty states explain recovery. These are labelled local state specimens, not claims that a network operation took place.

## Operations

Monitoring windows end at the snapshot time and start 5, 11 or 23 hours earlier, respectively; observations are ordered by timestamp rather than input position. If coverage is incomplete, the trend includes only timestamps present for every selected service and labels the coverage as partial. The latest reading for each service is shown with its timestamp, and a mean of differing latest times is identified as such; missing availability is unavailable rather than zero. The schema permits invalid calendar timestamps, duplicate service timestamps and observations after the snapshot; the operations view explicitly rejects these ambiguous snapshots and reports the reason, including without JavaScript. Snapshot, sample, alert and activity timestamps must be valid UTC calendar times. The other dashboard views remain available. Service selection scopes trends, status, alert counts and activity, including a service whose stable ID is `All`. Legacy `service=All` URLs continue to mean all services; `serviceId=All` explicitly selects a service with that ID. Peer comparison carries this intentional scope. A whole-number warning threshold from 50–1000 ms classifies each service's latest latency; the line plot shows the mean across selected services and labels the threshold separately. Severity and acknowledgement filters scope the alert register. The unacknowledged summary explicitly counts all severities in the service scope.

Service names, alert IDs and titles, and activity titles are rendered as text; IDs are not interpreted as CSS selectors. Acknowledgement and undo update page memory and add an explicitly local timeline entry. Reset restores the original fixture. Availability is identified as a minimum sampled synthetic value, not a live SLA calculation. Status and severity use text and borders as well as semantic colours.

All latency and queue observations must be nonnegative safe integers; the sum of latest queues, the sum of latest latencies, and each timestamp's sum of latencies across services must also fit within `Number.MAX_SAFE_INTEGER`. Validation covers the entire snapshot, including observations outside the selected window, so every service selection has the same trustworthy precision boundary. Snapshots exceeding it produce an explicit unavailable state before or after JavaScript enhancement. Means are rounded from exact integer sums, including at the safe-integer boundary. Run `node examples/page-archetypes/tests/operations-precision.mjs` with `observation`, `queue`, `latency`, or `rounding` to verify these cases in isolated builds.

## Family composition and deliberate extensions

Both families use the same DOM information sequence and functional controller. Martlet uses documentary side navigation, an open reading hierarchy, generous groups, Cambo headings, Lato controls/numbers, restrained gold rules and a full-width primary trend. Krigsvold uses aligned bounded panels, a compact sidebar, Roboto/Roboto Slab/Roboto Mono roles, paired trend panels and an aligned category comparison.

Both switch the application sidebar to a disclosure below 64rem, reduce metric columns below 68rem, stack working panels below 42rem, and use one metric column below 26rem. Named table regions contain necessary horizontal scrolling. Application layout, not source identity, changes to meet the denser working context. Native site menus and buttons remain intact. Neither source website is modified.

## Portable component contracts

`collectionView(records, options, fields)` returns filtered rows, clamped page, page count, page size, and total; `fields` declares searchable keys, sortable keys and default sort. Records require stable IDs. `analyticsView` and `operationsView` are domain calculations, not visual components. `analyticsView` retains `category: "All"` as the unscoped default; an explicit `categoryId` selects that literal category and takes precedence. `operationsView` returns an `error` instead of calculated values when its snapshot has duplicate service timestamps, future observations, unsafe latency/queue integers, or unsafe aggregate totals. `applyBulk` and `validatePerson` remain domain workflow helpers.

Charts accept labelled numeric rows, an optional previous value and an optional threshold. The Jekyll SVG adapter is replaceable; the data table and equivalent information are required. Metrics require a name, formatted unit, and explanation of comparison/aggregation. Reuse existing React controls and tables when porting; implement rendering and state in the framework's normal mechanisms, keeping these fixture and behaviour contracts. Do not copy imperative DOM controllers into React.

## Verification

Run `npm run test:examples` after sync. The existing Jekyll workflow builds root and subpath variants from locked dependencies, then builds `/martlet` and `/krigsvold` test prefixes. `npm run test:dashboards` uses the existing Playwright and axe dependencies against those generated sites. It tests paired workflows, validation/recovery, scoped writes, safe text, responsive widths (320, 768, 1100 and 1440px), mobile navigation, and light/dark accessibility. Browser screenshots/traces are CI artifacts and establish the initial visual evidence; no historical dashboard baseline or comprehensive manual screen-reader certification is claimed.

## Cross-framework behavioral comparison

`tests/dashboard-framework-parity.mjs` executes representative identical workflows against root-path builds of both families in Jekyll, Astro and React. It compares scoped analytics and invalid-date recovery; monitoring acknowledgement with an unapplied threshold draft; keyboard confirmation and cancel focus; mobile navigation and overflow; and no-JavaScript navigation, source tables and disabled controls. It does not establish complete visual or manual accessibility parity. The same fixture values and expected behaviors are asserted in each implementation; family-specific styling is not pixel-compared.

From the workbench root, install locked Node dependencies in both the workbench and `examples/astro-slice`, build the React workspaces, and install each standalone Jekyll project's locked gems. Then prepare isolated root-path builds and run:

```sh
export NIGHTJAR_JEKYLL_ROOT="$(mktemp -d)"
python3 examples/page-archetypes/scripts/build.py --family martlet --destination "$NIGHTJAR_JEKYLL_ROOT/martlet"
python3 examples/page-archetypes/scripts/build.py --family krigsvold --destination "$NIGHTJAR_JEKYLL_ROOT/krigsvold"
NIGHTJAR_FAMILY=martlet NIGHTJAR_BASE=/ npm --prefix examples/astro-slice run build
NIGHTJAR_FAMILY=krigsvold NIGHTJAR_BASE=/ npm --prefix examples/astro-slice run build
NIGHTJAR_FAMILY=martlet NIGHTJAR_BASE=/ node examples/react-catalog/build.mjs
NIGHTJAR_FAMILY=krigsvold NIGHTJAR_BASE=/ node examples/react-catalog/build.mjs
CHROMIUM_PATH=/usr/bin/chromium node examples/page-archetypes/tests/dashboard-framework-parity.mjs
```

Omit `CHROMIUM_PATH` when Playwright's Chromium is installed. Astro and React default to their `dist` directories; use `NIGHTJAR_ASTRO_ROOT` or `NIGHTJAR_REACT_ROOT` to point at different directories containing `martlet` and `krigsvold` builds. These fixtures must all be built with an empty/root base path. The disposable Jekyll directory can be removed after testing.

The hostile category and directory-text regression runs with `node examples/page-archetypes/tests/dashboard-text.mjs` and checks both initial and interactive pages across families, frameworks and base paths. Repeated directory submissions are checked with `node examples/page-archetypes/tests/administration-rapid.mjs`. A whitespace-padded email fixture is checked with `node examples/page-archetypes/tests/administration-email.mjs`. The schema-valid arbitrary-ID directory regression builds isolated fixture copies and checks independent add, edit and bulk actions across families, frameworks and base paths: `node examples/page-archetypes/tests/administration-identifiers.mjs`.

Invalid operations calendar timestamps can be checked with `node examples/page-archetypes/tests/operations-calendar.mjs` using `sample`, `snapshot`, `alert`, `activity`, or `valid-snapshot`. A literal `All` service ID can be checked with `node examples/page-archetypes/tests/operations-sentinel.mjs`. Hostile operations text and IDs can be checked with `node examples/page-archetypes/tests/operations-text.mjs`. Schema-valid duplicate or future operations observations are checked with `node examples/page-archetypes/tests/operations-invalid.mjs` and its `--future` option. Schema-valid partial operations fixtures (including disjoint samples) can be checked with `node examples/page-archetypes/tests/operations-partial.mjs` and the `--disjoint` option. Invalid analytics observation dates are checked with `node examples/page-archetypes/tests/analytics-calendar.mjs` and the `--month` option. Snapshot labels, including invalid values and no-JavaScript output, are checked with `node examples/page-archetypes/tests/dashboard-snapshot.mjs` and the `--invalid` option. Repeated categories and observations are checked with `node examples/page-archetypes/tests/analytics-duplicates.mjs`. A literal `All` analytics category can be checked with `node examples/page-archetypes/tests/analytics-sentinel.mjs`. The schema-valid reordered operations fixture is checked, including its no-JavaScript service table, with `node examples/page-archetypes/tests/operations-order.mjs`.

## Empty analytics fixture

The shared dashboard schema accepts an empty `analytics` array. When it is empty, each Jekyll, Astro and React analytics page renders an explicit “No analytics data is available in this snapshot” status rather than presenting zero metrics or an export. Dashboard navigation remains available with and without JavaScript. The checked-in demonstration fixture remains nonempty. This is an empty-source state, not a claim that arbitrary missing, sparse, or malformed observations are supported.

To exercise all six family/framework combinations with JavaScript enabled and disabled, install the workbench and Astro dependencies, build the React workspace packages, make the locked Jekyll/Bundler dependencies available, and run `CHROMIUM_PATH=/path/to/chromium npm run test:analytics-empty` from the workbench root. The test builds temporary copies with an empty fixture and leaves the checked-in data untouched. If Playwright's managed Chromium is installed, omit `CHROMIUM_PATH`.

## Sparse analytics observations

An optional `coverage: {start, end}` model argument declares the inclusive expected observation window. The demonstration controls pass September 3–October 28, 2026, matching their fixed limits; the serialized fixture and its schema remain unchanged. Without this argument, the model retains the earlier behavior of inferring bounds from the earliest and latest observed dates; missing observations beyond those inferred boundaries cannot be detected. The current demonstration does not establish a generic date-picker for arbitrary datasets.

Within the requested window, completeness requires at least one observation for each expected date/category pair (or each date for the selected category). Repeated observations are summed; their presence does not fill another missing pair. Missing current observations are labelled as partial and totals include only available rows; the category chart includes only categories represented in the selected rows. When the selected range/category has no rows, metrics are unavailable and CSV export is disabled. A comparison is shown only when both periods are complete; a zero preceding value produces an unavailable comparison rather than a percentage. When sessions total zero, completion rate and mean session duration are unavailable. Static/no-JavaScript output reports missing current observations and does not fabricate metrics.

`CHROMIUM_PATH=/path/to/chromium node examples/page-archetypes/tests/analytics-sparse.mjs` from the workbench root builds temporary sparse and zero-valued fixtures for both families and all three frameworks at root and subpath, with JavaScript enabled and disabled. Install the workbench/Astro dependencies, build the React workspaces and make the locked Jekyll gems available first. Run the same command with `--gap` to exercise a fully unobserved default range and recovery to an observed date. The test leaves the checked-in fixture unchanged. It does not establish support for arbitrary-precision totals: the calculations use JavaScript `Number`. Analytics observations must contain nonnegative safe integers; a selected current or complete comparison period whose counts or sums exceed `Number.MAX_SAFE_INTEGER` returns an explicit data error. No rounded totals or CSV are presented for that range. A bad selection retains the previous valid result; when the initial range is unsafe, filters remain usable after enhancement so a safe range can be chosen. Without JavaScript the error remains visible; where the chart scaffold is present, metrics remain unavailable placeholders. The model returns `dataError: true` with the error message for numeric data errors; ratios are still displayed rounded to one decimal place. The earlier interval preceding a comparison is not evaluated unless selected.

`CHROMIUM_PATH=/path/to/chromium node examples/page-archetypes/tests/analytics-precision.mjs` checks an unsafe initial current period in both families and all three frameworks at root and subpaths, including no-JavaScript output. Add `--previous` to test a complete preceding-period overflow, or `--selection` to test an unsafe later selection and recovery. These tests use isolated temporary fixtures and do not edit the checked-in data.
