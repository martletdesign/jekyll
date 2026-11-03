# Reference hero composition contract

This host contract follows Workbench [#90](https://github.com/k3jph/design-workbench/issues/90). The framework-neutral language remains Martlet: Cambo/Lato/Cinzel roles, original navy/blue/gold/cream definitions, spacing relationships, keyboard behavior and content semantics are preserved. The hosted grammar/decisions snapshot observed for this work is 0.3.0, source `39d664082bb0dbdb09bc182a6abffebef75518ff`, digest `1e22377c734c58cbdb9c3644fc8a156fe8d70d474783dd1c5212bce9fe3ada60`. The actual original authority is https://jameshoward.us/. Its canonical blue identity is not changed by this reference-site composition.

## Four variants, three tiers

| `hero_variant` | Intended use | Behavior |
|---|---|---|
| `signature` | Homepage only | Approved footless-martlet panorama, existing full 3:1 composition and bronze/gold image tint. |
| `section` | Major landing pages | A distinct host-owned local image; 250–360px desktop masthead including navigation clearance; full image above text on narrow screens. |
| `compact` | Articles, documentation and example details | Restrained warm masthead without forced decorative photography. |
| `plain` | Utility/support pages | Minimal warm heading and context, without the decorative title rule or an image. |

Dashboards keep their existing application-owned heading, not an extra cinematic masthead. Their navigation uses the same warm reference chrome; panels, controls, syntax colors and data remain unchanged. The setup guide deliberately uses `compact`: installation instructions do not benefit from a decorative photo.

Existing front matter remains supported. With no explicit variant, an image on the homepage resolves to `signature`, an image on an interior page resolves to `section`, and no image resolves to `compact`. Unknown variants and explicit interior `signature` resolve safely to `compact`. Explicit `compact`/`plain` suppress legacy hero art; whitespace-only image values are treated as absent. Archived sources and the original homepage artwork are not rewritten.

```yaml
hero_variant: section
hero_image: /assets/images/sections/martlet-library-1920.webp
hero_image_width: 1920
hero_image_height: 640
hero_focal_point: center
hero_image_variants:
  - {url: /assets/images/sections/martlet-library-640.webp, width: 640}
  - {url: /assets/images/sections/martlet-library-960.webp, width: 960}
  - {url: /assets/images/sections/martlet-library-1440.webp, width: 1440}
  - {url: /assets/images/sections/martlet-library-1920.webp, width: 1920}
```

`hero_image`, `hero_image_variants`, intrinsic dimensions and `hero_focal_point` are host inputs. The older `hero_image_small` / `hero_image_medium` shape remains supported. Jekyll applies `relative_url` to every runtime image URL. Focal position applies to section crops only; it does not crop or reposition the approved signature panorama.

## Visual identity and licensing boundaries

Reference navigation, image-free mastheads and section compositions use deep brown, antique gold and cream. Plain pages always receive opaque brown navigation. Illustrated top navigation is transparent only over a protected dark region. The existing homepage overlaps its approved art; a header-only translucent warm scrim on narrow screens addresses measured text contrast without altering the image or its approved hero tint. Expanded/scrolled navigation is opaque brown. Forced colors retain system colors and functional menu text; reduced-motion behavior is preserved.

The 3 distinct secondary photographs are selected by the host: library for The Language, architecture for Examples and books for Journal. Their original bytes, source metadata, author, individual CC license, crop/resize operation and every derivative checksum are recorded in `_hero_sources/`. Those original photographs are source-archive inputs, not runtime image requests. Every section presents visible author/source/license/modification credits and a link to the public [image credits](/image-credits/) page. CC BY-SA derivatives retain their original ShareAlike license; unrelated MIT code is not relicensed. No tint is baked into image pixels and there are no runtime image hotlinks.

## Portability and verification

Core should eventually expose composition roles, height/spacing, focal positioning, tint and contrast boundaries, not these specific photographs or page titles. Astro and React adapters should express the same four variants and fallback behavior using their native APIs; neither package release nor another framework migration blocks the Jekyll preview. Martlet and Krigsvold share these semantic variant choices and functional/data contracts while retaining independent visual treatment. The structured `hero_credit` in this host is a Jekyll attribution adapter, not a canonical Core API.

Automated checks exercise the actual Liquid resolver, exact licensed assets/source ZIP allowlist, root/subpath builds, unchanged 50 recipes, both appearances, seven viewport widths, navigation/focus, no JavaScript, forced colors and axe. Screenshots and measured text/background contrast are reviewed separately. Axe incomplete findings remain incomplete; no manual assistive-technology or physical-print certification is implied. Cross-framework follow-up remains in [#88](https://github.com/k3jph/design-workbench/issues/88).
