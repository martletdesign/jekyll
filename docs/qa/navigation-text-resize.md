# Narrow navigation text resizing

At 320px with actual root text enlarged to 200%, the accepted host allocated only 83.08px to the brand while its painted contents occupied 210px. The brand's two lines crossed the adjacent Menu label. The earlier 1440px enlarged-text check was clean; that wider result did not establish narrow-screen fitness.

The host now lets the existing row wrap when its intrinsic brand and Menu cannot fit together. The image and Menu retain their intrinsic allocation; the brand text wraps inside its own space. A small row gap keeps the wrapped controls clear of the first masthead text as well as its heading. A first attempt that merely constrained the brand became too tall; a second cleared the heading but touched the eyebrow. Both were rejected by direct visual review. The final assertion includes the earliest visible masthead eyebrow or heading, not just the h1.

These appended host layout rules leave the canonical shell, header content, menu JavaScript, approved hero declarations/images, type sizes, fonts and colors intact. Ordinary single-row views preserve the source arrangement. No-JavaScript destinations remain visible.

Run `npm run test:navigation` to build a temporary locked standalone site and verify it, or supply a built site path after `--`. Set `BROWSER` to chromium, firefox or webkit. `CHROMIUM_PATH` optionally selects a system Chromium. The bounded harness covers 54 states:320/768/1440/1920px, both appearances, home/compact search/dashboard, actual200% text at320/768/1440px, and no-JavaScript fallbacks. It checks painted glyph ranges, brand allocation, first masthead text clearance, document overflow, existing Enter/Escape behavior and focus return. It never waits on the JavaScript font readiness API when JavaScript is disabled; native loading and rendered fallback remain tested.

This shared host accessibility correction does not manufacture a recipe-specific organizational difference. Automated checks and direct visual review do not claim physical assistive-technology certification.
