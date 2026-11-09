# Codex implementation prompt — CardForge v0.1

You are working in this repository. Build a usable, polished, local-first web application named **CardForge** for creating printable tabletop reference cards.

## Reference inspection FIRST
Inspect `/Users/david-jonathandebeer/Documents/projects/RollWithAdvantage` (if present), focusing on interactive Cassian cards, `RWATagChip`, `RWASpellActionCardView`, `CardInspiredDesign`, tag data models, and related visual components. These identifiers are search hints, not guaranteed filenames. Do not edit the reference repository. Summarize what actually exists in `docs/REFERENCE_AUDIT.md`, with paths and reusable design/behavior insights. If inaccessible, explicitly record that and proceed with a documented approximation. Do not claim to have inspected it if you haven't.

## Product workflow
1. Choose a template: Spell, NPC RP, Plot Point, or Custom.
2. Enter title, optional subtitle, configurable color-coded tag chips, and template-specific fields.
3. See a responsive live preview representing the **actual printable card**.
4. Save cards locally, edit, duplicate, delete, and choose cards for a print queue.
5. Arrange selected cards in 3 columns × 3 rows on A4 portrait; generate a print-ready PDF with accurate dimensions, safe margins, and optional crop marks. If fewer than nine, leave empty slots. For more, paginate.
6. Export a single card to PNG, and import/export the library as versioned JSON.

## Physical specification
- A4 portrait 210 × 297 mm.
- Card size 63 × 88 mm, portrait; 3 × 3 grid (189 × 264 mm total card footprint).
- Center grid with 10.5 mm left/right and 16.5 mm top/bottom margins **before gaps**. For practical trimming, allow configurable inter-card gap (default 2 mm), and recompute margins: horizontal (210 - 3×63 - 2×2)/2 = 8.5 mm; vertical (297 - 3×88 - 2×2)/2 = 14.5 mm. Ensure no overflow.
- PDF uses real millimeter geometry and embedded/available fonts where practical; no browser print scaling assumptions. Include a 20 mm calibration line and an unobtrusive instruction to print at 100% / actual size, outside the card area if possible. Optional crop marks must not overlap card content.
- PNG export at 300 DPI equivalent (~744 × 1039 px for 63 × 88 mm), preserving visual parity with PDF.
- Provide an adjustable content safe area of at least 3 mm from card edges. Handle long text by showing an overflow warning and offering continuation cards, not microscopic unreadable text.
- Single-sided printing first; double-sided is explicitly out of scope.

## Templates
**Spell**: name, level, school, casting time, range, components, duration, concentration, ritual, description, higher-level effects, tags.
**NPC RP**: name, role/species, voice pitch, tempo, accent, verbal tic, mannerisms, disposition, motivation, wants from party, knows, conceals, opening line, last interaction, tags. Put performance cues near top.
**Plot Point**: title, kind, location, trigger, setup, revelation, clues, involved NPCs, possible consequences, status, tags. Do not implement a branching narrative graph.
**Custom**: title, subtitle, freeform field list, tags.
Use a schema-driven field renderer; avoid separate hardcoded UI for every card type. Keep tags independent of fields and allow users to add, edit, reorder, recolor, and remove them. Use a tasteful high-contrast, print-friendly theme inspired by the actual reference audit.

## Engineering guidance
- Choose a practical modern TypeScript frontend stack (Vite + React is acceptable). No server, accounts, paid APIs, or cloud dependencies.
- Persist to IndexedDB or localStorage with schema version and migration-friendly serialization; validate imported JSON and avoid executing user content.
- Prefer one canonical card layout representation for preview, PNG, and PDF. If renderers differ, add automated visual/dimensional parity tests.
- Accessible form controls, keyboard-friendly editing, responsive UI including mobile. Clear print overflow indicators.
- Dependencies should be minimal and documented; keep all assets local after installation.
- Add sample cards clearly marked as fictional/demo content; don't reproduce copyrighted official D&D spell descriptions by default.
- Include test scripts for serialization, 9-up pagination, dimensions, and overflow handling. Run build/tests and report results.

## Implementation sequence
1. Audit reference project; write findings.
2. Scaffold app, types, templates, and storage.
3. Implement card editor and tag chip system.
4. Implement live card preview and overflow detection.
5. Implement card library, queue, 9-up print layout, PDF and PNG exports.
6. Add tests, demo cards, documentation, and polish.

## Definition of done
Follow `docs/ACCEPTANCE.md`. Update README with exact install/run/build/test commands and known limitations. Work autonomously on reasonable decisions; document assumptions. Avoid unnecessary features and do not modify RollWithAdvantage.
