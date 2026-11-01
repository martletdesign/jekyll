# Porting the collection to Astro and React

## Preserve the contract

Consume `content/catalog.json` and validate against `contracts/catalog.schema.json`; do not parse the generated Liquid or rendered HTML. Preserve stable IDs, destinations, semantic classes, order of sections, source metadata, and capability boundaries. The schema version is `1`; incompatible changes require a migration and a version increment.

Actions may supply an optional `download` filename. The schema accepts 1–128 ASCII letters, digits, dots, underscores or hyphens, beginning with an alphanumeric. Preserve it as the escaped anchor `download` attribute for these same-origin fixture URLs, so the browser can save the resource under a stable name even when a build fingerprints its URL. Omit that attribute for ordinary navigation actions. Browser download behavior and server `Content-Disposition` headers can affect the final filename; the attribute does not guarantee cross-origin downloads.

A page has `id`, `semantic_class`, `composition`, `title`, `summary`, `category`, and `sections`. Articles additionally require `date`, `author`, and `tags`. Events require a structured event record with offset-bearing start/end timestamps, display values, IANA timezone, location, and registration state. Other classes currently compose their domain information from typed sections; add dedicated schemas and renderers when those classes acquire reusable structured behaviour. A class label alone does not imply a complete domain model.

Event renderers validate machine-readable timestamps using a conservative subset of the [HTML global date-time format](https://html.spec.whatwg.org/multipage/common-microsyntaxes.html#valid-global-date-and-time-string): four-digit years 0001–9999 and a real Gregorian date; uppercase `T` or a space; `HH:MM`, optionally followed by `:SS` with an optional decimal fraction of one to three digits; and uppercase `Z` or a colon-bearing `±HH:MM` offset. Offset hours are 00–23 and minutes 00–59; `-00:00` is invalid under the HTML grammar. Other valid HTML forms such as longer years and offsets without a colon are outside this shared subset. Invalid values keep the authored display text with an invalid-time marker, without emitting a `time` element. The schema remains permissive, and when both timestamps are valid, the renderer compares their instants and warns if the end precedes the start. Equal instants are allowed. This does not verify whether the display label matches the timestamp or whether the offset matches the named IANA timezone.

Sections are a discriminated union: prose (no `kind`), cards, listing, facts, figure, table, stats, FAQ, plans, form, search, gallery, workspace, chat, sensors, scene. IDs are stable fragment destinations. Keep links and media in structured fields so adapters can apply the deployment base path. Content strings are authored Markdown, not Liquid or JSX. The stress fixture deliberately contains trusted author-supplied semantic HTML/MathML. Do not feed untrusted user HTML through this renderer; sanitise it at the ingestion boundary using an explicit allowlist.

## Adapter boundaries

- **Astro:** implement the seven composition frames as layouts and section roles as components; emit the shared browser enhancement script or equivalent island behaviour. Generate routes from the catalog and apply `BASE_URL` to structured local destinations and media. Use the family's native shell and fonts.
- **React:** implement a typed discriminated union from the schema and a section renderer keyed by `kind`; use the family's existing components where their contracts fit. Keep browser state in the relevant component, with effect cleanup. Use the chosen router's base-path handling. Do not import both families' CSS or fonts into a single-family build.
- **Shared:** reuse the content and acceptance criteria. The existing dependency-free browser script is a reference for behaviour, not a requirement to use imperative DOM code in React.

The workbench's `examples/page-archetypes/INTERACTION-CONTRACTS.md` specifies cross-framework requirements for applied versus draft state, failed URL updates, exports, asynchronous focus, validation and readable transitions. Those contracts describe expected behavior and bounded regression evidence; they do not imply that every component or framework implements a particular controller API.

Martlet demonstrates sustained reading, editorial collections, and a collection-to-focused-record flow. Krigsvold demonstrates aligned section labels, compact records, supporting facts, and a divided collection/active-record workspace. Both collapse to a logical reading order on small screens. Do not reduce this distinction to a token swap, or make either family unable to render the other family's content.

Demo contact and sign-up forms reject required names or messages consisting only of whitespace; keep the user's text unchanged, clear the error when the field is corrected or reset, and retain native required-field validation for empty values. These are local demonstrations and do not submit data.

## Service integrations

| Capability | Required live adapter | Current specimen |
| --- | --- | --- |
| Contact/newsletter | Submission endpoint, delivery, abuse controls, consent handling | Native constraints and local status only |
| Identity and two-factor | Identity provider, server verification, sessions, recovery | Format validation, no authentication |
| Booking/payment | Confirmed registration or transaction provider | Enquiry destination only |
| Messaging | Authorised service, persistence, delivery acknowledgement | Text-only messages in page memory |
| Sensors and fleet | Authorised data/device service | Simulated data and local selection/review |
| Scene/VR | Renderer and device support | Captioned static scene selector |
| Search | Optional hosted search for larger collections | Build-time index of title, summary, category |
| Error routing | Host-specific status and routing configuration | `404.html`; server-error page returns normal static status |

Do not show a success claim until the relevant live adapter confirms it. Keep loading, validation failure, empty, unavailable, uncertain-result, and retry states explicit as live services are added. Account screen variants are composition choices, not separate identity implementations.

## Extending the collection

1. Identify the new content semantics before designing the frame.
2. Extend and version the schema where required.
3. Add fixture content once, with real destination relationships.
4. Add a section renderer, class-specific renderer, or composition only when the new semantics require it.
5. Provide both family renditions and the same recovery/accessibility behaviour.
6. Run parity, root/base-path, rendered-link, no-JavaScript, print, and browser checks.

The 50 canonical recipes cover the Material Kit catalog's general page roles plus reference documents, collection records, search, events, reports, exhibitions, change histories, and content stress testing. They do not reproduce Creative Tim source code or claim backend functionality. The experimental scientific workspace is separate from that catalog.

## Design authorities

`https://jameshoward.us/` is authoritative for Martlet; `https://krigsvold.org/` is authoritative for Krigsvold. Reuse source markup/classes and interaction states before adding a new treatment. Record a concrete reason for any departure; generic fixture styling is not a reason to replace native typography, casing, geometry, or interaction.

Buttons resolve through each family's `button-classes.html` adapter: Martlet uses the source `.button`; Krigsvold uses `.btn` and its native filled/outline variants. Dark Krigsvold reading surfaces use the source hero's ice/white contrast treatment. Keyboard focus mirrors hover while preserving a visible focus ring. Martlet post tags use the source `.post-tags` strip beneath the masthead and the existing `.pill-list`, not underlined links inside the masthead.
