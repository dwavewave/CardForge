# CardForge v0.2.2

## Import JSON

After validation, choose **Merge** to append new card IDs in file order. Matching IDs keep the current card, including local edits. Reimporting the same file adds zero cards. Merge keeps the current draft, print queue, printer profiles, and print settings. Merged cards are available in the library to queue for printing. The merge checks the card count and backup size and saves the complete result before updating the active library. **Replace library** remains available to restore a whole backup.

## Text Size

**Auto** chooses a starting ceiling from the amount of visible prose and measures actual text wrapping with the same fonts used to draw the card. It lays out each candidate with the title, tags, artwork, section labels, wrapped lines and paragraph spacing, then selects the largest size that fits the frame’s safe area. Prose sizes step down by half a point. Front metadata uses a narrower range to keep the existing two-column layout. Cinzel headings, Inter body text, the ornamental frames, and 744 × 1039 raster faces at 63 × 88 mm retain their original rendering pipeline.

**Small**, **Medium**, and **Large** set prose to 9, 11, and 13 pt and use corresponding compact metadata sizes. A manual selection stays fixed. A face that exceeds its safe area shows an overflow warning and blocks export until the content fits. Text Size is an optional schema v2 card field. Cards and backups without it default to Auto, and explicit selections survive import and export.

## Paladin proof

The [original deck JSON](../output/libraries/paladin-level-1-2024.json) is also the regression fixture. Its spell text and mechanics are unchanged. The [updated four-page duplex proof](../output/pdf/paladin-level-1-2024-v0.2.2.pdf) uses the same long-edge placement, A4 pages, margins, and trim dimensions as the v0.2.1 proof. The [same-scale visual comparison](../output/pdf/paladin-typography-comparison.png) shows the short Bless back and the dense Command back.

| Spell back | v0.2.1 body | v0.2.2 Auto body |
| --- | ---: | ---: |
| Bless | 7.09 pt | 12.00 pt |
| Cure Wounds | 7.09 pt | 13.00 pt |
| Divine Favor | 7.09 pt | 13.00 pt |
| Shield of Faith | 7.09 pt | 13.00 pt |
| Command | 6.66 pt | 7.50 pt |
| Protection from Evil and Good | 7.09 pt | 8.50 pt |

Measurements use the bundled fonts. Command is the one Paladin back that needs the 7.5 pt fallback below the 8 pt target to retain its full wording and separate command lines within the Arcane safe area.

## Verification

- `npm test` passed all 56 tests. `npm run build` passed.
- The suite checks merge idempotence, preservation of active library settings, limits, typography round-trips, measured wrapping, manual overflow, and both faces of all 16 Paladin cards.
- Chromium at 320 px verified offline merge, cancellation with an unsaved draft, unchanged existing settings, and skipping all 16 cards on reimport. A manual typography choice round-tripped through the UI, and the Bless back PNG matched the preview pixels.
- Chromium exported the updated deck offline. PDF placement checks verified four A4 pages with 9/9/7/7 faces and the same mirrored slot coordinates. All four rendered pages were inspected for text fit and ornamental clearance.
- Physical iPhone Safari and Home Screen operation remain unverified. The update uses the existing service worker and deployment configuration.
