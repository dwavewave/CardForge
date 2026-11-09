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
  continuations,
  paint,
  paginate,
  PNG_W,
  PNG_H,
  sheetGeometry,
  wrap,
  textColor,
} from "./layout";
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
    version: 2,
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
