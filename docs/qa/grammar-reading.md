# Martlet grammar reconciliation: reading and documentation

Tracks [work order #91](https://github.com/k3jph/design-workbench/issues/91). Work began independently from accepted `develop` `ac0a64c6cd5167ccbdf96bb20e46e5d547a49a5d`, rather than stacking on the then-unaccepted first exemplar candidate. The accepted first wave was integrated by a normal merge of `develop` `0701a83e948964fd5bf2e05ee31e7385af7752d6` before final verification. This wave preserves the same 50 fixtures, route IDs, headings, content, anchors and capability contracts; it does not redesign account forms or operational dashboards.

## Actual origin evidence

The source authority remains [jameshoward.us](https://jameshoward.us/). Directly observed on 2026-11-03, its [temperature article](https://jameshoward.us/2026/10/25/what-the-hell-does-temperature-actually-measure/) uses an `article.article-shell`, `nav.toc` named “On this page”, post tags and continued-reading navigation. The served `/_astro/BaseLayout.Vddcf7CK.css` gives `.toc` a cream surface, native gold top boundary, Lato interface typography and responsive columns. Those are observed object-specific choices; they do not license a stripe or surface on every object. This Jekyll host already carries those native `.toc` rules in its frozen shell, so the article adapter reuses that object rather than inventing another panel.

The [Martlet grammar](https://github.com/k3jph/design-workbench/blob/main/docs/languages/martlet/grammar.md) distinguishes the left source document index from the inline article TOC. It asks for bounded reading and separation of orientation from the subject, not a prose layout for every application. The existing document index/body anatomy is valid for the seven remaining document recipes; the old *total* 46rem wrapper incorrectly included both the index and the body. A 74rem overall wrapper now holds an independent 11–15rem index and a reading column bounded at 46rem. At narrow widths the index precedes its document in source order. Cambo supports sustained prose and Lato supports the index/context.

## Route decisions

| Route | Disposition | Task and source rationale |
|---|---|---|
| `guide` | Retain ordered instructions and actions; correct independent reading measure. | Preparation, arrival and follow-up already form a useful sequence. Do not replace the actual numbered arrival steps with decorative progress indicators. |
| `reference` | Retain scope, actual data table, code and correction context; correct independent reading measure. | Definitions and exact code require their native content forms. The keyboard-scrollable table remains a distinct named region. |
| `privacy` | Retain the policy document anatomy; correct independent reading measure. | Scope, processing limitations and dated changes need readable continuity, not a component gallery. |
| `terms` | Retain the policy document anatomy; correct independent reading measure. | Its deliberately shared fixture structure is legitimate. No invented visual opposition to privacy or the other family. |
| `opportunity` | Retain responsibilities, requirements, factual arrangements and application action; correct independent reading measure. | Facts remain a definition list beside their meaning; the requested action remains next to the application explanation. |
| `integrations` | Retain static/server boundary narrative and comparison table; correct independent reading measure. | This is reference work, so comparison remains a real table rather than forced prose. |
| `stress-test` | Retain all semantic stress objects and locally scrollable wide content; correct independent reading measure. | Long identifiers, lists, footnote return paths, code, MathML and absent-image cards are deliberate tests, not expendable styling. |
| `article` | Use the actual source inline `.toc` and bounded 48rem article body. | Sustained reading and return context differ from a document reference rail. Account, error and announcement recipes retain their own existing task frames. |
| `documentation` | Three annotated reading destinations replace uniform card boxes. | Each destination and its summary form one relationship; stronger spacing separates different reading paths. Exact titles, summaries, URLs and order remain data-driven. |

There are ten actual `document` recipes including the three first-wave exemplars. The overall measure correction therefore applies to those ten document wrappers; it does not broaden application or collection layouts. Existing exemplar-specific rules must remain intact when their accepted commits are integrated.

## Accessibility repair and boundaries

The shared table adapter previously named the scroll region identically to its outer labelled section, causing duplicate landmarks on reference, integrations, stress-test, event and report. The inner label now appends “table”; captions, section IDs, rows, values and keyboard focusability are unchanged. Event and report receive only that semantic correction, not a composition redesign. The separate dashboard operations landmark is outside this wave.

`tests/reading.mjs` checks the nine changed reading/documentation routes at 320, 768 and 1440px, both appearances and root/subpath: 108 route/viewport/mode cases plus 18 no-JavaScript cases. It checks stable section links, independent measures, table region/caption relationships, documentation URLs, article context, code/MathML/footnotes, 200% text, forced colors, overflow and full-page axe without exclusions. Individual scans and cleanup are bounded; the overall gate fails after five minutes. Existing all-50 behavior and hero checks remain required. Visual source comparison and paired masked review remain separate evidence, not implied by passing automation.
