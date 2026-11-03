# Approved Martlet panorama

The homepage artwork is the original maintainer-approved panorama from the preceding ChatGPT design review, transferred in `approved-panoramic-heroes.zip`. The airborne bird at dusk is host-owned decorative artwork; it is neither a photograph taken from jameshoward.us nor the heraldic Martlet mark. No external image URLs are used. The later regenerated 16:9 alternatives are not included.

`assets/images/heroes/PROVENANCE.json` records the supplied originals, dimensions, byte sizes, hashes, approval issue and rights basis. The approved 1536 × 506 WebP is retained byte-for-byte (SHA-256 `6ee7d00a6b2b0c25a7ea24fa0d334cc5ea3782e1fea4a1d81b91449d32de78b4`); the supplied 960px and 640px WebP derivatives are also unchanged. Their sizes are 41,024, 16,090 and 9,494 bytes. Native `srcset` selects one file, the intrinsic dimensions identify the ratio while the inherited masthead height reserves its layout, and the first-view image uses high fetch priority rather than lazy loading.

## Source authority and contextual extension

The authority for existing palette, type, spacing, header, navigation and plain masthead anatomy is https://jameshoward.us/ (`k3jph/k3jph.github.io`), as documented in `SOURCE-SHELL-PROVENANCE.md`. The existing source uses navy `#07111f` / `#0b1c33`, gold `#c7952f`, cream `#f8f4e9`, Cambo, Lato and selected Cinzel. The exported `assets/css/shell.css` and fonts are unchanged. These close navy colors must not be replaced to manufacture a family distinction.

This opt-in Jekyll composition adds the newly approved bird image, an asymmetric navy text scrim, and responsive focal positioning. It preserves the source masthead's dimensions and text measure. The canonical image-free dark masthead becomes cream; the photographic homepage is an explicit host extension that retains a navy image background and cream text in both appearances. Other pages retain the original dark-mode treatment. On the illustrated homepage only, the unscrolled transparent dark header uses cream foreground and gold selected/hover states; opening the mobile menu or scrolling restores the original cream panel with navy ink. The empty-alt, aria-hidden image is decorative and does not duplicate the visible heading. Image failure retains the navy fallback; forced-colors and print hide the decorative image and scrim.

Homepage front matter opts in with `hero_image`; the optional `hero_image_small` and `hero_image_medium` fields provide the supplied responsive derivatives. Omitting `hero_image` preserves the plain masthead. All paths pass through Jekyll `relative_url`, including `/preview` builds.

## Verification boundary

Existing standalone/source-archive and all 50 recipe assertions remain in place. The browser suite also checks the actual image, root/subpath URLs, three viewport sizes, light/dark, no-JavaScript loading, forced colors, image-failure fallback, and image-free nonhero pages. Axe incomplete findings remain incomplete; neither an automated pass nor a source hash establishes visual fidelity, manual assistive-technology coverage or asset copyright ownership. Independent screenshot review against the canonical site remains separate evidence.
