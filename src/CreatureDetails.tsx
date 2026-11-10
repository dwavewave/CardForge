import { type Card, type Side, creatureStatFields, fieldSide } from "./model";
import {
  abilities,
  abilityDisplay,
  creatureBackKeys,
  type MiniStatBlock,
} from "./creature";

const abilityNames = new Map<string, string>(abilities);

export function CreatureDetails({
  card,
  update,
}: {
  card: Card;
  update: (patch: Partial<Card>) => void;
}) {
  const settings: MiniStatBlock = card.miniStatBlock ?? { layout: "standard" };
  const setSettings = (patch: Partial<MiniStatBlock>) =>
    update({ miniStatBlock: { ...settings, ...patch } });
  return (
    <details className="editor-disclosure">
      <summary>Creature statistics</summary>
      <label className="check-label">
        <input
          type="checkbox"
          checked={settings.enabled ?? false}
          onChange={(event) => setSettings({ enabled: event.target.checked })}
        />
        Show Mini Stat Block
      </label>
      {settings.enabled && (
        <label>
          Front layout
          <select
            value={settings.layout}
            onChange={(event) =>
              setSettings({
                layout: event.target.value as MiniStatBlock["layout"],
              })
            }
          >
            <option value="standard">Standard</option>
            <option value="combat">Combat</option>
          </select>
        </label>
      )}
      <div className="fields">
        {creatureStatFields
          .filter(
            (field) =>
              !abilityNames.has(field.key) && !creatureBackKeys.has(field.key),
          )
          .map((field) => (
            <div key={field.key}>
              <label>
                {field.key === "challenge" ? "Challenge Rating" : field.label}
                <input
                  maxLength={20_000}
                  value={card.fields[field.key] ?? ""}
                  onChange={(event) =>
                    update({
                      fields: {
                        ...card.fields,
                        [field.key]: event.target.value,
                      },
                    })
                  }
                />
              </label>
              <Placement card={card} field={field} update={update} />
            </div>
          ))}
      </div>
      <details className="editor-disclosure">
        <summary>Ability scores and modifiers</summary>
        <div className="fields">
          {abilities.map(([key, name]) => {
            const score = card.fields[key] ?? "";
            const override = settings.modifiers?.[key] ?? "";
            return (
              <div key={key}>
                <label>
                  {name} ({key.toUpperCase()})
                  <input
                    maxLength={20_000}
                    value={score}
                    onChange={(event) =>
                      update({
                        fields: { ...card.fields, [key]: event.target.value },
                      })
                    }
                  />
                </label>
                <label>
                  {name} modifier override
                  <input
                    maxLength={20_000}
                    value={override}
                    placeholder={abilityDisplay(score).modifier || "Auto"}
                    onChange={(event) => {
                      const modifiers = { ...settings.modifiers };
                      if (event.target.value)
                        modifiers[key] = event.target.value;
                      else delete modifiers[key];
                      setSettings({ modifiers });
                    }}
                  />
                </label>
                <Placement
                  card={card}
                  field={creatureStatFields.find((field) => field.key === key)!}
                  update={update}
                />
              </div>
            );
          })}
        </div>
      </details>
      <details className="editor-disclosure">
        <summary>Defences, senses and languages</summary>
        <div className="fields">
          {creatureStatFields
            .filter((field) => creatureBackKeys.has(field.key))
            .map((field) => (
              <div key={field.key}>
                <label>
                  {field.label}
                  <input
                    maxLength={20_000}
                    value={card.fields[field.key] ?? ""}
                    onChange={(event) =>
                      update({
                        fields: {
                          ...card.fields,
                          [field.key]: event.target.value,
                        },
                      })
                    }
                  />
                </label>
                <Placement card={card} field={field} update={update} />
              </div>
            ))}
        </div>
      </details>
    </details>
  );
}

function Placement({
  card,
  field,
  update,
}: {
  card: Card;
  field: (typeof creatureStatFields)[number];
  update: (patch: Partial<Card>) => void;
}) {
  const side = Object.hasOwn(card.placement, field.key)
    ? fieldSide(card, field)
    : "";
  return (
    <div className="field-placement">
      <select
        aria-label={`Side for ${field.label}`}
        value={side}
        onChange={(event) => {
          const placement = { ...card.placement };
          if (event.target.value)
            placement[field.key] = event.target.value as Side;
          else delete placement[field.key];
          update({ placement });
        }}
      >
        <option value="">Default</option>
        <option value="front">Front</option>
        <option value="back">Back</option>
      </select>
    </div>
  );
}
