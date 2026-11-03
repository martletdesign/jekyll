# Implementation report: parallel dashboards

## Delivered

Analytics, administration, and operations each have a Martlet and Krigsvold rendition in the existing Jekyll example library. Both receive the same synthetic fixture, DOM information sequence, functional controller, calculations and acceptance tests. The library now has 50 recipes: the original 46, three dashboard applications, and their reusable-capability reference.

The existing Jekyll build was first revalidated. Its outstanding review finding was corrected: ordinary standalone builds omit the source-download link; the archive-producing workbench build enables it explicitly. Both ordinary and packaged builds were checked for valid destinations before dashboard implementation.

## Component limitations discovered and changes made

| Existing capability | Limitation under dashboard work | Implemented change |
| --- | --- | --- |
| Publishing/document layouts | No persistent application navigation or working region | One dashboard composition frame, with each language's sidebar and layout rules |
| Static facts/statistics | No consistently named live value, unit and comparison | Reusable metric include and formatted-value update helper |
| Figures/tables | No chart presentation with equivalent exact data | Small SVG/chart frame with native disclosure and accessible table; no chart dependency |
| Static tables | No compact density or sortable working collection | Optional table density; configurable framework-neutral filtering, stable sorting and bounded pagination |
| Existing form controls | No combined entity-editor recovery | Error summary, field descriptions, retained draft and duplicate-email validation, composed from native controls |
| Native dialogs | No scoped bulk-workflow example | Selected-ID snapshot, named confirmation, cancel/Escape without writes and focus return |
| Status/disclosure primitives | No monitoring specimen | Scoped service thresholds, severity/acknowledgement filters and labelled local activity |

The native source-site buttons remain the controls. The application frame uses the same source tokens and typography. Shared behaviour lives in framework-neutral modules; family CSS owns presentation. Dashboard CSS/modules are only requested on dashboard pages. Existing React exports and package versions are unchanged; no framework port is claimed or required.

## Validation and evidence

Local Jekyll builds and rendered-link checks run for both families at deployment subpaths. Pure calculation and workflow tests cover weighted aggregation, date validation, comparison availability, configurable collection vocabulary, page clamping, selected-ID write bounds, duplicate validation, threshold scope and acknowledgement filters.

Desktop cloud-browser checks compared analytics metrics and filtered source rows across both languages, exercised administration confirmation and draft validation, and checked operational threshold and acknowledgement changes. The shared fixture and source shell hashes are checked automatically.

The checked-in Jekyll CI adds paired browser workflows, initial-data parity, validation and error recovery, cancellation, safe text rendering, mobile sidebar keyboard behaviour, 320/768/1100/1440px reflow, and light/dark axe checks. It saves screenshots and failure traces. Those PR checks are the authoritative final acceptance result. Existing workbench CI continues to test the original component packages and examples.

## Remaining limits and recommended next work

- This is a static, synthetic demonstration. Writes, acknowledgements and drafts live in page memory and reset on reload; there is no authentication, authorisation, persistence or live monitoring adapter.
- Charts use a small SVG renderer. Exact-value tables are required and implemented; rich pointer tooltips, chart editing and very large/streaming datasets are outside this work order.
- The browser checks establish an initial visual evidence set. There was no previous dashboard image baseline. Manual screen-reader use, print-on-paper review, and sustained use with real users remain additional validation before stable promotion.
- Reuse the fixture, pure model and semantic contracts for future Astro/React ports. Use framework-native rendering and existing component packages. Do not copy imperative DOM controllers into React.
- The documentation marks the new composition and capabilities experimental; it does not imply a new stable npm API, a package release, or changes to either authoritative source website.
