# CardForge v0.2.5

## Creature statistics

Monster and NPC cards use the same **Creature statistics** editor. New Monsters start with **Show Mini Stat Block** enabled. New NPCs start with it off. Existing cards keep their previous presentation until the user enables it. Turning it off after enabling it hides the compact front stats and frees that space. The saved values, back fields and attack entries remain available.

The block reuses saved stat fields, attacks, and legendary actions. Standard retains the regular artwork window. Combat reduces the front artwork height to 60% and increases damage formula type by 0.2 mm. Both layouts use the saved zoom and focal point. The shared renderer fits the block and the remaining content together and reports overflow before export.

Ability modifiers use an explicit override first, then a modifier entered with the score, then `floor((score − 10) / 2)`. Existing text such as `18 (+4)`, `1/4 / 50 XP`, or `30 ft., fly 80 ft.` stays intact in backups. The compact view separates recognized values for display. Enter challenge rating, XP, proficiency and initiative as needed for the creature. [2024 creature stat blocks](https://www.dndbeyond.com/sources/dnd/br-2024/creature-stat-blocks) · [2024 ability score modifiers](https://www.dndbeyond.com/sources/dnd/br-2024/creating-a-character)

## Backups and proof

Schema v5 adds optional per-card stat block settings. Versions 1–4 are still importable using the existing browser storage key. Migration retains IDs, fields, placements, combat data, artwork, queue, and print settings. Import Merge skips matching IDs as before.

The [eight-card sample library](../output/libraries/creature-stat-blocks-v0.2.5.json) and [A4 long-edge duplex proof](../output/pdf/creature-stat-blocks-v0.2.5.pdf) include a goblin, armoured captain, flying dragon, legendary wyrm, noncombat NPC, combat NPC, creature with five additional movement modes, and a titan with Strength 30 and a manual +12 modifier. The Goblin Warrior uses 2024 rules. The other creatures are homebrew. The two artwork examples use a crop of the project’s Dragon frame. [Goblin Warrior and 2024 creature stat blocks](https://www.dndbeyond.com/sources/dnd/br-2024/creature-stat-blocks)

## Verification

- The production build and 76 tests passed. New tests cover modifier precedence, old backups, placement, toggling, artwork crop settings, sample fit, and overflow warnings.
- All 18 faces from the v0.2.4 combat library produced identical layout operations before and after migration.
- Chromium at 320 px verified offline reload, editing, defaults, toggles, crop retention, JSON backup and restore, and PNG and PDF export. The Goblin Warrior front matched across preview, PNG, and the decoded image in the PDF.
- Both proof pages were visually inspected. The eight fronts and eight backs retain 63 × 88 mm card slots with mirrored long-edge placement. Physical printer alignment and iPhone Safari remain unverified.
