import { type Card, fieldSide, npcCombatFields, uid } from "./model";
import {
  type Attack,
  type Damage,
  type LegendaryAction,
  type LegendaryActions,
  type Save,
  formulaKind,
  saveAbilities,
} from "./combat";

function TextInput({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  return (
    <label>
      {label}
      {multiline ? (
        <textarea
          value={value ?? ""}
          rows={3}
          maxLength={20_000}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          value={value ?? ""}
          maxLength={20_000}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </label>
  );
}

function SaveEditor({
  save,
  onChange,
}: {
  save?: Save;
  onChange: (save: Save) => void;
}) {
  return (
    <div className="fields">
      <label>
        Saving throw
        <select
          value={save?.ability ?? ""}
          onChange={(event) =>
            onChange({
              ...save,
              ability: (event.target.value as Save["ability"]) || undefined,
            })
          }
        >
          <option value="">None</option>
          {saveAbilities.map((ability) => (
            <option key={ability}>{ability}</option>
          ))}
        </select>
      </label>
      <TextInput
        label="Save DC"
        value={save?.dc}
        onChange={(dc) => onChange({ ...save, dc })}
      />
    </div>
  );
}

function DamageEditor({
  damage,
  onChange,
}: {
  damage: Damage[];
  onChange: (damage: Damage[]) => void;
}) {
  return (
    <div className="combat-damage">
      {damage.map((component, index) => {
        const update = (patch: Partial<Damage>) =>
          onChange(
            damage.map((part) =>
              part.id === component.id ? { ...part, ...patch } : part,
            ),
          );
        const kind = formulaKind(component.formula);
        return (
          <fieldset className="combat-entry" key={component.id}>
            <legend>Damage component {index + 1}</legend>
            <div className="fields">
              <TextInput
                label="Damage formula"
                value={component.formula}
                onChange={(formula) => update({ formula })}
              />
              <TextInput
                label="Damage type"
                value={component.type}
                onChange={(type) => update({ type })}
              />
            </div>
            {kind && <small className="field-help">{kind}</small>}
            <TextInput
              label="Qualifier (e.g. Versatile, recurring, upcast)"
              value={component.qualifier}
              onChange={(qualifier) => update({ qualifier })}
            />
            <button
              className="danger"
              type="button"
              onClick={() =>
                onChange(damage.filter((part) => part.id !== component.id))
              }
            >
              Remove component
            </button>
          </fieldset>
        );
      })}
      <button
        type="button"
        onClick={() => onChange([...damage, { id: uid(), formula: "" }])}
      >
        Add damage component
      </button>
    </div>
  );
}

function move<T>(entries: T[], index: number, offset: number): T[] {
  const next = [...entries];
  [next[index], next[index + offset]] = [next[index + offset], next[index]];
  return next;
}

function EntryControls({
  label,
  index,
  count,
  onMove,
  onRemove,
  onDuplicate,
}: {
  label: string;
  index: number;
  count: number;
  onMove: (offset: number) => void;
  onRemove: () => void;
  onDuplicate?: () => void;
}) {
  return (
    <div className="combat-controls">
      <button
        type="button"
        disabled={index === 0}
        aria-label={`Move ${label} up`}
        onClick={() => onMove(-1)}
      >
        ↑
      </button>
      <button
        type="button"
        disabled={index === count - 1}
        aria-label={`Move ${label} down`}
        onClick={() => onMove(1)}
      >
        ↓
      </button>
      {onDuplicate && (
        <button type="button" onClick={onDuplicate}>
          Duplicate action
        </button>
      )}
      <button type="button" className="danger" onClick={onRemove}>
        Remove {label}
      </button>
    </div>
  );
}

function LegendaryEditor({
  value,
  onChange,
}: {
  value?: LegendaryActions;
  onChange: (value: LegendaryActions) => void;
}) {
  const legendary = value ?? { enabled: false, actions: [] };
  const update = (patch: Partial<LegendaryActions>) =>
    onChange({ ...legendary, ...patch });
  const { actions } = legendary;
  return (
    <details className="editor-disclosure">
      <summary>Legendary actions</summary>
      <label className="check-label">
        <input
          type="checkbox"
          checked={legendary.enabled}
          onChange={(event) => update({ enabled: event.target.checked })}
        />
        Enable legendary actions
      </label>
      {legendary.enabled && (
        <>
          <div className="fields">
            <TextInput
              label="Action uses"
              value={legendary.uses}
              onChange={(uses) => update({ uses })}
            />
            <TextInput
              label="Recovery timing"
              value={legendary.recovery}
              onChange={(recovery) => update({ recovery })}
            />
          </div>
          <TextInput
            label="Activation restrictions"
            value={legendary.activation}
            onChange={(activation) => update({ activation })}
            multiline
          />
          <TextInput
            label="Introductory rules"
            value={legendary.intro}
            onChange={(intro) => update({ intro })}
            multiline
          />
          {actions.map((action, index) => {
            const patch = (changes: Partial<LegendaryAction>) =>
              update({
                actions: actions.map((entry) =>
                  entry.id === action.id ? { ...entry, ...changes } : entry,
                ),
              });
            return (
              <fieldset className="combat-entry" key={action.id}>
                <legend>Legendary action {index + 1}</legend>
                <div className="fields">
                  <TextInput
                    label="Action name"
                    value={action.name}
                    onChange={(name) => patch({ name })}
                  />
                  <TextInput
                    label="Action cost"
                    value={action.cost}
                    onChange={(cost) => patch({ cost })}
                  />
                </div>
                <TextInput
                  label="Description"
                  value={action.description}
                  onChange={(description) => patch({ description })}
                  multiline
                />
                <SaveEditor
                  save={action.save}
                  onChange={(save) => patch({ save })}
                />
                <DamageEditor
                  damage={action.damage}
                  onChange={(damage) => patch({ damage })}
                />
                <TextInput
                  label="Conditions or effects"
                  value={action.effects}
                  onChange={(effects) => patch({ effects })}
                  multiline
                />
                <EntryControls
                  label={`legendary action ${index + 1}`}
                  index={index}
                  count={actions.length}
                  onMove={(offset) =>
                    update({ actions: move(actions, index, offset) })
                  }
                  onDuplicate={() =>
                    update({
                      actions: [
                        ...actions.slice(0, index + 1),
                        { ...structuredClone(action), id: uid() },
                        ...actions.slice(index + 1),
                      ],
                    })
                  }
                  onRemove={() =>
                    update({
                      actions: actions.filter(
                        (entry) => entry.id !== action.id,
                      ),
                    })
                  }
                />
              </fieldset>
            );
          })}
          <button
            type="button"
            onClick={() =>
              update({
                actions: [...actions, { id: uid(), name: "", damage: [] }],
              })
            }
          >
            Add legendary action
          </button>
        </>
      )}
    </details>
  );
}

export function CombatDetails({
  card,
  update,
}: {
  card: Card;
  update: (patch: Partial<Card>) => void;
}) {
  const attacks = card.attacks ?? [];
  const setAttacks = (next: Attack[]) => update({ attacks: next });
  return (
    <details className="editor-disclosure combat-editor">
      <summary>
        {card.type === "spell"
          ? "Damage (optional)"
          : "Combat details (optional)"}
      </summary>
      {card.type === "npc" && (
        <details className="editor-disclosure">
          <summary>NPC combat statistics and actions</summary>
          <div className="fields">
            {npcCombatFields.map((field) => (
              <div
                key={field.key}
                className={field.multiline ? "wide" : undefined}
              >
                <TextInput
                  label={field.label}
                  value={card.fields[field.key]}
                  multiline={field.multiline}
                  onChange={(value) =>
                    update({ fields: { ...card.fields, [field.key]: value } })
                  }
                />
                <div className="field-placement">
                  <select
                    aria-label={`Side for ${field.label}`}
                    value={fieldSide(card, field)}
                    onChange={(event) =>
                      update({
                        placement: {
                          ...card.placement,
                          [field.key]: event.target.value as "front" | "back",
                        },
                      })
                    }
                  >
                    <option value="front">Front</option>
                    <option value="back">Back</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
      {attacks.map((attack, index) => {
        const patch = (changes: Partial<Attack>) =>
          setAttacks(
            attacks.map((entry) =>
              entry.id === attack.id ? { ...entry, ...changes } : entry,
            ),
          );
        return (
          <fieldset className="combat-entry" key={attack.id}>
            <legend>Attack {index + 1}</legend>
            <div className="fields">
              <TextInput
                label="Attack or ability name"
                value={attack.name}
                onChange={(name) => patch({ name })}
              />
              <TextInput
                label="Attack bonus"
                value={attack.bonus}
                onChange={(bonus) => patch({ bonus })}
              />
            </div>
            <SaveEditor
              save={attack.save}
              onChange={(save) => patch({ save })}
            />
            <DamageEditor
              damage={attack.damage}
              onChange={(damage) => patch({ damage })}
            />
            <TextInput
              label="Additional effects (back)"
              value={attack.effects}
              onChange={(effects) => patch({ effects })}
              multiline
            />
            <EntryControls
              label={`attack ${index + 1}`}
              index={index}
              count={attacks.length}
              onMove={(offset) => setAttacks(move(attacks, index, offset))}
              onRemove={() =>
                setAttacks(attacks.filter((entry) => entry.id !== attack.id))
              }
            />
          </fieldset>
        );
      })}
      <button
        type="button"
        onClick={() => {
          const damage =
            card.type === "item" &&
            !attacks.length &&
            card.fields.damageDice?.trim()
              ? [
                  {
                    id: uid(),
                    formula: card.fields.damageDice,
                    type: card.fields.damageType,
                  },
                ]
              : [];
          setAttacks([...attacks, { id: uid(), name: "", damage }]);
        }}
      >
        Add attack
      </button>
      {(card.type === "monster" || card.type === "npc") && (
        <LegendaryEditor
          value={card.legendaryActions}
          onChange={(legendaryActions) => update({ legendaryActions })}
        />
      )}
    </details>
  );
}
