# Martlet grammar reconciliation: collection and dossier tasks

Tracks [work order #91](https://github.com/k3jph/design-workbench/issues/91). This independent feature began at accepted `develop` `0701a83e948964fd5bf2e05ee31e7385af7752d6`; the accepted reading wave `d983fcc22218de9e96dd932d5d0cb149740b1dbd` was integrated by a normal merge before final validation. Fixture bytes, all 50 IDs/routes, section anchors, content, controls and the shared search controller remain unchanged. There are **23 Wave 3 ledger rows: two changed and 21 retained**, not a blanket restyling of every collection/detail/landing/dossier. Documentation belongs to Wave 2 and the interactive scene to Wave 4; neither is a new change in this wave.

## Source and task decisions

[Jameshoward.us](https://jameshoward.us/) remains the authority. Its actual [search page](https://jameshoward.us/search/), directly retrieved 2026-11-03, groups query and action in a bounded `.search-form`, uses a serif prompt, then presents status and full-width title/excerpt result entries. Its object-specific border/gold top boundary belongs to that query group, not to every form or page. This host translates that object to its existing native controls and appearance tokens, with responsive padding; it does not copy the origin’s separate Clear interaction or change its own state machine. Dark mode is the host’s existing contextual extension.

The [Martlet grammar](https://github.com/k3jph/design-workbench/blob/main/docs/languages/martlet/grammar.md) asks relationships, readable sequence and continuity. Search results must retain their applied query context while a new query is drafted. The existing controller already names the applied query, handles no matches/recovery and changes the URL; this wave groups that feedback and its results in an explicitly named region without rewriting the behavior. A concrete layout bug was found: generic collection CSS expected metadata plus a record body, while search emits **only one body child**. It placed the entire result in the 10rem metadata column. The scoped result layout now gives that child the available reading width.

The report’s four-section index is a **contextual reference-task extension**, not a claim that an identical report template was observed at the origin. It lets a reader move between period, measures, register and method while those exact objects retain their data forms and order. An independent 74rem envelope and at most 13rem index leave approximately 930px for evidence at a 1440px viewport; prose remains bounded by the existing dossier rules. The index reflows before the account on narrow screens. The other family may use an in-flow index because its existing aligned section-label column already provides another orientation edge; mechanically adding the same rail would create three competing columns.

## Exact dispositions

| Route | Disposition | Martlet task judgment |
|---|---|---|
| `home` | retain | Retain bounded introduction and separated related destinations. |
| `about` | retain | Retain purpose-to-principles-to-people sequence and readable groups. |
| `archive` | retain | Retain separate contextual metadata beside editorial record excerpts. |
| `category` | retain | Retain related-record sequence within the named topic. |
| `categories` | retain | Retain browsable topic groups and destinations. |
| `person` | retain | Retain biography-first progression and supporting facts near related work. |
| `projects` | retain | Retain annotated project entries and contextual metadata. |
| `case-study` | retain | Retain dossier reading flow with inset supporting observations. |
| `contact` | retain | Retain help beside the field and explicit committing action. |
| `service` | retain | Retain offer-to-process-to-next-step grouping. |
| `place` | retain | Retain figure context and nearby supporting facility facts. |
| `pricing` | retain | Retain comparable plans with explanatory disclosure support. |
| `careers` | retain | Retain readable opportunity annotations. |
| `software` | retain | Retain explanation-to-capabilities-to-action hierarchy. |
| `product` | retain | Retain object-first context and nearby specifications. |
| `collection` | retain | Retain annotated record browsing. |
| `collection-item` | retain | Retain object-to-record-to-context reading progression. |
| `events` | retain | Retain chronological event browsing with contextual metadata. |
| `event` | retain | Retain nearby event context and schedule reading sequence. |
| `report` | change | Add a contextual four-anchor index; retain readable summary, exact measures/register and nearby method/CSV action. |
| `gallery` | retain | Retain curated browsing and subsequent reading context. |
| `search` | change | Name query/result scope and restore full-width body-only results; preserve the controller and every recovery state. |
| `patterns` | retain | Retain local relationship grouping for each demonstrated object. |

## Verification boundaries

`tests/collections.mjs` focuses on report/search at 320, 768, 1440 and 3440px, both appearances and root/subpath: 32 route/viewport/mode cases plus four no-JavaScript pages. It checks report anchors, exact measures/download URL, an unsqueezed evidence column, applied versus draft search scope, exact matching records, result-body geometry, no-match recovery, clearing the query, forced colors, 200% text and full-page axe. Each accessibility scan and cleanup is bounded; the overall gate fails after four minutes. The original all-50 browser gate and previous grammar/reading gates remain enabled. No extra per-engine sweep of the 21 unchanged routes duplicates those gates. Paired masked visual review and independent all-50 contracts remain separate acceptance evidence.
