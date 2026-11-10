import {
  type Attack,
  type LegendaryActions,
  hasCombatBack,
  validAttacks,
  validLegendary,
} from "./combat";

import {
  abilities,
  primaryStats,
  movementStats,
  creatureDefences,
  creatureBackKeys,
  creatureFrontKeys,
  validMiniStatBlock,
  type MiniStatBlock,
} from "./creature";

export const VERSION = 5;
export type Kind = "spell" | "npc" | "plot" | "custom" | "monster" | "item";
export type Field = {
  key: string;
  label: string;
  multiline?: boolean;
  cue?: boolean;
  toggle?: boolean;
};
export const frames = {
  plain: "Classic",
  dragon: "Dragon",
  sword: "Sword",
  arcane: "Arcane",
  wings: "Wings",
} as const;
export const themes = {
  parchment: "Parchment",
  ivory: "Ivory",
  dusk: "Dusk",
} as const;
export const textSizes = ["auto", "small", "medium", "large"] as const;
export type TextSize = (typeof textSizes)[number];
export type Side = "front" | "back";
export type Flip = "single" | "long" | "short";
export type PrintOptions = {
  flip: Flip;
  x: number;
  y: number;
  guides: boolean;
};
export const MAX_CARDS = 500;
export const defaultPrint: PrintOptions = {
  flip: "single",
  x: 0,
  y: 0,
  guides: false,
};
export const tagSymbols = ["", "✦", "✚", "◆", "▲", "●", "⚑", "☾"];
export type Artwork = {
  src: string;
  side: Side;
  x: number;
  y: number;
  zoom: number;
};
export type Tag = { id: string; label: string; color: string; symbol?: string };
export type Card = {
  id: string;
  type: Kind;
  title: string;
  cardTypeLabel?: string;
  subtitle: string;
  fields: Record<string, string>;
  customFields: Field[];
  tags: Tag[];
  demo: boolean;
  frame: keyof typeof frames;
  theme: keyof typeof themes;
  textSize?: TextSize;
  reverse: "auto" | "decorative" | "info";
  placement: Record<string, Side>;
  backNotes: string;
  artwork?: Artwork;
  collection: string;
  attacks?: Attack[];
  legendaryActions?: LegendaryActions;
  miniStatBlock?: MiniStatBlock;
};
export type Library = {
  version: typeof VERSION;
  print: PrintOptions;
  printers: { name: string; x: number; y: number }[];
  cards: Card[];
  queue: string[];
  gap: number;
  safe: number;
  crop: boolean;
};
const f = (
  key: string,
  label: string,
  multiline = false,
  cue = false,
  toggle = false,
): Field => ({ key, label, multiline, cue, toggle });
export const MAX_CARD_TYPE_LABEL = 30;
export const itemChoices: Readonly<Record<string, readonly string[]>> = {
  category: [
    "Weapon",
    "Armour",
    "Shield",
    "Wondrous Item",
    "Potion",
    "Scroll",
    "Ring",
    "Rod",
    "Staff",
    "Wand",
    "Ammunition",
    "Adventuring Gear",
    "Other",
    "Custom",
  ],
  rarity: [
    "Common",
    "Uncommon",
    "Rare",
    "Very Rare",
    "Legendary",
    "Artifact",
    "Custom",
  ],
  attunement: ["Not required", "Required", "Restricted", "Custom"],
  magic: ["Magical", "Nonmagical"],
};

const customItemNames: Readonly<Record<string, string>> = {
  category: "categoryName",
  rarity: "rarityName",
};
export const itemCustomNameFields = new Set(Object.values(customItemNames));

export const itemFieldGroups = {
  "Item identification": [
    f("category", "Item category"),
    f("categoryName", "Custom category name"),
    f("rarity", "Rarity"),
    f("rarityName", "Custom rarity"),
    f("attunement", "Attunement"),
    f("attunementRestriction", "Attunement restriction"),
    f("magic", "Magic"),
    f("value", "Value"),
    f("weight", "Weight"),
  ],
  "Equipment details": [
    f("damageDice", "Damage dice"),
    f("damageType", "Damage type"),
    f("weaponProperties", "Weapon properties"),
    f("armourClass", "Armour Class"),
    f("armourCategory", "Armour category"),
    f("charges", "Charges"),
    f("uses", "Uses / Recharge"),
  ],
  "Back details": [
    f("description", "Description", true),
    f("properties", "Properties", true),
    f("effects", "Magical effects", true),
    f("activation", "Activation requirements", true),
    f("recharge", "Charges and recharge conditions", true),
    f("limitations", "Limitations", true),
    f("curse", "Curse", true),
    f("lore", "Lore / flavour text", true),
  ],
};

const weaponDetails = new Set(["damageDice", "damageType", "weaponProperties"]);
const armourDetails = new Set(["armourClass", "armourCategory"]);

export function itemFieldEnabled(card: Card, key: string) {
  const { category, rarity, attunement } = card.fields;
  if (key === "categoryName") return category === "Custom";
  if (key === "rarityName") return rarity === "Custom";
  if (key === "attunementRestriction")
    return attunement === "Restricted" || attunement === "Custom";
  if (!category || category === "Other" || category === "Custom") return true;
  if (weaponDetails.has(key))
    return ["Weapon", "Ammunition", "Staff"].includes(category);
  if (armourDetails.has(key))
    return category === "Armour" || category === "Shield";
  return true;
}

export function fieldValue(card: Card, key: string) {
  const value = Object.hasOwn(card.fields, key) ? card.fields[key] : "";
  if (
    card.type === "item" &&
    value === "Custom" &&
    Object.hasOwn(customItemNames, key)
  )
    return card.fields[customItemNames[key]] ?? "";
  return value;
}

export const creatureStatFields = [
  f("creature", "Creature type"),
  f("size", "Size"),
  f("alignment", "Alignment"),
  f("challenge", "CR / XP"),
  f("xp", "Experience points"),
  f("proficiency", "Proficiency bonus"),
  ...primaryStats.map(([key, label]) =>
    f(key, key === "initiative" ? "Initiative modifier" : label),
  ),
  f("hitDice", "Hit Dice"),
  ...movementStats.map(([key, label]) => f(key, label)),
  ...abilities.map(([key]) => f(key, key.toUpperCase())),
  ...creatureDefences.map(([key, label]) => f(key, label)),
];
export const creatureStatKeys = new Set(
  creatureStatFields.map((field) => field.key),
);

export const npcCombatFields = [
  f("traits", "Traits", true),
  f("actions", "Actions", true),
  f("bonusActions", "Bonus actions", true),
  f("reactions", "Reactions", true),
];
export const npcCombatKeys = new Set([
  ...creatureStatKeys,
  ...npcCombatFields.map((field) => field.key),
]);

export const templates: Record<
  Kind,
  {
    label: string;
    icon: string;
    color: string;
    description: string;
    fields: Field[];
  }
> = {
  spell: {
    label: "Spell",
    icon: "✦",
    color: "#5a638c",
    description: "Magic, mechanics & effects",
    fields: [
      f("level", "Level"),
      f("school", "School"),
      f("casting", "Casting time"),
      f("range", "Range"),
      f("components", "Components"),
      f("duration", "Duration"),
      f("concentration", "Concentration", false, false, true),
      f("ritual", "Ritual", false, false, true),
      f("description", "Description", true),
      f("higher", "At higher levels", true),
    ],
  },
  npc: {
    label: "NPC RP",
    icon: "♙",
    color: "#427766",
    description: "A character at your fingertips",
    fields: [
      f("role", "Role / species"),
      f("pitch", "Voice pitch", false, true),
      f("tempo", "Tempo", false, true),
      f("accent", "Accent", false, true),
      f("tic", "Verbal tic", false, true),
      f("mannerisms", "Mannerisms", true, true),
      f("disposition", "Disposition"),
      f("motivation", "Motivation", true),
      f("wants", "Wants from party", true),
      f("knows", "Knows", true),
      f("conceals", "Conceals", true),
      f("opening", "Opening line", true),
      f("last", "Last interaction", true),
      ...creatureStatFields,
      ...npcCombatFields,
    ],
  },
  plot: {
    label: "Plot Point",
    icon: "◇",
    color: "#a16b3e",
    description: "Threads worth following",
    fields: [
      f("kind", "Kind"),
      f("location", "Location"),
      f("trigger", "Trigger", true),
      f("setup", "Setup", true),
      f("revelation", "Revelation", true),
      f("clues", "Clues", true),
      f("npcs", "Involved NPCs", true),
      f("consequences", "Possible consequences", true),
      f("status", "Status"),
    ],
  },
  monster: {
    label: "Monster",
    icon: "♜",
    color: "#8c473f",
    description: "Creature statistics and encounter notes",
    fields: [
      ...creatureStatFields,
      f("traits", "Traits", true),
      f("actions", "Actions", true),
      f("bonusActions", "Bonus actions", true),
      f("reactions", "Reactions", true),
      f("legendary", "Legendary actions", true),
      f("spellcasting", "Spellcasting", true),
      f("tactics", "Tactics", true),
    ],
  },
  item: {
    label: "Item",
    icon: "◆",
    color: "#8a692d",
    description: "Equipment, magic items and homebrew",
    fields: Object.values(itemFieldGroups).flat(),
  },
  custom: {
    label: "Custom",
    icon: "▤",
    color: "#657380",
    description: "Your table. Your format.",
    fields: [],
  },
};
export const fieldsFor = (card: Card) =>
  card.type === "custom" ? card.customFields : templates[card.type].fields;
export const fieldSide = (card: Card, field: Field): Side =>
  Object.hasOwn(card.placement, field.key)
    ? card.placement[field.key]
    : ((card.type === "monster" || card.type === "npc") &&
          (field.key === "conditionImmunities" ||
            (card.miniStatBlock?.enabled &&
              creatureBackKeys.has(field.key)))) ||
        (field.multiline && !field.cue)
      ? "back"
      : "front";
export const visibleFields = (card: Card, side: Side) =>
  fieldsFor(card).filter(
    (field) =>
      fieldSide(card, field) === side &&
      !(
        side === "front" &&
        card.miniStatBlock?.enabled !== undefined &&
        creatureFrontKeys.has(field.key)
      ) &&
      (card.type !== "item" ||
        (!itemCustomNameFields.has(field.key) &&
          itemFieldEnabled(card, field.key))) &&
      !!fieldValue(card, field.key).trim() &&
      (!field.toggle || card.fields[field.key] === "Yes"),
  );
export const decorative = (card: Card) =>
  card.reverse === "decorative" ||
  (card.reverse === "auto" &&
    !card.backNotes.trim() &&
    card.artwork?.side !== "back" &&
    !visibleFields(card, "back").length &&
    !hasCombatBack(card.attacks, card.legendaryActions));
export const uid = () => crypto.randomUUID();
export function newCard(type: Kind): Card {
  return {
    id: uid(),
    type,
    title: "",
    subtitle: "",
    fields: {},
    customFields: type === "custom" ? [f("notes", "Notes", true)] : [],
    tags: [],
    demo: false,
    frame: type === "item" ? "arcane" : "dragon",
    ...(type === "monster"
      ? { miniStatBlock: { enabled: true, layout: "standard" } }
      : {}),
    theme: "parchment",
    reverse: "auto",
    placement: {},
    backNotes: "",
    collection: "",
  };
}
export const palette = [
  "#354868",
  "#426d48",
  "#a3473e",
  "#356c8c",
  "#79527d",
  "#8a692d",
  "#386e70",
  "#62666c",
];
export function demoLibrary(): Library {
  const spell = newCard("spell");
  Object.assign(spell, {
    title: "Lantern of the Lost",
    subtitle: "A little light for the long way home",
    demo: true,
    fields: {
      level: "1",
      school: "Wayfinding",
      casting: "1 action",
      range: "30 feet",
      components: "V, S, a firefly jar",
      duration: "10 minutes",
      description:
        "A warm mote of light drifts ahead of you, tracing the safest visible path through fog or darkness. It pauses at hidden drops and unstable ground.\n\nThe lantern offers direction, never certainty.",
      higher: "For each extra level, guide one additional traveler.",
    },
    tags: [
      { id: uid(), label: "Utility", color: palette[3] },
      { id: uid(), label: "Light", color: palette[5] },
    ],
  });
  const npc = newCard("npc");
  Object.assign(npc, {
    title: "Mara Quill",
    subtitle: "Keeper of the midnight archive",
    demo: true,
    fields: {
      role: "Human archivist",
      pitch: "Low & warm",
      tempo: "Slow, deliberate",
      accent: "Soft coastal lilt",
      tic: "“Between the lines…”",
      mannerisms: "Smooths the corners of every page.",
      disposition: "Curious, quietly guarded",
      motivation: "Recover a book that remembers its readers.",
      opening: "“You look like a story I have read before.”",
    },
    tags: [
      { id: uid(), label: "Ally", color: palette[1] },
      { id: uid(), label: "Archive", color: palette[7] },
    ],
  });
  const plot = newCard("plot");
  Object.assign(plot, {
    title: "The Bell Below",
    subtitle: "Something stirs beneath the harbor",
    demo: true,
    fields: {
      kind: "Mystery",
      location: "Old harbor",
      trigger: "The submerged bell rings at low tide.",
      setup:
        "Fishing boats return with empty nets and silver dust on their decks.",
      revelation: "A forgotten workshop is waking under the water.",
      clues: "Wet footprints lead uphill. The bell has no clapper.",
      status: "Unresolved",
    },
    tags: [{ id: uid(), label: "Discovery", color: palette[5] }],
  });
  return {
    version: VERSION,
    print: { ...defaultPrint },
    printers: [],
    cards: [spell, npc, plot],
    queue: [],
    gap: 2,
    safe: 3,
    crop: true,
  };
}
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
function str(v: unknown, max = 20000): v is string {
  return typeof v === "string" && v.length <= max;
}
export function parseLibrary(raw: string): Library {
  if (new TextEncoder().encode(raw).byteLength > MAX_BACKUP)
    throw new Error("Backup exceeds the 15 MB limit.");
  const data: unknown = JSON.parse(raw);
  if (
    !record(data) ||
    (data.version !== 1 &&
      data.version !== 2 &&
      data.version !== 3 &&
      data.version !== 4 &&
      data.version !== VERSION) ||
    !Array.isArray(data.cards) ||
    data.cards.length > MAX_CARDS ||
    !Array.isArray(data.queue)
  )
    throw new Error(
      "Expected a CardForge version 1, 2, 3, 4, or 5 library (up to 500 cards).",
    );
  const legacy = data.version === 1;
  const cards: Card[] = [];
  const ids = new Set<string>();
  for (const c of data.cards) {
    if (
      !record(c) ||
      !str(c.id, 100) ||
      !c.id ||
      ids.has(c.id) ||
      typeof c.type !== "string" ||
      !Object.hasOwn(templates, c.type) ||
      (legacy && c.type === "monster") ||
      ((data.version === 1 || data.version === 2) && c.type === "item") ||
      !str(c.title, 120) ||
      (c.type === "item" && !c.title.trim()) ||
      (c.type === "custom" &&
        c.cardTypeLabel !== undefined &&
        !str(c.cardTypeLabel, MAX_CARD_TYPE_LABEL)) ||
      !str(c.subtitle, 180) ||
      typeof c.demo !== "boolean" ||
      !record(c.fields) ||
      Object.keys(c.fields).length > 60 ||
      !Object.entries(c.fields).every(
        ([k, v]) =>
          str(k, 100) &&
          !["__proto__", "constructor", "prototype"].includes(k) &&
          str(v),
      ) ||
      !Array.isArray(c.customFields) ||
      c.customFields.length > 40 ||
      !Array.isArray(c.tags) ||
      c.tags.length > 20
    )
      throw new Error("Invalid card data in backup.");
    if (
      c.type === "item" &&
      Object.entries(itemChoices).some(([key, options]) => {
        const value = (c.fields as Record<string, string>)[key];
        return value !== undefined && value !== "" && !options.includes(value);
      })
    )
      throw new Error("Invalid item identification in backup.");
    const keys = new Set<string>();
    for (const field of c.customFields) {
      if (
        !record(field) ||
        !str(field.key, 100) ||
        !field.key ||
        keys.has(field.key) ||
        !str(field.label, 60) ||
        ["__proto__", "constructor", "prototype"].includes(field.key) ||
        ["multiline", "cue", "toggle"].some(
          (k) => field[k] !== undefined && typeof field[k] !== "boolean",
        )
      )
        throw new Error("Invalid custom field.");
      keys.add(field.key);
    }
    const tags = new Set<string>();
    for (const t of c.tags) {
      if (
        !record(t) ||
        !str(t.id, 100) ||
        tags.has(t.id) ||
        !str(t.label, 28) ||
        typeof t.color !== "string" ||
        !/^#[0-9a-f]{6}$/i.test(t.color) ||
        (!legacy &&
          t.symbol !== undefined &&
          (typeof t.symbol !== "string" || !tagSymbols.includes(t.symbol)))
      )
        throw new Error("Invalid tag data.");
      tags.add(t.id);
    }
    const attacks = c.attacks;
    const legendaryActions = c.legendaryActions;
    if (attacks !== undefined && (c.type === "plot" || !validAttacks(attacks)))
      throw new Error("Invalid attacks in backup.");
    if (
      legendaryActions !== undefined &&
      ((c.type !== "monster" && c.type !== "npc") ||
        !validLegendary(legendaryActions))
    )
      throw new Error("Invalid legendary actions in backup.");
    const miniStatBlock = c.miniStatBlock;
    if (
      miniStatBlock !== undefined &&
      ((c.type !== "monster" && c.type !== "npc") ||
        !validMiniStatBlock(miniStatBlock))
    )
      throw new Error("Invalid mini stat block in backup.");
    const base = {
      id: c.id,
      type: c.type as Kind,
      title: c.title,
      ...(c.type === "custom" && typeof c.cardTypeLabel === "string"
        ? { cardTypeLabel: c.cardTypeLabel }
        : {}),
      subtitle: c.subtitle,
      fields: c.fields as Card["fields"],
      customFields: c.customFields as Field[],
      tags: (c.tags as Tag[]).map(({ id, label, color, symbol }) =>
        legacy || symbol === undefined
          ? { id, label, color }
          : { id, label, color, symbol },
      ),
      demo: c.demo,
      ...(attacks === undefined ? {} : { attacks }),
      ...(miniStatBlock === undefined ? {} : { miniStatBlock }),
      ...(legendaryActions === undefined ? {} : { legendaryActions }),
    };
    if (legacy) {
      cards.push({
        ...base,
        frame: "plain",
        theme: "parchment",
        reverse: "auto",
        backNotes: "",
        collection: "",
        placement: Object.fromEntries(
          fieldsFor(base as Card)
            .filter(
              (field) => base.type !== "npc" || !npcCombatKeys.has(field.key),
            )
            .map((field) => [field.key, "front"]),
        ),
      });
    } else {
      if (
        typeof c.frame !== "string" ||
        !Object.hasOwn(frames, c.frame) ||
        typeof c.theme !== "string" ||
        !Object.hasOwn(themes, c.theme) ||
        (c.textSize !== undefined &&
          !textSizes.includes(c.textSize as TextSize)) ||
        (c.reverse !== "auto" &&
          c.reverse !== "decorative" &&
          c.reverse !== "info") ||
        !str(c.backNotes) ||
        !str(c.collection, 60) ||
        !record(c.placement) ||
        !Object.entries(c.placement).every(
          ([key, side]) =>
            fieldsFor(base as Card).some((field) => field.key === key) &&
            (side === "front" || side === "back"),
        ) ||
        (c.artwork !== undefined && !validArtwork(c.artwork))
      )
        throw new Error("Invalid card appearance or placement.");
      cards.push({
        ...base,
        frame: c.frame as Card["frame"],
        theme: c.theme as Card["theme"],
        ...(c.textSize === undefined
          ? {}
          : { textSize: c.textSize as TextSize }),
        reverse: c.reverse,
        placement: c.placement as Card["placement"],
        backNotes: c.backNotes,
        collection: c.collection,
        ...(c.artwork === undefined ? {} : { artwork: c.artwork }),
      });
    }
    ids.add(c.id);
  }
  if (
    data.queue.length > MAX_CARDS ||
    !data.queue.every((id) => typeof id === "string" && ids.has(id)) ||
    new Set(data.queue).size !== data.queue.length
  )
    throw new Error("Invalid print queue.");
  if (
    typeof data.gap !== "number" ||
    !Number.isFinite(data.gap) ||
    data.gap < 0 ||
    data.gap > 6 ||
    typeof data.safe !== "number" ||
    !Number.isFinite(data.safe) ||
    data.safe < 3 ||
    data.safe > 6 ||
    typeof data.crop !== "boolean"
  )
    throw new Error("Invalid print settings.");
  const print = legacy ? defaultPrint : data.print;
  if (
    !record(print) ||
    (print.flip !== "single" &&
      print.flip !== "long" &&
      print.flip !== "short") ||
    !inRange(print.x, -4, 4) ||
    !inRange(print.y, -4, 4) ||
    typeof print.guides !== "boolean"
  )
    throw new Error("Invalid duplex settings.");
  const printers: unknown = legacy ? [] : data.printers;
  if (
    !Array.isArray(printers) ||
    printers.length > 20 ||
    !printers.every(
      (p) =>
        record(p) &&
        str(p.name, 40) &&
        p.name.trim() &&
        inRange(p.x, -4, 4) &&
        inRange(p.y, -4, 4),
    ) ||
    new Set(printers.map((p) => p.name)).size !== printers.length
  )
    throw new Error("Invalid printer profiles.");
  // Keep the existing storage key so v1 installs upgrade in place.
  return {
    version: VERSION,
    print: { flip: print.flip, x: print.x, y: print.y, guides: print.guides },
    printers: printers.map(({ name, x, y }) => ({ name, x, y })),
    cards,
    queue: data.queue as string[],
    gap: data.gap,
    safe: data.safe,
    crop: data.crop,
  };
}
const inRange = (value: unknown, low: number, high: number): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= low &&
  value <= high;
function validArtwork(value: unknown): value is Artwork {
  return (
    record(value) &&
    str(value.src, 300_000) &&
    /^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]+={0,2}$/.test(value.src) &&
    (value.side === "front" || value.side === "back") &&
    inRange(value.x, 0, 100) &&
    inRange(value.y, 0, 100) &&
    inRange(value.zoom, 1, 3)
  );
}
export function mergeLibraries(current: Library, incoming: Library) {
  const ids = new Set(current.cards.map((card) => card.id));
  const added = incoming.cards.filter((card) => !ids.has(card.id));
  if (current.cards.length + added.length > MAX_CARDS)
    throw new Error("Merge would exceed the 500-card library limit.");
  return {
    library: added.length
      ? { ...current, cards: [...current.cards, ...added] }
      : current,
    added: added.length,
    skipped: incoming.cards.length - added.length,
  };
}

export const MAX_BACKUP = 15_000_000;
export const serialize = (library: Library) => JSON.stringify(library);
export const STORAGE_KEY = "cardforge.library.v1";
