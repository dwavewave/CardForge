# CardForge v0.2 implementation

The v0.1 app already shares a canvas renderer across live preview, PNG and PDF. It stores cards and the print queue in a versioned localStorage envelope and already has a 3 × 3 A4 grid and continuation logic. v0.2 extends those paths. The supplied project folder has no Git metadata. The RollWithAdvantage source audit remains in REFERENCE_AUDIT.md.

Inspected reference/cardinspo.png at 1536 × 1024. It contains a large dragon frame, three smaller sword, arcane and wing variants, and a dragon compass reverse. The original stays in place. The crops preserve the source proportions and use inset text zones. The small source frames cannot provide native 300 DPI detail at trim size.

Implementation order is schema migration and Monster fields, duplex geometry and regression tests, image extraction and rendering, then editing, offline support and export proofs.

## Architecture and data

Schema v2 reuses the original storage key. The validator preserves v1 field values, identities, custom labels, tag colors, queue order and print setup. Migrated cards use Classic with explicit front placement. New cards choose Dragon initially and use template-based placement, which can be overridden field by field. Reverse notes and artwork placement are separate from template fields. Monster uses original empty stat and action fields.

Artwork is decoded locally and resized to at most 640 px on its longest side. The app stores a bounded JPEG data URL with the chosen side and crop parameters. This makes images portable in JSON but trades away source resolution and alpha. The artwork source remains with the user. The JSON import limit is 15 MB and the library limit is 500 cards. Browser localStorage quotas can be lower, especially for libraries with many illustrations. The app surfaces persistence errors and can still export a backup of the in-memory library. Collections and tags support finding cards. The print queue serves as one ordered session list.

A single canvas pipeline lays out preview, PNG and PDF faces. Deterministic type steps keep body text at 25, 23.5, or 22 canvas units on a 630 × 880 layout. An overflowing preview omits content beyond the safe area. Exports refuse the overflowing side. Continuation splitting keeps field order and source text on each side. Empty automatic backs use the decorative image. For an intentional decorative override, any information stays in the model for later editing.

## Art provenance and replacement

`node scripts/prepare-frames.mjs` derives the five PNGs and app icons from the supplied 1536 × 1024 `reference/cardinspo.png` using fixed pixel crops. The source file was left intact. Crop boxes exclude all composite captions. They retain the parchment centres and a small amount of original dark surround at irregular edges. The renderer fits each crop uniformly into the 63:88 face and fills leftover space with a dark matte. Text and portraits are inset according to each frame. Theme overlays stay in the inset text area.

| Asset | Crop dimensions | Effective resolution across the face |
| --- | ---: | ---: |
| Dragon | 599 × 841 | ~242 DPI |
| Sword | 266 × 416 | ~120 DPI |
| Arcane | 268 × 398 | ~115 DPI |
| Wings | 312 × 406 | ~126 DPI |
| Compass back | 321 × 429 | ~130 DPI |

Resolution is approximate and based on the uniform contain scale. The 300 DPI-equivalent export preserves text detail and does not restore missing source pixels. Replace individual PNGs under `public/frames/` with higher-resolution or transparent originals using the same names. Preserve the 63:88 portrait ratio or use transparent padding and check the per-frame content insets in `src/layout.ts`. Adjust the extraction script if switching source composites. Cinzel, Inter and Lora ship locally via Fontsource, with SIL OFL notices in `public/licenses/`. Cinzel falls back to Lora, Georgia and system serif.

## Duplex geometry

PDF coordinates are converted from millimeters to points using 72/25.4. The shared page planner centres a 3 × 3 grid on 210 × 297 mm portrait pages, with each image drawn at exactly 63 × 88 mm. Blank front slots map to blank back slots, including the trailing sheet. The diagram reads left to right, top to bottom, with each page upright.

| Front | Long-edge back | Short-edge back |
| --- | --- | --- |
| 1 2 3 | 3 2 1 | 7 8 9 |
| 4 5 6 | 6 5 4 | 4 5 6 |
| 7 8 9 | 9 8 7 | 1 2 3 |

Long edge maps `(row, col)` to `(row, 2 - col)`; short edge maps it to `(2 - row, col)`. Individual card faces stay upright in the PDF. The flip in the printer driver supplies the physical reversal. Back offsets of ±4 mm translate only the back page geometry. The calibration sheet labels the same card and physical corner on each side and has upright arrows. Driver preferences request the chosen flip and actual size; some print apps ignore them. Crop marks stay in gaps or outside the grid, and the optional safe/bleed guides are intended for proofing.

## PWA

The production build writes a service worker keyed to a hash of the application files. It precaches the app shell, lazy PDF module, fonts, artwork, and install assets. A new version waits for old app windows to close before taking over and deleting its predecessor's cache. Library data stays in localStorage, separate from the app-shell cache. A device needs an initial online load from a secure origin. iPhone Safari installation, system printing and sharing need physical-device testing.
