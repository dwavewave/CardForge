import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { readFileSync } from "node:fs";
import {
  PDFDocument,
  PDFName,
  PDFArray,
  PDFRawStream,
  decodePDFRawStream,
} from "pdf-lib";
import {
  demoLibrary,
  fieldsFor,
  newCard,
  VERSION,
  fieldValue,
  itemFieldEnabled,
  visibleFields,
  frames,
  MAX_CARDS,
  mergeLibraries,
  parseLibrary,
  serialize,
  type Library,
  defaultPrint,
  decorative,
  fieldSide,
} from "./model";
import {
  canvasMeasure,
  cardLayout,
  cardTextFields,
  safeBounds,
  CARD_W,
  continuations,
  paint,
  paginate,
  PNG_W,
  PNG_H,
  sheetGeometry,
  wrap,
  textColor,
} from "./layout";
import { formulaKind, damageLines } from "./combat";
import { createCalibrationPDF, createPDF, renderCard, mm } from "./export";
vi.mock("./art", async () => {
  const { loadImage } = await import("@napi-rs/canvas");
  return {
    loadFrame: (name: string) =>
      loadImage(readFileSync(`public/frames/${name}.png`)),
    loadImage,
  };
});
beforeAll(() => {
  for (const [file, name] of [
    ["inter/files/inter-latin-400-normal.woff2", "Inter"],
    ["inter/files/inter-latin-700-normal.woff2", "Inter"],
    ["lora/files/lora-latin-700-normal.woff2", "Lora"],
    ["cinzel/files/cinzel-latin-700-normal.woff2", "Cinzel"],
  ])
    GlobalFonts.register(
      readFileSync(`node_modules/@fontsource/${file}`),
      name,
    );
  vi.stubGlobal("document", {
    fonts: { load: async () => [], ready: Promise.resolve() },
    createElement: () => createCanvas(PNG_W, PNG_H),
  });
});
afterAll(() => vi.unstubAllGlobals());
const measure = () =>
  canvasMeasure(
    createCanvas(PNG_W, PNG_H).getContext(
      "2d",
    ) as unknown as CanvasRenderingContext2D,
  );
const paladin = () =>
  parseLibrary(
    readFileSync(
      new URL("../output/libraries/paladin-level-1-2024.json", import.meta.url),
      "utf8",
    ),
  );

describe("library merge", () => {
  it("preserves current cards, settings and queue, and skips repeated stable IDs", () => {
    const current = demoLibrary();
    current.queue = [current.cards[0].id];
    current.print = { flip: "short", x: 1.5, y: -0.5, guides: true };
    current.printers = [{ name: "Home", x: 1.5, y: -0.5 }];
    current.gap = 4;
    current.safe = 5;
    current.crop = false;
    const incoming = paladin();
    const first = mergeLibraries(current, incoming);
    expect(first).toEqual({
      library: { ...current, cards: [...current.cards, ...incoming.cards] },
      added: 16,
      skipped: 0,
    });
    const edited = {
      ...first.library,
      cards: first.library.cards.map((card) =>
        card.id === incoming.cards[0].id
          ? { ...card, title: "My Bless" }
          : card,
      ),
    };
    const repeat = mergeLibraries(edited, incoming);
    expect(repeat).toEqual({ library: edited, added: 0, skipped: 16 });
    expect(repeat.library).toBe(edited);
  });

  it("refuses a merge above the card limit without mutating the current library", () => {
    const current = {
      ...demoLibrary(),
      cards: Array.from({ length: MAX_CARDS }, () => newCard("spell")),
    };
    const incoming = paladin();
    expect(() => mergeLibraries(current, incoming)).toThrow(/500-card/);
    expect(current.cards).toHaveLength(MAX_CARDS);
    expect(mergeLibraries(current, { ...current, queue: [] }).skipped).toBe(
      MAX_CARDS,
    );
  });
});

describe("adaptive typography", () => {
  const points = (size: number) => (size * 72) / 254;

  it("fits both faces of the original Paladin deck and enlarges its short backs", () => {
    const library = paladin();
    expect(library.cards).toHaveLength(16);
    const m = measure();
    for (const card of library.cards) {
      expect(card.textSize).toBeUndefined();
      const bounds = safeBounds(card, library.safe);
      for (const side of ["front", "back"] as const) {
        const layout = cardLayout(card, library.safe, m, side);
        expect(layout.overflow, `${card.title} ${side}`).toBe(false);
        for (const op of layout.ops) {
          if (op.kind !== "text") continue;
          expect(op.x).toBeGreaterThanOrEqual(bounds.pad);
          expect(
            op.x + m(op.text, op.size, op.bold, op.serif),
          ).toBeLessThanOrEqual(CARD_W - bounds.pad + 0.01);
          expect(op.y).toBeGreaterThanOrEqual(bounds.top);
          expect(op.y + op.size).toBeLessThanOrEqual(layout.limit);
        }
        if (side === "back") {
          expect(points(layout.bodySize)).toBeGreaterThanOrEqual(7.5);
          if (
            [
              "Bless",
              "Divine Favor",
              "Shield of Faith",
              "Cure Wounds",
            ].includes(card.title)
          )
            expect(points(layout.bodySize)).toBeGreaterThanOrEqual(12);
        }
      }
    }
  });

  it("reduces the size when equal-length text wraps differently", () => {
    const card = { ...newCard("spell"), frame: "arcane" as const };
    const narrow = { ...card, fields: { description: "iiii ".repeat(50) } };
    const wide = { ...card, fields: { description: "MMMM ".repeat(50) } };
    const m = measure();
    const compact = cardLayout(narrow, 3, m, "back");
    const wrapped = cardLayout(wide, 3, m, "back");
    expect(compact.overflow).toBe(false);
    expect(wrapped.overflow).toBe(false);
    expect(compact.bodySize).toBeGreaterThan(wrapped.bodySize);
  });

  it("round-trips presets and warns rather than shrinking an overflowing manual selection", async () => {
    const library = paladin();
    const command = library.cards.find((card) => card.title === "Command")!;
    const m = measure();
    for (const [size, expected] of [
      ["small", 9],
      ["medium", 11],
      ["large", 13],
    ] as const) {
      command.textSize = size;
      const layout = cardLayout(command, library.safe, m, "back");
      expect(points(layout.bodySize)).toBeCloseTo(expected);
      expect(layout.overflow).toBe(true);
      expect(parseLibrary(serialize(library))).toEqual(library);
    }
    await expect(
      renderCard(command, library.safe, false, "back"),
    ).rejects.toThrow(/overflows/);
    command.textSize = "auto";
    expect(cardLayout(command, library.safe, m, "back").overflow).toBe(false);
    const invalid = serialize(library).replace(
      '"textSize":"auto"',
      '"textSize":"huge"',
    );
    expect(() => parseLibrary(invalid)).toThrow(/appearance/);
  });
});

describe("versioned library", () => {
  it("round-trips all templates, tags and queue without losing unicode or text", () => {
    const lib = demoLibrary();
    const c = newCard("custom");
    c.title = "Élan <script>not executed</script>";
    c.fields.notes = "A\nB";
    lib.cards.push(c);
    lib.queue = [c.id, lib.cards[0].id];
    expect(parseLibrary(serialize(lib))).toEqual(lib);
  });
  it.each([null, {}, { version: 2, cards: [], queue: [] }, "{broken"])(
    "rejects malformed or future schema %j",
    (data) => {
      expect(() =>
        parseLibrary(typeof data === "string" ? data : JSON.stringify(data)),
      ).toThrow();
    },
  );
  it("rejects invalid colors, IDs, queue references, settings, and prototype keys", () => {
    const changes: ((l: Library) => void)[] = [
      (l) => {
        l.cards[0].tags[0].color = "url(evil)";
      },
      (l) => {
        l.cards.push(l.cards[0]);
      },
      (l) => {
        l.queue = ["missing"];
      },
      (l) => {
        l.safe = 2;
      },
      (l) => {
        l.gap = 7;
      },
      (l) => {
        l.cards[0].fields = JSON.parse('{"__proto__":"bad"}');
      },
      (l) => {
        l.cards[0].customFields = [{ key: "constructor", label: "Oops" }];
      },
    ];
    for (const mutate of changes) {
      const lib = demoLibrary();
      mutate(lib);
      expect(() => parseLibrary(serialize(lib))).toThrow();
    }
  });
});
it("migrates all v1 fields to the front and preserves IDs, values, custom fields and print setup", () => {
  const c = newCard("custom");
  const legacy = {
    version: 1,
    gap: 3,
    safe: 5,
    crop: false,
    queue: [c.id],
    cards: [
      {
        id: c.id,
        type: c.type,
        title: "Before",
        subtitle: "Legacy",
        fields: { notes: "Both lines.\nStill here.", hiddenLegacy: "keep" },
        customFields: c.customFields,
        tags: [{ id: "tag", label: "History", color: "#354868" }],
        demo: false,
      },
    ],
  };
  const migrated = parseLibrary(JSON.stringify(legacy));
  expect(migrated).toMatchObject({
    version: VERSION,
    gap: 3,
    safe: 5,
    crop: false,
    queue: [c.id],
    print: defaultPrint,
    cards: [
      { ...legacy.cards[0], frame: "plain", placement: { notes: "front" } },
    ],
  });
  expect(decorative(migrated.cards[0])).toBe(true);
  expect(parseLibrary(serialize(migrated))).toEqual(migrated);
});

it("round-trips portable artwork and monster fields and rejects invalid placement or image URLs", () => {
  const library = demoLibrary();
  const monster = newCard("monster");
  monster.fields = { str: "17 (+3)", reactions: "Raise its guard" };
  monster.artwork = {
    src: createCanvas(4, 4).toDataURL("image/jpeg"),
    x: 30,
    y: 80,
    zoom: 2,
    side: "back",
  };
  library.cards.push(monster);
  expect(
    fieldSide(
      monster,
      fieldsFor(monster).find((f) => f.key === "str")!,
    ),
  ).toBe("front");
  expect(
    fieldSide(
      monster,
      fieldsFor(monster).find((f) => f.key === "reactions")!,
    ),
  ).toBe("back");
  expect(parseLibrary(serialize(library))).toEqual(library);
  monster.placement.misspelled = "back";
  expect(() => parseLibrary(serialize(library))).toThrow(/appearance/);
  delete monster.placement.misspelled;
  monster.artwork.src = "https://example.invalid/remote.png";
  expect(() => parseLibrary(serialize(library))).toThrow(/appearance/);
});

describe("Custom labels and Item cards", () => {
  const sampleLibrary = () =>
    parseLibrary(
      readFileSync(
        new URL(
          "../output/libraries/items-and-custom-v0.2.3.json",
          import.meta.url,
        ),
        "utf8",
      ),
    );

  it("migrates a v2 backup with IDs, settings, labels and fields intact", () => {
    const library = demoLibrary();
    const labelled = {
      ...newCard("custom"),
      title: "Map",
      cardTypeLabel: "Location",
      fields: { notes: "Two rivers." },
    };
    const unlabelled = {
      ...newCard("custom"),
      title: "Key",
      fields: { notes: "Opens the observatory." },
    };
    library.cards.push(labelled, unlabelled);
    library.queue = [labelled.id];
    library.gap = 4;
    const backup = { ...library, version: 2 };
    expect(parseLibrary(JSON.stringify(backup))).toEqual(library);
    expect(paladin().version).toBe(VERSION);
  });

  it("renders the Custom label in its category position or omits it on both faces", () => {
    const card = {
      ...newCard("custom"),
      title: "Glass Archive",
      reverse: "info" as const,
      cardTypeLabel: "Legendary Artefact",
    };
    const m = measure();
    const draw = (side: "front" | "back") =>
      cardLayout(card, 3, m, side).ops.filter((op) => op.kind === "text");
    for (const side of ["front", "back"] as const) {
      expect(draw(side)[0]).toMatchObject({
        text: "LEGENDARY ARTEFACT",
        size: 16,
      });
      expect(draw(side).map((op) => op.text)).not.toContain("CUSTOM");
    }
    card.cardTypeLabel = "   ";
    for (const side of ["front", "back"] as const) {
      expect(draw(side)[0]).toMatchObject({
        text: "Glass Archive",
        y: safeBounds(card, 3).top,
      });
    }
  });

  it("round-trips the example deck and fits both sides of all seven cards", () => {
    const library = sampleLibrary();
    expect(parseLibrary(serialize(library))).toEqual(library);
    expect(library.cards.filter((card) => card.type === "item")).toHaveLength(
      5,
    );
    expect(library.queue).toHaveLength(7);
    const m = measure();
    for (const card of library.cards)
      for (const side of ["front", "back"] as const) {
        expect(
          cardLayout(card, library.safe, m, side).overflow,
          `${card.title} ${side}`,
        ).toBe(false);
      }
    expect(mergeLibraries(demoLibrary(), library).added).toBe(7);
  });

  it("preserves hidden equipment and restriction values when the item category changes", () => {
    const card = newCard("item");
    expect(card).toMatchObject({ frame: "arcane", theme: "parchment" });
    card.title = "Shifting relic";
    card.fields = {
      category: "Weapon",
      damageDice: "1d8",
      armourClass: "18",
      rarity: "Custom",
      rarityName: "Relic grade",
      attunement: "Restricted",
      attunementRestriction: "Paladin",
    };
    const frontKeys = () =>
      visibleFields(card, "front").map((field) => field.key);
    expect(frontKeys()).toContain("damageDice");
    expect(frontKeys()).not.toContain("armourClass");
    expect(frontKeys()).toContain("attunementRestriction");
    expect(fieldValue(card, "rarity")).toBe("Relic grade");
    expect(frontKeys()).not.toContain("rarityName");
    card.fields.category = "Armour";
    card.fields.attunement = "Not required";
    expect(frontKeys()).toContain("armourClass");
    expect(frontKeys()).not.toContain("damageDice");
    expect(frontKeys()).not.toContain("attunementRestriction");
    expect(itemFieldEnabled(card, "damageDice")).toBe(false);
    card.fields.category = "Weapon";
    expect(fieldValue(card, "damageDice")).toBe("1d8");
    expect(frontKeys()).toContain("damageDice");
    expect(card.fields.attunementRestriction).toBe("Paladin");
    card.fields.category = "Custom";
    expect(frontKeys()).not.toContain("category");
    card.fields.categoryName = "Relic";
    expect(fieldValue(card, "category")).toBe("Relic");
    expect(frontKeys()).toContain("category");
    expect(frontKeys()).not.toContain("categoryName");
  });

  it("fits an Item on every existing frame and warns on overflowing prose", async () => {
    const card = newCard("item");
    card.title = "Gem";
    card.fields = {
      category: "Wondrous Item",
      description: "The gem glows in darkness.",
    };
    for (const frame of Object.keys(frames) as (keyof typeof frames)[]) {
      card.frame = frame;
      expect(cardLayout(card, 3, measure()).overflow).toBe(false);
      expect(cardLayout(card, 3, measure(), "back").overflow).toBe(false);
    }
    card.fields.description = "A thick tome. ".repeat(240);
    await expect(renderCard(card, 3, false, "back")).rejects.toThrow(
      /overflows/,
    );
  });

  it("keeps item selectors valid on continuations and preserves unprinted fields", () => {
    const card = newCard("item");
    card.title = "Changing Ward";
    card.fields = {
      category: "Custom",
      categoryName: "Runeforged",
      rarity: "Rare",
      attunement: "Not required",
      attunementRestriction: "Kept for later",
      description: "The sigil changes with the hour. ".repeat(100),
    };
    const pages = continuations(card, 3, measure(), () => crypto.randomUUID());
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.map((page) => page.fields.description ?? "").join("")).toBe(
      card.fields.description,
    );
    expect(pages[0].fields.attunementRestriction).toBe("Kept for later");
    expect(
      pages.every((page) => fieldValue(page, "category") === "Runeforged"),
    ).toBe(true);
    const library = { ...demoLibrary(), cards: pages };
    expect(parseLibrary(serialize(library))).toEqual(library);
  });

  it("rejects invalid Item names, choice values and Custom labels", async () => {
    const library = sampleLibrary();
    const [item] = library.cards;
    const custom = library.cards.find((card) => card.type === "custom")!;
    custom.cardTypeLabel = "x".repeat(31);
    expect(() => parseLibrary(serialize(library))).toThrow(/Invalid card/);
    custom.cardTypeLabel = "";
    item.fields.rarity = "Mythic";
    expect(() => parseLibrary(serialize(library))).toThrow(
      /Invalid item identification/,
    );
    item.fields.rarity = "Custom";
    item.title = "  ";
    expect(() => parseLibrary(serialize(library))).toThrow(/Invalid card/);
    await expect(renderCard(item, 3)).rejects.toThrow(/item name/);
  });
});

describe("structured combat", () => {
  const samples = () =>
    parseLibrary(
      readFileSync(
        new URL("../output/libraries/combat-v0.2.4.json", import.meta.url),
        "utf8",
      ),
    );

  it("recognizes dice and flat damage without rejecting free text or changing formulas", () => {
    for (const formula of ["1d6", "2d8 + 3", "4d10", "1d12 + 1d6", "2d6 + 5"])
      expect(formulaKind(formula)).toBe("Dice formula");
    expect(formulaKind("5")).toBe("Flat damage");
    expect(formulaKind("half the damage rolled")).toBe("Free-text formula");
    const library = samples();
    const damage = library.cards[0].attacks![0].damage[0];
    damage.formula = "  1D6  +  2  ";
    expect(
      parseLibrary(serialize(library)).cards[0].attacks![0].damage[0].formula,
    ).toBe(damage.formula);
    expect(
      damageLines([
        { id: "a", formula: "1d8 + 4", type: "Slashing" },
        { id: "b", formula: "2d6", type: "Fire" },
        { id: "c", formula: "+1d8 per higher slot", qualifier: "Upcast" },
      ]),
    ).toEqual(["1d8 + 4 Slashing + 2d6 Fire", "Upcast · +1d8 per higher slot"]);
  });

  it("round-trips all nine combat examples and fits both sides", () => {
    const library = samples();
    expect(library.cards).toHaveLength(9);
    expect(parseLibrary(serialize(library))).toEqual(library);
    const m = measure();
    for (const card of library.cards)
      for (const side of ["front", "back"] as const) {
        expect(
          cardLayout(card, library.safe, m, side).overflow,
          `${card.title} ${side}`,
        ).toBe(false);
      }
  });

  it("emphasizes formulas, shows both attack and save details, and omits empty blocks", () => {
    const library = samples();
    const drake = library.cards.find((card) => card.title === "Brass Drake")!;
    const m = measure();
    const ops = cardLayout(drake, library.safe, m).ops.filter(
      (op) => op.kind === "text",
    );
    expect(ops.map((op) => op.text).join(" ")).toContain(
      "1d8 + 4 Slashing + 2d6 Fire",
    );
    expect(ops.map((op) => op.text).join(" ")).toContain("+7 to hit");
    expect(ops.map((op) => op.text).join(" ")).toContain("DEX DC 15 save");
    const formula = ops.find((op) => op.text === "6d6 Fire")!;
    expect(formula.size).toBeGreaterThan(
      ops.find((op) => op.text === "16")!.size,
    );
    expect(formula.size).toBeLessThan(
      ops.find((op) => op.text === drake.title)!.size,
    );
    for (const title of ["Detect Magic", "The Mapkeeper"]) {
      const card = library.cards.find((card) => card.title === title)!;
      const blank = {
        ...card,
        attacks: [{ id: "blank", name: "", damage: [] }],
      };
      expect(cardLayout(blank, library.safe, m)).toEqual(
        cardLayout(card, library.safe, m),
      );
    }
  });

  it("orders legendary rules and actions on the back, with an indicator on the front", () => {
    const card = samples().cards.find(
      (card) => card.title === "Stormvault Wyrm",
    )!;
    card.fields = {
      ...card.fields,
      traits: "Watchful",
      actions: "Bite",
      bonusActions: "Run",
      reactions: "Duck",
      legendary: "Retained prose",
      tactics: "Look up",
    };
    card.backNotes = "Final note";
    const front = cardTextFields(card, "front");
    const back = cardTextFields(card, "back");
    expect(front.map((field) => field.label)).toContain("Legendary actions: 3");
    expect(front.map((field) => field.value).join(" ")).not.toContain(
      "Melee attack",
    );
    expect(back.map((field) => field.label)).toEqual([
      "Traits",
      "Actions",
      "Bonus actions",
      "Reactions",
      "Legacy legendary notes",
      "Legendary actions: 3",
      "Rules",
      "Tail Attack · Cost 1",
      "Wing Attack · Cost 2",
      "Arcane Pulse · Cost 3",
      "Tactics",
      "Additional notes",
    ]);
    expect(back.find((field) => field.label === "Rules")?.value).toContain(
      "Recovery · Start of its turn.",
    );
    expect(
      back.find((field) => field.label === "Wing Attack · Cost 2")?.value,
    ).toContain("DEX DC 17 save");
    card.legendaryActions!.enabled = false;
    expect(
      cardTextFields(card, "front").map((field) => field.label),
    ).not.toContain("Legendary actions: 3");
    expect(cardTextFields(card, "back").map((field) => field.value)).toContain(
      "Retained prose",
    );
    expect(card.legendaryActions!.actions).toHaveLength(3);
  });

  it("keeps v3 item and monster data and promotes existing weapon dice without rewriting fields", () => {
    const raw = JSON.parse(
      readFileSync(
        new URL(
          "../output/libraries/items-and-custom-v0.2.3.json",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const monster = {
      ...newCard("monster"),
      title: "Legacy creature",
      fields: { legendary: "After a turn, make a tail attack." },
    };
    raw.cards.push(monster);
    const library = parseLibrary(JSON.stringify(raw));
    expect(library).toEqual({ ...raw, version: VERSION });
    const longsword = library.cards[0];
    expect(
      cardTextFields(longsword, "front").some(
        (field) => field.value === "1d8 Slashing",
      ),
    ).toBe(true);
    expect(longsword.attacks).toBeUndefined();
    expect(library.cards.at(-1)?.fields.legendary).toBe(
      monster.fields.legendary,
    );
  });

  it("accepts many ordered actions and refuses overflow without truncating them", async () => {
    const library = samples();
    const card = library.cards.find(
      (card) => card.title === "Stormvault Wyrm",
    )!;
    card.legendaryActions!.actions = Array.from({ length: 42 }, (_, index) => ({
      id: `action-${index}`,
      name: `Action ${index}`,
      cost: String(index + 1),
      description: "Its full description remains available.",
      damage: [],
    }));
    const parsed = parseLibrary(serialize(library));
    expect(
      parsed.cards.find((entry) => entry.id === card.id)?.legendaryActions,
    ).toEqual(card.legendaryActions);
    expect(cardLayout(card, library.safe, measure(), "front").overflow).toBe(
      false,
    );
    await expect(renderCard(card, library.safe, false, "back")).rejects.toThrow(
      /overflows/,
    );
    expect(() =>
      continuations(card, library.safe, measure(), () => crypto.randomUUID()),
    ).toThrow(/combat sections/);
  });

  it("rejects duplicate nested IDs and invalid save abilities", () => {
    const library = samples();
    const attack = library.cards[0].attacks![0];
    attack.damage.push(attack.damage[0]);
    expect(() => parseLibrary(serialize(library))).toThrow(/Invalid attacks/);
    attack.damage.pop();
    Object.assign(attack, { save: { ability: "LUK", dc: "10" } });
    expect(() => parseLibrary(serialize(library))).toThrow(/Invalid attacks/);
  });
});

describe("physical geometry and pagination", () => {
  it.each([0, 1, 2, 3, 4, 5, 6])(
    "keeps every 63 × 88 slot on A4 at gap %s",
    (gap) => {
      const g = sheetGeometry(gap);
      expect(g.slots).toHaveLength(9);
      for (const s of g.slots) {
        expect(s.width).toBe(63);
        expect(s.height).toBe(88);
        expect(s.x).toBeGreaterThanOrEqual(0);
        expect(s.y).toBeGreaterThanOrEqual(0);
        expect(s.x + s.width).toBeLessThanOrEqual(210);
        expect(s.y + s.height).toBeLessThanOrEqual(297);
      }
      expect(g.slots[8].x + 63).toBe(210 - g.left);
      expect(g.slots[8].y + 88).toBe(297 - g.top);
    },
  );
  it("matches specified zero/default margins", () => {
    expect(sheetGeometry(0)).toMatchObject({ left: 10.5, top: 16.5 });
    expect(sheetGeometry(2)).toMatchObject({ left: 8.5, top: 14.5 });
    expect(() => sheetGeometry(NaN)).toThrow();
    expect(() => sheetGeometry(-1)).toThrow();
  });
  it.each([0, 1, 8, 9, 10, 18, 19])(
    "paginates %s cards with empty trailing slots",
    (n) => {
      const items = Array.from({ length: n }, (_, i) => i);
      const pages = paginate(items);
      expect(pages).toHaveLength(Math.ceil(n / 9));
      expect(pages.flat().filter((x) => x !== null)).toEqual(items);
      for (const p of pages) expect(p).toHaveLength(9);
    },
  );
  it("targets 300 DPI-equivalent pixel dimensions", () => {
    expect(PNG_W).toBe(Math.round((63 / 25.4) * 300));
    expect(PNG_H).toBe(Math.round((88 / 25.4) * 300));
  });
});
describe("readable layout and continuations", () => {
  it("fits each fictional demo at the default safe area", () => {
    for (const c of demoLibrary().cards)
      expect(cardLayout(c, 3, measure()).overflow, c.title).toBe(false);
  });
  it("places NPC performance cues above motivation", () => {
    const c = newCard("npc");
    c.fields = { pitch: "Low", motivation: "Find a map" };
    c.placement.motivation = "front";
    const ops = cardLayout(c, 3, measure()).ops.filter(
      (op) => op.kind === "text",
    );
    expect(ops.findIndex((o) => o.text === "Low")).toBeLessThan(
      ops.findIndex((o) => o.text === "Find a map"),
    );
  });
  it("wraps long unbroken input without horizontal spill", () => {
    const m = measure();
    const lines = wrap("W".repeat(400), 200, 21, m);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(m(line, 21)).toBeLessThanOrEqual(200);
    expect(lines.join("")).toBe("W".repeat(400));
  });
  it.each([3, 4, 6])(
    "preserves every field character on fitting continuation cards at %s mm",
    (safe) => {
      const c = newCard("spell");
      c.title = "An extended account";
      c.fields = {
        description: "At dawn the lantern flickered. ".repeat(90),
        higher: "W".repeat(400),
        concentration: "Yes",
      };
      const m = measure();
      expect(cardLayout(c, safe, m, "back").overflow).toBe(true);
      let i = 0;
      const result = continuations(c, safe, m, () => `cont-${++i}`);
      expect(result.length).toBeGreaterThan(1);
      expect(result[0].id).toBe(c.id);
      for (const part of result) {
        expect(cardLayout(part, safe, m).overflow).toBe(false);
        expect(cardLayout(part, safe, m, "back").overflow).toBe(false);
      }
      for (const f of fieldsFor(c))
        expect(result.map((p) => p.fields[f.key] || "").join("")).toBe(
          c.fields[f.key] || "",
        );
    },
  );
  it("refuses an oversized header instead of shrinking type", () => {
    const c = newCard("custom");
    c.title = "W".repeat(120);
    c.subtitle = "W".repeat(180);
    c.tags = Array.from({ length: 20 }, (_, i) => ({
      id: String(i),
      label: "W".repeat(28),
      color: "#111111",
    }));
    expect(() => continuations(c, 6, measure(), () => "")).toThrow(/heading/i);
  });
  it("chooses readable contrasting chip labels", () => {
    expect(textColor("#ffffff")).toBe("#171f2b");
    expect(textColor("#000000")).toBe("#ffffff");
  });
});
describe("actual export integration", () => {
  it("uses exactly the same pixels for preview and PNG", async () => {
    const c = { ...demoLibrary().cards[0], frame: "plain" as const };
    const { canvas, layout } = await renderCard(c, 3);
    const other = createCanvas(PNG_W, PNG_H);
    paint(
      other.getContext("2d") as unknown as CanvasRenderingContext2D,
      cardLayout(c, 3, measure()),
    );
    expect(canvas.width).toBe(744);
    expect(canvas.height).toBe(1039);
    expect(canvas.toDataURL()).toEqual(other.toDataURL());
    expect(layout.overflow).toBe(false);
  });
  it("blocks PNG/PDF export when any card overflows", async () => {
    const c = newCard("custom");
    c.fields.notes = "Long text ".repeat(2000);
    c.placement.notes = "front";
    await expect(renderCard(c, 3)).rejects.toThrow(/overflows/);
    await expect(createPDF([c], 2, 3, true)).rejects.toThrow(/overflows/);
    await expect(createPDF([], 2, 3, true)).rejects.toThrow(/queue/);
  });
  it("writes a two-page A4 PDF with 10 exact-size image placements and calibration lines", async () => {
    const source = { ...demoLibrary().cards[0], frame: "plain" as const };
    const bytes = await createPDF(
      Array.from({ length: 10 }, () => source),
      2,
      3,
      true,
    );
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(2);
    let placements = 0;
    for (const [index, page] of pdf.getPages().entries()) {
      expect(page.getWidth()).toBeCloseTo(mm(210), 8);
      expect(page.getHeight()).toBeCloseTo(mm(297), 8);
      const streams = page.node.Contents() as PDFArray;
      let content = "";
      for (let i = 0; i < streams.size(); i++) {
        const stream = pdf.context.lookup(streams.get(i)) as PDFRawStream;
        content += new TextDecoder().decode(
          decodePDFRawStream(stream).decode(),
        );
      }
      const matrices = [...content.matchAll(/([\d.]+) 0 0 ([\d.]+) 0 0 cm/g)];
      const cards = matrices.filter(
        (m) =>
          Math.abs(Number(m[1]) - mm(63)) < 0.001 &&
          Math.abs(Number(m[2]) - mm(88)) < 0.001,
      );
      expect(cards.length).toBe(index === 0 ? 9 : 1);
      placements += cards.length;
      // Calibration endpoints are 20 mm apart in the actual PDF content stream.
      expect(content).toContain(`${mm(9)} ${mm(6)} m`);
      expect(content).toContain(`${mm(29)} ${mm(6)} l`);
      const resources = page.node.Resources()!.lookup(PDFName.of("XObject"));
      expect(resources).toBeTruthy();
    }
    expect(placements).toBe(10);
  });
});

it("writes real duplex image placements, leaves empty backs blank and emits a two-page calibration PDF", async () => {
  const card = { ...newCard("monster"), frame: "plain" as const };
  for (const flip of ["long", "short"] as const) {
    const options = { ...defaultPrint, flip, x: 1, y: -0.5 };
    const pdf = await PDFDocument.load(
      await createPDF([card], 2, 3, false, options),
    );
    expect(pdf.getPageCount()).toBe(2);
    const page = pdf.getPage(1);
    const contents = page.node.Contents() as PDFArray;
    const stream = pdf.context.lookup(contents.get(0)) as PDFRawStream;
    const content = new TextDecoder().decode(
      decodePDFRawStream(stream).decode(),
    );
    const x = flip === "long" ? 138.5 : 8.5;
    const y = flip === "short" ? 194.5 : 14.5;
    expect(content).toContain(
      `1 0 0 1 ${mm(x + 1)} ${mm(297 - (y - 0.5) - 88)} cm`,
    );
    expect(content.match(/ Do/g)).toHaveLength(1);
    const calibration = await PDFDocument.load(
      await createCalibrationPDF(2, 3, true, options),
    );
    expect(calibration.getPageCount()).toBe(2);
  }
});

it("keeps both sides readable and preserves DM notes across continuations", async () => {
  const card = newCard("monster");
  card.fields.actions = "🗡 Sweep. ".repeat(160);
  card.backNotes = "Keep the exit visible. ".repeat(100);
  expect(cardLayout(card, 3, measure(), "back").overflow).toBe(true);
  await expect(
    createPDF([card], 2, 3, false, { ...defaultPrint, flip: "long" }),
  ).rejects.toThrow(/overflows on the back/);
  const pages = continuations(card, 3, measure(), () => crypto.randomUUID());
  expect(pages.map((page) => page.fields.actions ?? "").join("")).toBe(
    card.fields.actions,
  );
  expect(pages.map((page) => page.backNotes).join("")).toBe(card.backNotes);
  for (const page of pages) {
    expect(cardLayout(page, 3, measure(), "back").overflow).toBe(false);
  }
});
