import {
  type Card,
  type Artwork,
  type Side,
  type Field,
  decorative,
  fieldsFor,
  fieldValue,
  itemChoices,
  itemFieldEnabled,
  itemCustomNameFields,
  npcCombatKeys,
  templates,
  visibleFields,
} from "./model";
import {
  attackText,
  damageLines,
  legendaryBody,
  legendaryName,
  legendaryRules,
} from "./combat";
import {
  abilities,
  abilityDisplay,
  challengeDisplay,
  creatureFrontKeys,
  movementStats,
  movementDisplay,
  primaryStats,
} from "./creature";
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
  bodySize: number;
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

// A layout unit is 0.1 mm on the printed face.
const units = (points: number) => (points * 254) / 72;
const presets = {
  small: { prose: 9, metadata: 24 },
  medium: { prose: 11, metadata: 26 },
  large: { prose: 13, metadata: 29 },
};

function preferredProseSize(characters: number) {
  if (characters < 150) return 13;
  if (characters <= 300) return 12;
  if (characters <= 500) return 11;
  if (characters <= 750) return 10;
  return 9;
}

type TextField = Field & {
  value: string;
  display?: "section" | "attack" | "indicator" | "detail";
};
const combatField = (
  label: string,
  value = "",
  display?: TextField["display"],
): TextField => ({ key: "", label, value, multiline: true, display });

export function cardTextFields(card: Card, side: Side): TextField[] {
  const fields: TextField[] = visibleFields(card, side).map((field) => ({
    ...field,
    value: fieldValue(card, field.key),
  }));
  const legendary = card.legendaryActions?.enabled
    ? card.legendaryActions
    : undefined;
  const legendaryLabel = legendary?.uses?.trim()
    ? `Legendary actions: ${legendary.uses.trim()}`
    : "Legendary actions";
  if (side === "front") {
    const attacks = (card.attacks ?? []).flatMap((attack) => {
      const formulas = damageLines(attack.damage);
      const name = attackText(attack);
      return name || formulas.length
        ? [combatField(name, formulas.join("\n"), "attack")]
        : [];
    });
    const structuredDamage = attacks.some((attack) => attack.value);
    const dice =
      card.type === "item"
        ? fields.find((field) => field.key === "damageDice")
        : undefined;
    const damageType = dice
      ? fields.find((field) => field.key === "damageType")
      : undefined;
    const primary =
      (structuredDamage && card.type === "item") || dice
        ? fields.filter(
            (field) => field.key !== "damageDice" && field.key !== "damageType",
          )
        : fields;
    if (!structuredDamage && dice)
      attacks.unshift(
        combatField(
          "",
          [dice.value, damageType?.value].filter(Boolean).join(" "),
          "attack",
        ),
      );
    const summary = attacks.length
      ? [
          combatField(
            card.type === "spell" ? "Damage" : "Attacks & damage",
            "",
            "section",
          ),
          ...attacks,
        ]
      : [];
    if (legendary) summary.push(combatField(legendaryLabel, "", "indicator"));
    return card.miniStatBlock?.enabled
      ? [...summary, ...primary]
      : [...primary, ...summary];
  }

  const details: TextField[] = [];
  if (legendary) {
    const rules = legendaryRules(legendary);
    const actions = legendary.actions.flatMap((action) => {
      const body = legendaryBody(action);
      return action.name.trim() || action.cost?.trim() || body
        ? [combatField(legendaryName(action), body)]
        : [];
    });
    if (rules || actions.length) {
      details.push(combatField(legendaryLabel, "", "section"));
      if (rules) details.push(combatField("Rules", rules));
      details.push(...actions);
      const legacy = fields.find((field) => field.key === "legendary");
      if (legacy) legacy.label = "Legacy legendary notes";
    }
  }
  const notes = (card.attacks ?? []).flatMap((attack) =>
    attack.effects?.trim()
      ? [combatField(attack.name.trim() || "Attack", attack.effects)]
      : [],
  );
  if (notes.length)
    details.push(combatField("Attack notes", "", "section"), ...notes);
  const hasNpcSections =
    card.type === "npc" && fields.some((field) => npcCombatKeys.has(field.key));
  if (card.type === "monster" && details.length) {
    const index = fields.findIndex(
      (field) => field.key === "spellcasting" || field.key === "tactics",
    );
    fields.splice(index === -1 ? fields.length : index, 0, ...details);
  } else if (card.type === "npc" && (details.length || hasNpcSections)) {
    const primary = fields.filter((field) => npcCombatKeys.has(field.key));
    const additional = fields.filter((field) => !npcCombatKeys.has(field.key));
    fields.splice(0, fields.length, ...primary, ...details, ...additional);
  } else {
    fields.push(...details);
  }
  if (card.backNotes.trim())
    fields.push({
      key: "",
      label:
        (card.type === "monster" || card.type === "npc") &&
        (details.length || hasNpcSections)
          ? "Additional notes"
          : "DM notes",
      multiline: true,
      value: card.backNotes,
    });
  return fields;
}

type StatCell = { label: string; value: string; modifier?: string };

export function creatureFront(card: Card) {
  if (!card.miniStatBlock?.enabled) return undefined;
  const read = (key: string) =>
    card.placement[key] === "back" ? "" : fieldValue(card, key).trim();
  const { cr, xp } = challengeDisplay(read("challenge"));
  const classification = [
    read("size"),
    read("creature"),
    read("alignment"),
    cr && `CR ${cr}`,
  ]
    .filter(Boolean)
    .join(" · ");
  const { speed, movement } = movementDisplay(read("speed"));
  const primary: StatCell[] = primaryStats.map(([key, label]) => ({
    label: label.toUpperCase(),
    value: key === "speed" ? speed : read(key),
  }));
  const scores: StatCell[] = abilities.map(([key]) => {
    const override =
      card.placement[key] === "back"
        ? undefined
        : card.miniStatBlock?.modifiers?.[key];
    const { score, modifier } = abilityDisplay(read(key), override);
    return { label: key.toUpperCase(), value: score, modifier };
  });
  const details = [
    read("hitDice") && `Hit Dice ${read("hitDice")}`,
    (read("xp") || xp) && `XP ${(read("xp") || xp).replace(/\s+XP$/i, "")}`,
    read("proficiency") && `PB ${read("proficiency")}`,
    ...movementStats.map(([key, label]) => {
      const value =
        card.placement[key] === "back" && fieldValue(card, key).trim()
          ? ""
          : read(key) || movement[key];
      return value ? `${label} ${value}` : "";
    }),
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    classification,
    details,
    primary: primary.some((cell) => cell.value) ? primary : [],
    scores: scores.some((cell) => cell.value || cell.modifier) ? scores : [],
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
      bodySize: 0,
    };

  const fields = cardTextFields(card, side);
  const legendaryNames =
    side === "front" && card.legendaryActions?.enabled
      ? card.legendaryActions.actions
          .filter((action) => action.name.trim())
          .map(legendaryName)
          .join(" · ")
      : "";
  const layoutAt = (body: number, metadata: number) => {
    const base = contentLayout(
      card,
      safe,
      measure,
      side,
      fields,
      body,
      metadata,
    );
    if (base.overflow || !legendaryNames) return base;
    const detailed = contentLayout(
      card,
      safe,
      measure,
      side,
      [...fields, combatField("", legendaryNames, "detail")],
      body,
      metadata,
    );
    return detailed.overflow ? base : detailed;
  };

  const prose =
    side === "back" ||
    fields.some((field) => field.multiline && !field.display);
  const size = card.textSize ?? "auto";
  if (size !== "auto") {
    const preset = presets[size];
    return layoutAt(
      prose ? units(preset.prose) : preset.metadata,
      preset.metadata,
    );
  }
  const characters = fields.reduce(
    (total, field) => total + field.value.trim().length,
    0,
  );
  const preferred = prose ? preferredProseSize(characters) : 28;
  const minimum = prose ? 7.5 : 22;
  const step = prose ? 0.5 : 1;
  let layout: Layout;
  for (let size = preferred; size >= minimum; size -= step) {
    const bodySize = prose ? units(size) : size;
    const metadata = prose
      ? Math.max(22, Math.min(28, 22 + (size - 8) * 2))
      : size;
    layout = layoutAt(bodySize, metadata);
    if (!layout.overflow) return layout;
  }
  return layout!;
}

function contentLayout(
  card: Card,
  safe: number,
  measure: Measure,
  side: Side,
  visible: TextField[],
  bodySize: number,
  metadataSize: number,
): Layout {
  const scale = Math.min(1, metadataSize / 25);
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
    card.type === "custom"
      ? (card.cardTypeLabel ?? "").trim().toUpperCase()
      : (side === "back" ? "REVERSE  /  " : "") +
        templates[card.type].label.toUpperCase();
  let y = top;
  if (header) {
    for (const line of wrap(header, width, 16, measure, true)) {
      text(line, pad, y, 16, "#52412e", true);
      y += 20;
    }
    y += 6;
  }
  const statBlock = side === "front" ? creatureFront(card) : undefined;
  const combat = !!statBlock && card.miniStatBlock?.layout === "combat";
  const titleSize = side === "front" ? 38 * scale : Math.min(45, bodySize + 4);
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
  if (statBlock?.classification) {
    for (const line of wrap(
      statBlock.classification,
      width,
      metadataSize,
      measure,
    )) {
      text(line, pad, y, metadataSize, "#514538");
      y += metadataSize * 1.18;
    }
  }
  if (side === "front" && card.subtitle) {
    y += 3;
    for (const line of wrap(card.subtitle, width, 20 * scale, measure)) {
      text(line, pad, y, 20 * scale, "#514538");
      y += 25 * scale;
    }
  }
  y += side === "front" ? 10 : 6;
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
  y += side === "front" ? 11 : 8;
  if (card.artwork?.side === side) {
    const h = Math.round(
      (card.frame === "plain" ? 196 : 148) * scale * (combat ? 0.6 : 1),
    );
    ops.push({ kind: "artwork", art: card.artwork, x: pad, y, w: width, h });
    y += h + 12;
  }

  const labelSize = Math.max(15, 17 * scale);
  if (statBlock) {
    const drawRow = (cells: StatCell[]) => {
      if (!cells.length) return;
      const gap = 6;
      const columnWidth = (width - gap * (cells.length - 1)) / cells.length;
      let end = y;
      cells.forEach((cell, index) => {
        const left = pad + index * (columnWidth + gap);
        const centered = (
          line: string,
          lineY: number,
          size: number,
          bold = false,
        ) =>
          text(
            line,
            left + (columnWidth - measure(line, size, bold)) / 2,
            lineY,
            size,
            bold ? "#60482e" : "#25232a",
            bold,
          );
        centered(cell.label, y, labelSize, true);
        let lineY = y + labelSize * 1.22;
        for (const value of [cell.value || "—", cell.modifier].filter(
          Boolean,
        )) {
          for (const line of wrap(value!, columnWidth, metadataSize, measure)) {
            centered(line, lineY, metadataSize);
            lineY += metadataSize * 1.16;
          }
        }
        end = Math.max(end, lineY);
      });
      y = end + 9;
    };
    drawRow(statBlock.primary);
    drawRow(statBlock.scores);
    if (statBlock.details) {
      for (const line of wrap(
        statBlock.details,
        width,
        metadataSize,
        measure,
      )) {
        text(line, pad, y, metadataSize, "#514538");
        y += metadataSize * 1.18;
      }
      y += 6;
    }
  }
  const leading = side === "back" && bodySize < units(9) ? 1.12 : 1.18;
  for (let index = 0; index < visible.length;) {
    const field = visible[index],
      next = visible[index + 1];
    if (field.display) {
      const section =
        field.display === "section" || field.display === "indicator";
      const headerSize =
        field.display === "indicator" ? 22 : section ? 17 : labelSize;
      if (section && index > 0) y += 3;
      if (field.label)
        for (const line of wrap(
          section ? field.label.toUpperCase() : field.label,
          width,
          headerSize,
          measure,
          true,
        )) {
          text(line, pad, y, headerSize, "#60482e", true);
          y += headerSize * 1.25;
        }
      if (field.value) {
        const damageSize =
          field.display === "attack" ? metadataSize + (combat ? 7 : 5) : 21;
        const bold = field.display === "attack";
        for (const line of wrap(
          field.value,
          width,
          damageSize,
          measure,
          bold,
        )) {
          text(line, pad, y, damageSize, "#25232a", bold);
          y += damageSize * 1.18;
        }
      }
      y += field.display === "attack" ? 6 : 2;
      index++;
      continue;
    }
    const pair =
      !field.multiline &&
      next &&
      !next.multiline &&
      !!field.cue === !!next.cue &&
      !(
        side === "back" &&
        card.miniStatBlock?.enabled &&
        [field, next].some((item) =>
          item.value
            .split(/\s+/)
            .some((word) => measure(word, bodySize) > (width - 14) / 2 - 12),
        )
      );
    const row = pair ? [field, next] : [field];
    const colWidth = pair ? (width - 14) / 2 : width;
    let rowHeight = 0;
    for (const [column, item] of row.entries()) {
      const left = pad + column * (colWidth + 14);
      const gutter = side === "back" && item.multiline ? 0 : 6;
      const labelLines = wrap(
        item.label.toUpperCase(),
        colWidth - gutter * 2,
        labelSize,
        measure,
        true,
      );
      const valueSize =
        side === "front" && !item.multiline ? metadataSize : bodySize;
      const lines = item.value
        ? wrap(item.value, colWidth - gutter * 2, valueSize, measure)
        : [];
      const labelStep = labelSize * 1.22,
        lineHeight = (line: string) => valueSize * (line ? leading : 0.45);
      const height =
        labelLines.length * labelStep +
        lines.reduce((sum, line) => sum + lineHeight(line), 0) +
        9;
      rowHeight = Math.max(rowHeight, height);
      if (item.cue) rect(left, y - 2, colWidth, height - 3, "#e7ede7", 3);
      let baseline = y;
      for (const label of labelLines) {
        text(
          label,
          left + gutter,
          baseline,
          labelSize,
          item.cue ? "#365b4b" : "#60482e",
          true,
        );
        baseline += labelStep;
      }
      for (const line of lines) {
        if (line) text(line, left + gutter, baseline, valueSize);
        baseline += lineHeight(line);
      }
    }
    index += row.length;
    y += rowHeight - (index === visible.length ? 9 : 0);
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
  return { ops: visibleOps, overflow, used: y, limit, bodySize };
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
  // Keep item selectors intact so continuation cards retain category context.
  const fixed =
    card.type === "item"
      ? Object.fromEntries(
          Object.entries(card.fields).filter(
            ([key]) =>
              Object.hasOwn(itemChoices, key) || itemCustomNameFields.has(key),
          ),
        )
      : {};
  const splittable = fieldsFor(card).filter(
    (field) =>
      !(
        card.miniStatBlock?.enabled !== undefined &&
        creatureFrontKeys.has(field.key) &&
        card.placement[field.key] !== "back"
      ) &&
      (card.type !== "item" ||
        (!Object.hasOwn(fixed, field.key) &&
          itemFieldEnabled(card, field.key))),
  );
  const keys = new Set(splittable.map((field) => field.key));
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
      fields: { ...fixed },
      backNotes: "",
      artwork: undefined,
      attacks: undefined,
      legendaryActions: undefined,
      miniStatBlock: undefined,
    };
  };
  if (!fits(current))
    throw new Error(
      card.attacks?.length ||
        card.legendaryActions?.enabled ||
        card.miniStatBlock?.enabled
        ? "The heading, tags, stats, or combat sections fill a face. Shorten them before creating continuations."
        : "The heading or tags fill the card. Shorten them before creating continuations.",
    );
  const chunks = splittable.map((field) => ({
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
