export const saveAbilities = [
  "STR",
  "DEX",
  "CON",
  "INT",
  "WIS",
  "CHA",
] as const;
export type Save = { ability?: (typeof saveAbilities)[number]; dc?: string };
export type Damage = {
  id: string;
  formula: string;
  type?: string;
  qualifier?: string;
};
export type Attack = {
  id: string;
  name: string;
  bonus?: string;
  save?: Save;
  damage: Damage[];
  effects?: string;
};
export type LegendaryAction = {
  id: string;
  name: string;
  cost?: string;
  description?: string;
  save?: Save;
  damage: Damage[];
  effects?: string;
};
export type LegendaryActions = {
  enabled: boolean;
  uses?: string;
  recovery?: string;
  activation?: string;
  intro?: string;
  actions: LegendaryAction[];
};

// Classification is guidance only. Free text is a valid formula and is stored verbatim.
export function formulaKind(formula: string) {
  if (!formula.trim()) return "";
  if (
    !/^\s*[+-]?\s*(?:\d*[dD]\d+|\d+)(?:\s*[+-]\s*(?:\d*[dD]\d+|\d+))*\s*$/.test(
      formula,
    )
  )
    return "Free-text formula";
  return /d/i.test(formula) ? "Dice formula" : "Flat damage";
}

export function damageLines(components: Damage[]) {
  const lines: string[] = [];
  let combined: string[] = [];
  for (const { formula, type, qualifier } of components) {
    if (!formula.trim()) continue;
    const value = [formula, type?.trim()].filter(Boolean).join(" ");
    if (qualifier?.trim()) {
      if (combined.length) lines.push(combined.join(" + "));
      combined = [];
      lines.push(`${qualifier.trim()} · ${value}`);
    } else {
      combined.push(value);
    }
  }
  if (combined.length) lines.push(combined.join(" + "));
  return lines;
}

export function saveText(save?: Save) {
  if (!save?.ability && !save?.dc?.trim()) return "";
  return [save.ability, save.dc?.trim() && `DC ${save.dc.trim()}`, "save"]
    .filter(Boolean)
    .join(" ");
}

export function attackText(attack: Attack) {
  return [
    attack.name.trim(),
    attack.bonus?.trim() && `${attack.bonus.trim()} to hit`,
    saveText(attack.save),
  ]
    .filter(Boolean)
    .join(" · ");
}

export function legendaryName(action: LegendaryAction) {
  const name = action.name.trim() || "Legendary action";
  return action.cost?.trim() ? `${name} · Cost ${action.cost.trim()}` : name;
}

export function legendaryRules(legendary: LegendaryActions) {
  return [
    legendary.intro,
    legendary.activation?.trim() &&
      `Activation · ${legendary.activation.trim()}`,
    legendary.recovery?.trim() && `Recovery · ${legendary.recovery.trim()}`,
  ]
    .filter((text) => text?.trim())
    .join("\n");
}

export function legendaryBody(action: LegendaryAction) {
  return [
    action.description,
    saveText(action.save),
    ...damageLines(action.damage),
    action.effects,
  ]
    .filter((text) => text?.trim())
    .join("\n");
}

export function hasCombatBack(
  attacks?: Attack[],
  legendary?: LegendaryActions,
) {
  return (
    !!attacks?.some((attack) => attack.effects?.trim()) ||
    !!(
      legendary?.enabled &&
      (legendaryRules(legendary) ||
        legendary.actions.some(
          (action) =>
            action.name.trim() || action.cost?.trim() || legendaryBody(action),
        ))
    )
  );
}

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, max = 20_000): value is string =>
  typeof value === "string" && value.length <= max;
const optional = (value: unknown) => value === undefined || text(value);
function uniqueEntries<T extends { id: string }>(
  value: unknown,
  valid: (entry: unknown) => entry is T,
): value is T[] {
  return (
    Array.isArray(value) &&
    value.every(valid) &&
    new Set(value.map((entry) => entry.id)).size === value.length
  );
}
const validId = (value: unknown): value is string =>
  text(value, 100) && !!value;
function validSave(value: unknown) {
  return (
    value === undefined ||
    (record(value) &&
      (value.ability === undefined ||
        saveAbilities.some((ability) => ability === value.ability)) &&
      optional(value.dc))
  );
}
function validDamage(value: unknown): value is Damage {
  return (
    record(value) &&
    validId(value.id) &&
    text(value.formula) &&
    optional(value.type) &&
    optional(value.qualifier)
  );
}
function validAttack(value: unknown): value is Attack {
  return (
    record(value) &&
    validId(value.id) &&
    text(value.name) &&
    optional(value.bonus) &&
    validSave(value.save) &&
    uniqueEntries(value.damage, validDamage) &&
    optional(value.effects)
  );
}
function validAction(value: unknown): value is LegendaryAction {
  return (
    record(value) &&
    validId(value.id) &&
    text(value.name) &&
    optional(value.cost) &&
    optional(value.description) &&
    validSave(value.save) &&
    uniqueEntries(value.damage, validDamage) &&
    optional(value.effects)
  );
}
export function validAttacks(value: unknown): value is Attack[] {
  return uniqueEntries(value, validAttack);
}
export function validLegendary(value: unknown): value is LegendaryActions {
  return (
    record(value) &&
    typeof value.enabled === "boolean" &&
    optional(value.uses) &&
    optional(value.intro) &&
    optional(value.activation) &&
    optional(value.recovery) &&
    uniqueEntries(value.actions, validAction)
  );
}
