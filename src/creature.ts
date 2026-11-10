export const abilities = [
  ["str", "Strength"],
  ["dex", "Dexterity"],
  ["con", "Constitution"],
  ["int", "Intelligence"],
  ["wis", "Wisdom"],
  ["cha", "Charisma"],
] as const;
export type Ability = (typeof abilities)[number][0];

export type MiniStatBlock = {
  enabled?: boolean;
  layout: "standard" | "combat";
  modifiers?: Partial<Record<Ability, string>>;
};

export const creatureIdentity = [
  ["size", "Size"],
  ["creature", "Creature type"],
  ["alignment", "Alignment"],
  ["challenge", "Challenge Rating"],
  ["xp", "Experience points"],
  ["proficiency", "Proficiency bonus"],
] as const;
export const primaryStats = [
  ["ac", "AC"],
  ["hp", "HP"],
  ["speed", "Speed"],
  ["initiative", "Init"],
] as const;
export const movementStats = [
  ["flying", "Fly"],
  ["swimming", "Swim"],
  ["climbing", "Climb"],
  ["burrowing", "Burrow"],
  ["hovering", "Hover"],
] as const;
export const creatureDefences = [
  ["saves", "Saving throws"],
  ["skills", "Skills"],
  ["resistances", "Resistances"],
  ["immunities", "Immunities"],
  ["vulnerabilities", "Vulnerabilities"],
  ["conditionImmunities", "Condition immunities"],
  ["senses", "Senses"],
  ["languages", "Languages"],
] as const;
export const creatureBackKeys = new Set<string>(
  creatureDefences.map(([key]) => key),
);
export const creatureFrontKeys = new Set<string>(
  [
    ...creatureIdentity,
    ...primaryStats,
    ...movementStats,
    ...abilities,
    ["hitDice", "Hit Dice"],
  ].map(([key]) => key),
);

export function abilityDisplay(value: string, override?: string) {
  const input = value.trim();
  const parsed = /^([+-]?\d+)(?:\s*\(\s*([+-−]?\d+)\s*\)|\s+([+−-]\d+))?$/.exec(
    input,
  );
  const number = parsed ? Number(parsed[1]) : NaN;
  const automatic = Number.isSafeInteger(number)
    ? Math.floor((number - 10) / 2)
    : undefined;
  return {
    score: parsed?.[1] ?? input,
    modifier:
      override?.trim() ||
      parsed?.[2] ||
      parsed?.[3] ||
      (automatic === undefined
        ? ""
        : `${automatic >= 0 ? "+" : ""}${automatic}`),
  };
}

export function challengeDisplay(value: string) {
  // A spaced slash separates legacy CR and XP. The slash in fractional CR is retained.
  const combined = /^(.+?)\s+\/\s+(.+)$/.exec(value);
  return {
    cr: (combined?.[1] ?? value).trim(),
    xp: (combined?.[2] ?? "").trim(),
  };
}

export function movementDisplay(value: string) {
  const parts = value
    .split(/,\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const movement: Record<string, string> = {};
  const speed = parts
    .filter((part) => {
      const match =
        /^(fly(?:ing)?|swim(?:ming)?|climb(?:ing)?|burrow(?:ing)?|hover(?:ing)?)\s+(.+)$/i.exec(
          part,
        );
      if (!match) return true;
      const mode = movementStats.find(([, label]) =>
        match[1].toLowerCase().startsWith(label.toLowerCase()),
      );
      if (!mode || movement[mode[0]]) return true;
      movement[mode[0]] = match[2];
      return false;
    })
    .join(", ");
  return { speed, movement };
}

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

export function validMiniStatBlock(value: unknown): value is MiniStatBlock {
  return (
    record(value) &&
    (value.enabled === undefined || typeof value.enabled === "boolean") &&
    (value.layout === "standard" || value.layout === "combat") &&
    (value.modifiers === undefined ||
      (record(value.modifiers) &&
        Object.entries(value.modifiers).every(
          ([key, modifier]) =>
            abilities.some(([ability]) => ability === key) &&
            typeof modifier === "string" &&
            modifier.length <= 20_000,
        )))
  );
}
