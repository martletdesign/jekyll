# Acceptance criteria

## Build and contract gates

- Schema validation succeeds; missing article/event semantics and unsafe destination schemes are rejected.
- IDs are unique, all structured destinations resolve, and tables have consistent column counts.
- Both generated catalogs equal the canonical fixture byte-for-data; exported shell SHA-256 values remain unchanged.
- Both Jekyll builds succeed at `/` and a nonempty base path.
- Every rendered page has one h1, unique IDs, and valid local assets, links, and fragments.
- Source downloads contain no Git, hosting identity, credentials, caches, dependencies, generated output, or previous archive.
- CI detects generated-export drift and rebuilds from the checked-in lockfiles.

## Browser behaviours

- Search loads `q`, renders matching results, handles empty/no-result queries, and treats text as text.
- Pagination shows a bounded slice, announces the page, and supports previous/next recovery. Without JavaScript all records remain available.
- Workspace filtering announces counts, selection identifies the active record, local review updates it, filtering out the selection clears it, and reset restores the original state.
- Chat rejects whitespace-only input and renders angle-bracket input as text, never executable markup. Reset and reload discard local messages.
- Forms have labels, constraints, fieldset/legend, native invalid-input focus, local success status, and reset. Editing a field or resetting clears the prior validation status, which applies only to the previously submitted values. Without JavaScript submission controls remain disabled. No form values reach a URL or remote service.
- Gallery links work without JavaScript. Enhanced dialog supports labelled content, close, Escape, and focus return.
- Sensor and scene controls announce updates and identify the simulated/static boundary. Multiple instances retain unique labels and independent state; their controls remain disabled without JavaScript.
- Appearance, navigation, and focus remain legible in light/dark states. Mobile navigation opens, closes on Escape, and returns focus.
- At narrow widths, the document becomes a reading sequence; only bounded tables/code may scroll horizontally. Long unbroken titles and field labels must wrap without clipping or page overflow in LTR and RTL direction; this is a reflow check, not a claim of complete internationalization support.
- Print hides navigation and interactive controls and exposes all paginated records.

## Limits of automated evidence

Automated and visual checks do not establish comprehensive WCAG conformance. Manual screen-reader use, browser-engine coverage, print-on-paper review, and sustained reading remain useful before promoting the patterns as stable. Keep actual results separate from these criteria in VERIFICATION.md.
