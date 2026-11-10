# CardForge v0.2.3

## Custom labels and Item cards

Custom cards have an optional **Card Type Label** of up to 30 characters. The card prints it in uppercase above the title on either information face. A blank or whitespace-only label leaves the category line out. Library filters and template logic still identify the card as Custom.

New Item cards start with Arcane and Parchment. They share the existing independent frame and theme choices, artwork crop controls, typography, tags, and side placement. Only the item name is required. Identification is open in the editor, with expandable equipment and back sections. Changing category hides inapplicable equipment fields and keeps their values for when the category changes back. Custom categories and rarities print their names once entered. Restricted and custom attunement expose a free-text requirement. Tags can mark items as consumable, cursed, or any other category when appropriate.

## Backup compatibility

New exports use schema v3. The same browser storage key accepts v1, v2, and v3. A missing Custom label displays as blank, and an explicit label is preserved. v2 cards retain their IDs, fields, typography, artwork, queue, and printer settings. v1 backups follow the existing migration that puts their original fields on the front. Item identification uses the regular card fields with validated choices. Descriptions and other back sections are multiline fields and use the shared adaptive renderer. **Merge** adds new IDs and preserves the active library and print setup. **Replace library** remains available for an explicit full restore.

## Samples

The [seven-card sample library](../output/libraries/items-and-custom-v0.2.3.json) contains five items and two Custom cards. It includes the homebrew Light Bringer warhammer, the **LOCATION** label on The Glass Archive, and an unlabelled Second Key. Published examples use original summaries of the 2024 rules. [D&D Beyond Equipment](https://www.dndbeyond.com/sources/dnd/br-2024/equipment) · [D&D Beyond Magic Items](https://www.dndbeyond.com/sources/dnd/br-2024/magic-items) · [D&D Beyond Magic Items A–Z](https://www.dndbeyond.com/sources/dnd/br-2024/magic-items-a-z)

The [print proof](../output/pdf/items-and-custom-v0.2.3.pdf) uses A4 at actual size, with seven 63 × 88 mm cards in the nine-up layout. Print with long-edge duplex.

## Verification

- All 63 tests and the production build passed. Tests cover v1/v2 migration, label omission, Item validation, all frames, adaptive fit, continuation, and merging the sample library.
- Production Chromium at 320 px loaded an existing v2 library, edited and saved an Item offline, switched categories without losing values, cropped artwork, and exported PNG and a single-sided PDF. The Custom label survived duplication, save and backup.
- Offline merge added all seven sample cards without changing the active library settings. Reimport skipped all seven. An isolated restore round-tripped the sample library and exported the duplex proof offline.
- Both A4 proof pages were rendered and inspected. The 14 faces fit, and the PDF placement coordinates matched the long-edge mirror, including the two blank slots. Physical printer alignment and iPhone Safari remain unverified.
