# Acceptance checklist

- [x] Reference audit records actual inspected paths or access limitation.
- [x] User can create and edit Spell, NPC RP, Plot Point, and Custom cards.
- [x] Tags can be added, removed, reordered, and assigned colors independently of fields.
- [x] Preview updates as fields change and is representative of export.
- [x] NPC performance cues are prominent.
- [x] Cards persist across refresh; JSON backup/import works with validation.
- [x] A4 PDF prints 3 × 3 cards at 63 × 88 mm, with correct margins/gaps and pagination.
- [x] Individual PNG export targets 300 DPI equivalent.
- [x] Long text warns and supports continuation rather than illegibly shrinking.
- [x] Print controls include optional crop marks and clear actual-size guidance.
- [x] No backend required, no edits to reference repo.
- [x] Tests and production build pass; commands documented.

Verification: `npm run build` succeeded and `npm test` passed all 33 tests. Browser smoke checks covered editing and saving a card, refresh persistence, continuation creation, JSON backup and restore, and downloading an A4 PDF. The downloaded sheet was rendered and reviewed for legibility, card placement, and the calibration footer. The automated export tests additionally check a two-page PDF, physical image sizes, and the 20 mm calibration line. No physical printer was used.
