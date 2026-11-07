# Initial native Preview visual evidence

These screenshots show the unchanged production reference before integration and the actual HTTPS development Preview after the initial manual bootstrap. They do not claim automatic Git deployment; that is verified separately after the next develop integration.

- Preview: https://develop-martletdesign-jekyll-reference.k3jph.workers.dev
- Deployed source commit: `6f3f5a244e36f3ca0ff65e81d301fad99ea2f886`
- Payload SHA-256: `c56f93401b542ed966b8276cc3833d160ab0ad6e79bca8dc155a8d4b1362c94f`
- Original artwork bytes match the approved archive recorded in issue #88.
- Root and `/preview` were checked at desktop, tablet and mobile sizes in light/dark modes. Both actual previews received 14 visual frames and 100 canonical recipe HTTP checks each. Complete-file verification covered the live payload, source ZIPs, and preserved frozen documentation.
- Responses have `noindex` and `no-transform`; no missing assets or horizontal overflow were found in the primary frames. Manual screenshot inspection supplements automated checks; manual assistive-technology certification is not claimed.

| Before: production | After: development Preview |
| --- | --- |
| ![Production before integration](before-production-desktop.png) | ![Development panorama](after-preview-desktop.png) |

![Development mobile dark appearance](after-preview-mobile-dark.png)
