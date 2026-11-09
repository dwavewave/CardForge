# RollWithAdvantage reference audit

Inspected read-only on 2026-11-08 at `/Users/david-jonathandebeer/Documents/projects/RollWithAdvantage`.

Actual inspected files (relative to that root):
- `ios/Sources/CassianCompanionApp/Views/Components/RWATagChip.swift`: compact/regular rounded chips, normalized readable labels, semantic tint families, white vector glyphs, accessibility labels. Action is navy, healing green, damage red, control blue, concentration violet. Tags can resolve labels from a taxonomy.
- `ios/Sources/CassianCompanionApp/Models/RWATagModels.swift`: Codable/Hashable definition containing category, label, symbol, fallback, priority; taxonomy is a string-keyed dictionary.
- `ios/Sources/CassianCompanionApp/Views/Components/RWASpellActionCardView.swift`: generic footer, compact/table/full densities, title/kind header, wrapping FlowLayout chip strip, parchment summary, availability warning and advised badge. Display tags are sorted by taxonomy priority then name and capped at four/six.
- `ios/Sources/CassianCompanionApp/Views/Components/CardInspiredDesign.swift` (first 220 lines): deep navy/violet shell, parchment/ink, aged and radiant gold; 18-point shell, 13-point inner, 8-point chips. Surface-specific text styles and contrast calculation support readable surfaces.
- `ios/Sources/CassianCompanionApp/Views/ActionsView.swift` (first 145 lines): grouped action cards; compact cards open detail sheets; context menus expose logging and roll presets; availability is passed into the shared card.

## CardForge adaptation

Use a navy studio, restrained gold accents, parchment card face, strong serif title and compact semantic chips. Keep performance cues above narrative details. Preserve chip order explicitly rather than sorting or capping user-authored tags. Show text labels so meaning does not rely on color or glyphs. Use one fixed-size canvas renderer for live preview, PNG, and PDF so wrapping and typography are identical. Avoid the reference's minimumScaleFactor/truncation on print: maintain readable text and offer continuation cards. Interactive action availability, recommendations, game state, dice, and character content are outside this print-authoring scope.

This was a source audit, not a running iOS UI inspection. No reference files were modified or copied; demo text is original fictional content.
