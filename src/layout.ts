import {
  type Card,
  type Artwork,
  type Side,
  decorative,
  fieldsFor,
  templates,
  visibleFields,
} from "./model";
export const CARD_W = 630,
  CARD_H = 880,
  PNG_W = 744,
  PNG_H = 1039;
export type Measure = (
  text: string,
  size: number,
  bold?: boolean,
  serif?: boolean,
) => number;
export type Draw =
  | { kind: "frame"; name: string }
  | {
      kind: "artwork";
      art: Artwork;
      x: number;
      y: number;
      w: number;
      h: number;
    }
  | {
      kind: "text";
      text: string;
      x: number;
      y: number;
      size: number;
      bold?: boolean;
      serif?: boolean;
      color: string;
    }
  | {
      kind: "rect";
      x: number;
      y: number;
      w: number;
      h: number;
      color: string;
      radius?: number;
    };
export type Layout = {
  ops: Draw[];
  overflow: boolean;
  used: number;
  limit: number;
};
export function wrap(
  text: string,
  width: number,
  size: number,
  measure: Measure,
  bold = false,
  serif = false,
): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (!paragraph) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (measure(next, size, bold, serif) <= width) {
        line = next;
        continue;
      }
      if (line) {
        lines.push(line);
        line = "";
      }
      // Split an unbroken URL/word by code point rather than allowing horizontal overflow.
      for (const ch of word) {
        if (line && measure(line + ch, size, bold, serif) > width) {
          lines.push(line);
          line = "";
        }
        line += ch;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}
export function textColor(hex: string): string {
  const rgb = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722 > 0.179
    ? "#171f2b"
    : "#ffffff";
}
const insets: Record<Card["frame"], [number, number, number]> = {
  plain: [0, 0, 0],
  dragon: [80, 154, 104],
  sword: [88, 268, 94],
  arcane: [92, 169, 100],
  wings: [88, 211, 108],
};
const papers = { parchment: "#faf6ec", ivory: "#fffaf0", dusk: "#dedde8" };

export function safeBounds(card: Card, safe: number) {
  const [horizontal, top, bottom] = insets[card.frame];
  return {
    pad: Math.max(safe * 10, horizontal),
    top: Math.max(safe * 10, top),
    bottom: Math.max(safe * 10, bottom),
  };
}

export function cardLayout(
  card: Card,
  safe: number,
  measure: Measure,
  side: Side = "front",
): Layout {
  if (side === "back" && decorative(card))
    return {
      ops: [{ kind: "frame", name: "back" }],
      overflow: false,
      used: 0,
      limit: CARD_H,
    };
  let layout: Layout;
  // Step down deterministically to a 22-unit (6.24 pt) body before requiring continuation.
  for (const scale of [1, 0.94, 0.88]) {
    layout = contentLayout(card, safe, measure, side, scale);
    if (!layout.overflow) return layout;
  }
  return layout!;
}

function contentLayout(
  card: Card,
  safe: number,
  measure: Measure,
  side: Side,
  scale: number,
): Layout {
  const ops: Draw[] = [];
  const { pad, top, bottom } = safeBounds(card, safe);
  const width = CARD_W - pad * 2;
  const limit = CARD_H - bottom - (card.frame === "plain" ? 27 : 0);
  const rect = (
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    radius = 0,
  ) => ops.push({ kind: "rect", x, y, w, h, color, radius });
  const text = (
    value: string,
    x: number,
    y: number,
    size: number,
    color = "#25232a",
    bold = false,
    serif = false,
  ) => ops.push({ kind: "text", text: value, x, y, size, color, bold, serif });

  if (card.frame === "plain") {
    rect(0, 0, CARD_W, CARD_H, papers[card.theme]);
    rect(0, 0, CARD_W, 10, templates[card.type].color);
  } else {
    ops.push({ kind: "frame", name: card.frame });
    if (card.theme !== "parchment")
      rect(
        pad - 8,
        top - 6,
        width + 16,
        limit - top + 12,
        card.theme === "dusk" ? "#dedde8d9" : "#fffaf0d9",
        12,
      );
  }
  const header =
    side === "front"
      ? templates[card.type].label.toUpperCase()
      : "REVERSE  /  " + templates[card.type].label.toUpperCase();
  text(header, pad, top, 16, "#52412e", true);
  let y = top + 26;
  const titleSize = (side === "front" ? 38 : 30) * scale;
  for (const line of wrap(
    card.title || "Untitled card",
    width,
    titleSize,
    measure,
    true,
    true,
  )) {
    text(line, pad, y, titleSize, "#241e24", true, true);
    y += titleSize * 1.2;
  }
  if (side === "front" && card.subtitle) {
    y += 3;
    for (const line of wrap(card.subtitle, width, 20 * scale, measure)) {
      text(line, pad, y, 20 * scale, "#514538");
      y += 25 * scale;
    }
  }
  y += 10;
  const tagSize = 20 * scale;
  let x = pad,
    tagHeight = 0;
  for (const tag of side === "front" ? card.tags : []) {
    const value = [tag.symbol, tag.label || "Tag"].filter(Boolean).join(" ");
    const lines = wrap(value, width - 24, tagSize, measure, true);
    const w =
      Math.max(...lines.map((line) => measure(line, tagSize, true))) + 24;
    const h = lines.length * (tagSize + 4) + 8;
    if (x + w > CARD_W - pad + 0.001 && x > pad) {
      x = pad;
      y += tagHeight + 6;
      tagHeight = 0;
    }
    rect(x, y, w, h, tag.color, 6);
    lines.forEach((line, index) =>
      text(
        line,
        x + 12,
        y + 4 + index * (tagSize + 4),
        tagSize,
        textColor(tag.color),
        true,
      ),
    );
    tagHeight = Math.max(tagHeight, h);
    x += w + 8;
  }
  if (tagHeight) y += tagHeight + 10;
  rect(pad, y, width, 1, "#8a7155");
  y += 11;
  if (card.artwork?.side === side) {
    const h = Math.round((card.frame === "plain" ? 196 : 148) * scale);
    ops.push({ kind: "artwork", art: card.artwork, x: pad, y, w: width, h });
    y += h + 12;
  }

  const visible = visibleFields(card, side);
  if (side === "back" && card.backNotes.trim())
    visible.push({ key: "", label: "DM notes", multiline: true });
  const bodySize = 25 * scale,
    labelSize = Math.max(15, 17 * scale);
  for (let index = 0; index < visible.length;) {
    const field = visible[index],
      next = visible[index + 1];
    const pair =
      !field.multiline && next && !next.multiline && !!field.cue === !!next.cue;
    const row = pair ? [field, next] : [field];
    const colWidth = pair ? (width - 14) / 2 : width;
    let rowHeight = 0;
    for (const [column, item] of row.entries()) {
      const left = pad + column * (colWidth + 14);
      const labelLines = wrap(
        item.label.toUpperCase(),
        colWidth - 12,
        labelSize,
        measure,
        true,
      );
      const value = item.key ? card.fields[item.key] : card.backNotes;
      const lines = wrap(value, colWidth - 12, bodySize, measure);
      const labelStep = labelSize * 1.22,
        bodyStep = bodySize * 1.25;
      const height =
        labelLines.length * labelStep + lines.length * bodyStep + 9;
      rowHeight = Math.max(rowHeight, height);
      if (item.cue) rect(left, y - 2, colWidth, height - 3, "#e7ede7", 3);
      let baseline = y;
      for (const label of labelLines) {
        text(
          label,
          left + 6,
          baseline,
          labelSize,
          item.cue ? "#365b4b" : "#60482e",
          true,
        );
        baseline += labelStep;
      }
      for (const line of lines) {
        text(line, left + 6, baseline, bodySize);
        baseline += bodyStep;
      }
    }
    y += rowHeight;
    index += row.length;
  }
  const overflow = y > limit;
  // Leave out whole lines or blocks that would cross the safe area in preview.
  const visibleOps = overflow
    ? ops.filter((op) => {
        if (op.kind === "frame") return true;
        if (op.kind === "rect" && op.x === 0 && op.y === 0) return true;
        return op.y + (op.kind === "text" ? op.size * 1.2 : op.h) <= limit;
      })
    : ops;
  if (card.frame === "plain") {
    text(
      card.demo
        ? "FICTIONAL DEMO  ·  CARDFORGE"
        : "CARDFORGE  ·  TABLETOP REFERENCE",
      pad,
      CARD_H - bottom - 16,
      12,
      "#665a4c",
    );
    if (overflow) visibleOps.push(ops.at(-1)!);
  }
  return { ops: visibleOps, overflow, used: y, limit };
}

export function font(size: number, bold = false, serif = false) {
  return `${bold ? 700 : 400} ${size}px ${serif ? "Cinzel, Lora, Georgia, serif" : "Inter, sans-serif"}`;
}
export function canvasMeasure(ctx: CanvasRenderingContext2D): Measure {
  return (text, size, bold, serif) => {
    ctx.font = font(size, bold, serif);
    return ctx.measureText(text).width;
  };
}
export function paint(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  width = PNG_W,
  height = PNG_H,
  images: { frame?: CanvasImageSource; artwork?: HTMLImageElement } = {},
) {
  ctx.save();
  ctx.scale(width / CARD_W, height / CARD_H);
  ctx.textBaseline = "top";
  ctx.beginPath();
  ctx.rect(0, 0, CARD_W, CARD_H);
  ctx.clip();
  for (const op of layout.ops) {
    if (op.kind === "frame") {
      ctx.fillStyle = "#161413";
      ctx.fillRect(0, 0, CARD_W, CARD_H);
      const source = images.frame as HTMLImageElement | undefined;
      if (source) {
        const scale = Math.min(CARD_W / source.width, CARD_H / source.height);
        const w = source.width * scale,
          h = source.height * scale;
        ctx.drawImage(source, (CARD_W - w) / 2, (CARD_H - h) / 2, w, h);
      }
    } else if (op.kind === "artwork") {
      const source = images.artwork;
      if (!source) continue;
      const scale =
        Math.max(op.w / source.width, op.h / source.height) * op.art.zoom;
      const w = source.width * scale,
        h = source.height * scale;
      ctx.save();
      ctx.beginPath();
      ctx.rect(op.x, op.y, op.w, op.h);
      ctx.clip();
      ctx.drawImage(
        source,
        op.x - ((w - op.w) * op.art.x) / 100,
        op.y - ((h - op.h) * op.art.y) / 100,
        w,
        h,
      );
      ctx.restore();
    } else if (op.kind === "rect") {
      ctx.fillStyle = op.color;
      ctx.beginPath();
      ctx.roundRect(op.x, op.y, op.w, op.h, op.radius || 0);
      ctx.fill();
    } else {
      ctx.fillStyle = op.color;
      ctx.font = font(op.size, op.bold, op.serif);
      ctx.fillText(op.text, op.x, op.y);
    }
  }
  ctx.restore();
}
export function sheetGeometry(gap: number) {
  if (!Number.isFinite(gap) || gap < 0 || gap > 6)
    throw new Error("Gap must be between 0 and 6 mm.");
  const left = (210 - 3 * 63 - 2 * gap) / 2,
    top = (297 - 3 * 88 - 2 * gap) / 2;
  return {
    left,
    top,
    slots: Array.from({ length: 9 }, (_, i) => ({
      x: left + (i % 3) * (63 + gap),
      y: top + Math.floor(i / 3) * (88 + gap),
      width: 63,
      height: 88,
    })),
  };
}
export function paginate<T>(items: T[]): (T | null)[][] {
  return Array.from({ length: Math.ceil(items.length / 9) }, (_, p) =>
    Array.from({ length: 9 }, (_, s) => items[p * 9 + s] ?? null),
  );
}
// Greedily place text in schema order, binary-searching a fitting prefix when a field spans cards.
export function continuations(
  card: Card,
  safe: number,
  measure: Measure,
  makeId: () => string,
): Card[] {
  const fits = (c: Card) =>
    !cardLayout(c, safe, measure).overflow &&
    !cardLayout(c, safe, measure, "back").overflow;
  if (fits(card)) return [card];
  const result: Card[] = [];
  const keys = new Set(fieldsFor(card).map((field) => field.key));
  const unrendered = Object.fromEntries(
    Object.entries(card.fields).filter(([key]) => !keys.has(key)),
  );
  let current: Card = { ...card, fields: unrendered, backNotes: "" };
  let hasContent = false;
  const finish = () => {
    result.push(current);
    hasContent = false;
    current = {
      ...card,
      id: makeId(),
      title: `${card.title.slice(0, 95) || "Untitled"} · ${result.length + 1}`,
      fields: {},
      backNotes: "",
      artwork: undefined,
    };
  };
  if (!fits(current))
    throw new Error(
      "The heading or tags fill the card. Shorten them before creating continuations.",
    );
  const chunks = fieldsFor(card).map((field) => ({
    value: card.fields[field.key] ?? "",
    put: (c: Card, value: string) => ({
      ...c,
      fields: { ...c.fields, [field.key]: value },
    }),
  }));
  chunks.push({
    value: card.backNotes,
    put: (c, value) => ({ ...c, backNotes: value }),
  });
  for (const { value, put } of chunks) {
    let remaining = value;
    while (remaining) {
      const candidate = put(current, remaining);
      if (fits(candidate)) {
        current = candidate;
        hasContent = true;
        break;
      }
      const characters = Array.from(remaining);
      let low = 0;
      let high = characters.length;
      while (low < high) {
        const mid = Math.ceil((low + high) / 2);
        const test = put(current, characters.slice(0, mid).join(""));
        if (!fits(test)) high = mid - 1;
        else low = mid;
      }
      low = characters.slice(0, low).join("").length;
      // Prefer a word boundary, preserving every character across the split.
      let cut = low;
      const space = remaining.lastIndexOf(" ", low - 1);
      if (space > low * 0.6) cut = space + 1;
      if (cut === 0) {
        if (!hasContent)
          throw new Error(
            "This heading leaves no room for content. Shorten it first.",
          );
        finish();
        continue;
      }
      current = put(current, remaining.slice(0, cut));
      remaining = remaining.slice(cut);
      finish();
      if (result.length > 100)
        throw new Error(
          "Too many continuation cards. Split the source text into smaller entries.",
        );
    }
  }
  if (hasContent) result.push(current);
  return result;
}
