# CardForge v0.2 acceptance checklist

## Compatibility
- [x] Existing v0.1 library and backups load with no data loss; schema migration tested.
- [x] Existing Spell, NPC RP, Plot Point and Custom templates still work.
- [x] Monster card supports structured statistics, actions, traits, tactics and notes.
- [x] Existing single-sided 9-up PDF and PNG exports remain available.

## Art and cards
- [x] Reference PNG located and inspected; asset preparation documented.
- [x] Each available ornamental frame selectable for any card type.
- [x] Frame images are not stretched; transparent/content-safe centres and crop verified.
- [x] Elaborate decorative back and framed information back both supported.
- [x] Cinzel heading with readable offline fallback; no restricted font distribution.
- [x] Tags have optional icons and readable labels; adjustable content placement.
- [x] User can import artwork and its image survives local storage and JSON backup/restore.
- [x] Overflow is warned about; no clipped text; readable minimum font size.

## Duplex print
- [x] A4 pages exactly 210 × 297 mm; 3×3 cards, each 63 × 88 mm.
- [x] Alternating front/back page pairs for 1, 3, 9, 10+ cards.
- [x] Correct back-side slot correspondence for long-edge flip; short-edge option verified.
- [x] Unused slots blank; empty card reverse can use decorative artwork.
- [x] Back X/Y offset calibration; 20 mm ruler; numbered duplex test page.
- [x] Optional crop marks do not intrude into artwork or content.
- [x] Print 100% instructions; both PDF pages inspected visually.

- [ ] Check ruler, corner alignment and feed tolerance on physical prints for both flip settings.

## Mobile/PWA
- [x] Responsive at 320px and common iPhone widths; touch targets usable.
- [x] Installable manifest and service worker; app shell works offline after installation.
- [x] Card create/edit/save/duplicate/library works on mobile.
- [x] JSON backup/restore works and validates input.
- [x] Mobile PDF download verified in Chromium with a phone viewport. Open and system sharing paths are documented.
- [ ] Verify installation, download/share and printing in iPhone Safari on a physical device.

## Quality
- [x] Automated tests include schema migration, duplex geometry/mirroring, export and overflow.
- [x] npm test and npm run build pass.
- [x] README and implementation notes updated, known limitations explicit.
- [x] RollWithAdvantage repo untouched.


## Verification evidence

- `npm ci`, `npm test` (44 tests), and `npm run build` passed.
- Production Chromium checks at 320, 375, 390, 430 and 1280 px covered the studio and print queue without page overflow. The browser workflow loaded a v0.1 library, created and edited a Monster, imported and cropped artwork, restored an exported backup, duplicated a card, filtered by collection and tag, and saved printer offsets. A service-worker-controlled page reopened and generated a PDF with the browser offline.
- PDF tests checked A4 dimensions, exact trim placement, crop/ruler generation, blank slots, and signed back offsets. Mapping tests covered 1, 3, 9, 10 and 19 cards for both flip modes. The sample long-edge duplex PDF was exported through the production UI and rendered with Poppler. It includes all four ornamental frames, Classic, framed reverse content, decorative backs, and a dense original Monster.
- The frame crops retain opaque parchment centres. Smaller frames and the decorative back have lower effective resolution than the exported text. The implementation notes record the crop dimensions, provenance and replacement process.

## Reproduce the print check

1. Queue one, three, nine and ten cards. Include an empty automatic reverse and a dense information reverse. Try both flip choices and compare the numbered preview with the PDF.
2. Export a duplex test sheet with a nonzero X/Y offset. Check that only the back moves. Compare the physical card numbers and corner labels through the paper after printing at 100% and selecting the matching flip in the printer dialog.
3. Measure the ruler and trim rectangle. Repeat on another printer if possible and save its measured offsets separately.
