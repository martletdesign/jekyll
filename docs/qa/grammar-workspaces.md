# Martlet grammar reconciliation: workspace relationships

Reviewed accepted-source dashboard includes, existing `dashboard-family.css`, shared dashboard mechanics, native form/workspace/chat/sensor includes, and the exact 15 Wave 4 ledger rows. Independent implementation began from accepted `develop` `0701a83e948964fd5bf2e05ee31e7385af7752d6` in `feature/grammar-workspaces`. Accepted Wave 3 `develop` `343bfb64d6f4a8159bf5f85f1ebbd226f9185177` was integrated with a normal merge before final verification; no unaccepted feature branch was used as the integration base. No data/controllers change. Existing Martlet dashboard hierarchy (documentary sidebar, transparent metrics, separated panels and full-width session trend) is meaningful and must remain intact; the application retains its wide working canvas, not an article measure.

## Twelve retained routes

| Route | Retain rationale |
|---|---|
| sign-in | Named fields, password assistance, local-only boundary and recovery links already remain together. |
| sign-up | Identity fields, consent and explicit local validation are coherent; no need for an invented account shell. |
| password-reset | Explanation → email → action → return is the actual recovery task. |
| two-factor | Code format assistance is already associated with its input; preserve native numeric/length constraints. |
| coming-soon | Short announcement and optional update form already form a readable task sequence. |
| not-found | Existing explanation and destinations provide recovery; another decorative error treatment adds no capability. |
| server-error | Concise limitation and useful next steps already serve recovery. |
| workspace | Existing Martlet collection-before-focused-record composition and return context are native and meaningful. |
| chat | Ordered conversation, nearby composer and reset/local-only explanation already preserve continuity. |
| sensors | Simulated reading, related controls and capability limits are grouped; retain the real state model. |
| fleet | Existing contextual collection-to-focused-record progression must not become a forced side-by-side register. |
| scene | Native selector, descriptive figure and no-live-renderer boundary already explain the capability. |

## Three bounded dashboard refinements

**Analytics:** Preserve four summary metrics, full-width sessions trend, download/category comparison and exact source table. The current toolbar gives period/range/start/end/category equal gaps, although date controls form one relationship and category is a separate scope. Group the three existing date controls together and keep category beside that group, using small field gaps and larger group separation without adding boxes or new visible fixture text. Associate the existing calculation/source explanation with the metric summary (`aria-describedby`); retain the explanation text, source table, charts and all data. No metric definitions, graph algorithms or controllers change.

**Administration:** Preserve the directory → focused editor flow, sorting/selection, modal confirmation and retained-draft behavior. The current `.dash-actions` mixes the selected-record commands and `Add person`. Separate the existing selection count + Activate/Suspend commands into an explicitly named selected-people group, with the unchanged Add-person command in a separate collection-action group. Responsive spacing expresses different command scope; there is no new widget, action, permission or editor mode. Existing identity/access fields are already a valid compact two-column editor and should not be restyled just to manufacture difference.

**Operations:** Preserve trend/timeline, service table and alert register. Group existing monitoring-window/service fields, warning interpretation, and alert-view controls according to their actual scope, keeping all names, order, IDs and values. Keep threshold assistance beside its input; connect existing availability/acknowledgement explanations to their tables without adding authored data or changing acknowledgement behavior. Required accessibility repair: inner scroll region becomes `Service status table`, distinct from outer `Service status`. Existing per-row acknowledgement remains adjacent to its alert; no invented monitoring widget or moved durable-service claim.

These are contextual application extensions of Martlet relationships/proximity/scope, not claims that literal dashboard templates were observed at jameshoward.us. Canonical tokens, approved hero/warm chrome/footer, all 50 fixtures, `dashboards.json`, module/controller bytes and native input/keyboard behavior remain protected. Keep all existing family CSS rules; append narrowly scoped grouping rules rather than replacing the dashboard composition.

## Separate feature and verification

The isolated feature preserves accepted ancestry and must never stack on an unaccepted feature. Code scope: the three dashboard includes plus narrowly scoped `dashboard-family.css`, tests and rationale. No dashboard dataset or JavaScript mutation.

A focused gate should cover only the three changed dashboards at 320/1440, light/dark, root/subpath (24 cases), plus six no-JavaScript checks. Check grouping/command scope, exact controls/IDs, filter/apply, empty/error recovery, selection/confirmation/cancel/editor retention, threshold/acknowledgement and unique landmarks, forced colors and 200% text. Preserve existing all-50, grammar, reading and collection gates. Measure actual duration and use bounded scans/cleanup; choose the final job budget from observed aggregate Firefox time, without deleting assertions or repeatedly sweeping the twelve unchanged routes in every new gate.

Initial source build passes. A static rendered comparison against the accepted-source snapshot retained all native input/select/option/button attributes and order: analytics 17, administration 47, operations 23; markup remained balanced. These are preliminary compatibility checks, not browser/visual acceptance.

Filter groups and their fields use font-adaptive `auto-fit` minimum tracks, so actual 200% root text can reflow even when a viewport media breakpoint has not fired. Final browser checks must include 1440px with actual enlarged root text, not only a 320px viewport. Typography and native controls must remain intact.

The preliminary 18-case Chromium probe passed automated accessibility/reflow, including complete native date segments at actual 200% desktop text. Manual review then exposed a preexisting cascade leak: the frozen shell's broad `label` rule sets `flex-direction:column`, while the existing checkbox rule restores `display:flex` without restoring row direction. The dashboard-specific checkbox rule now sets row direction explicitly so assistance remains beside its control. The later full workspace gates confirmed row direction in Chromium and Firefox on combined preparation commit `07fc891e242cae19fe840e91561e5f1c7188bf6f`; the earlier screenshots still identify the old source accurately.

The focused `test:workspaces` test selects Chromium/Firefox/WebKit through `BROWSER` and builds its own root/subpath artifacts. It covers 24 appearance/viewport/routes, 12 actual desktop 200% text states and six no-JavaScript pages. Full transactions (analytics filter/CSV/invalid-range recovery; directory selection/modal/draft/validation/retry/save; monitoring threshold/acknowledgement/reset) and print are exercised once per base in the wide light state; geometry, accessibility and forced colors cover every normal state. Individual operations, downloads, accessibility and cleanup have explicit deadlines under a three-minute overall and CI-step cap. No font-ready promise is used in a JavaScript-disabled context. All earlier browser checks remain enabled as advisory measurements. The required GitHub acceptance check is `verify`; accepted-branch integration supplies acceptance. Measure runtime/exit receipts before claiming a particular test passed.
