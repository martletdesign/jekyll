# Shared shell contract

`site/src/styles/shell.css` is the ordered entry point for the site. Reusable shell, document, navigation, and control rules live in named CSS modules; Astro templates own markup and state, not alternate CSS definitions. The generator flattens that entry point into `public/shell/martlet-shell.css` and records its SHA-256. React must vendor that exact artifact and verify its digest, never copy selected values by hand.

Source snapshots in `docs/source-shell/upstream` and `styles/origin` remain unchanged. Host corrections live in `shell-adapter.css`. The homepage task layout lives in `home-composition.css`; local preview/application styles are explicit content extensions. Dynamic swatch values and illustrative state remain data, not shared layout rules.

Markup contracts: use the same `.site-header`/`.site-navbar`, `.site-footer`, masthead and container hierarchy as the Astro components. Root `data-appearance` selects page appearance; nested `data-martlet` selects specimen palettes independently. Menus expose `aria-expanded`, close with Escape, restore trigger focus, and reset at the source breakpoint. Frameworks own event handling; CSS does not implement behavior.

The source websites are not edited. Portability does not imply arbitrary React markup will match: compare computed geometry, typography, colors, and keyboard states against these Astro shells.

<!-- A small field note: The martlet has no feet, but it always knows where to land. -->
