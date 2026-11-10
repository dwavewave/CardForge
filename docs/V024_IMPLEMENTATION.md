# CardForge v0.2.4

## Damage and combat cards

The optional combat editor works on Monster, NPC, Item, Spell, and Custom cards. Each ordered attack has its own hit bonus or save, damage components, and back-of-card effects. Components without a qualifier appear together while keeping each formula and type separate. A qualifier places a component on a separate line for effects such as Versatile damage, recurring damage, and upcasting. Dice and flat-damage recognition offer guidance. Free-text formulas are accepted and their entered text survives backups verbatim.

NPCs can add AC, HP, speed, traits, actions, bonus actions, and reactions. Existing noncombat NPCs and spells without structured damage keep their layouts. Item dice already on the front appear in the larger damage section. Adding the first structured attack can reuse those saved dice. Structured damage takes over the front damage display while the original fields remain editable.

## Legendary actions and layout

Monster and NPC cards can enable legendary actions. Enter the creature’s budget, recovery timing, activation restrictions, and optional introductory rules, then add, duplicate, remove, or reorder the individual actions. Costs are stored per action. CardForge leaves all rules fields blank by default. The front shows the budget and includes names and costs if they fit at the selected type size. The back shows the full ordered actions. Existing Monster legendary prose remains available.

The shared canvas layout applies to the preview, PNG, and PDF. A face that exceeds its safe area reports overflow and blocks export. Continuations remain explicit and keep the structured combat block on the first card. If that block alone is too large, shorten it or distribute it across cards manually.

## Backups and samples

Schema v4 adds optional attack and legendary data. Versions 1–3 remain importable using the same browser storage key. The migration retains existing IDs, fields, artwork, print settings, and queue. Import Merge still skips matching IDs.

The [nine-card combat library](../output/libraries/combat-v0.2.4.json) and [A4 duplex proof](../output/pdf/combat-v0.2.4.pdf) include a melee monster, a mixed-damage monster, a legendary monster, combat and noncombat NPCs, damaging and utility spells, a weapon, and a save-based trap. The monster stat blocks and trap are homebrew. The published spell and item examples use original summaries of 2024 rules. The Flame Tongue example includes an illustrative wielder modifier. [D&D Beyond spell descriptions](https://www.dndbeyond.com/sources/dnd/br-2024/spell-descriptions) · [Flame Tongue](https://www.dndbeyond.com/magic-items/9228647-flame-tongue) · [2024 legendary actions](https://www.dndbeyond.com/sources/dnd/br-2024/how-to-use-a-monster#LegendaryActions)

## Verification

- The production build and all 70 automated tests passed. Coverage includes prior libraries, exact formulas, mixed damage, action order and costs, empty sections, typography and overflow, and nine-up geometry.
- Chromium at 320 px verified offline attack and component editing, exact formula retention, legendary duplication and reordering, NPC combat fields, JSON restore, and sample Merge.
- The production app exported both PDF pages offline. All 18 faces were visually inspected. The A4 pages retain the original 63 × 88 mm placement, and the backs mirror the corresponding fronts for long-edge duplex.
- The Ash Hound PNG matched the decoded image embedded in the PDF pixel for pixel. Physical printer alignment and iPhone Safari remain unverified.
