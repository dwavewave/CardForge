import {
  fieldSide,
  itemChoices,
  itemFieldEnabled,
  itemFieldGroups,
  itemCustomNameFields,
  type Card,
  type Side,
} from "./model";

const attunementLabels: Record<string, string> = {
  Restricted: "Required by class or creature",
  Custom: "Custom requirement",
};

export function ItemDetails({
  card,
  update,
}: {
  card: Card;
  update: (patch: Partial<Card>) => void;
}) {
  return (
    <section aria-label="Item details">
      {Object.entries(itemFieldGroups).map(([group, fields]) => (
        <details
          className="editor-disclosure"
          key={group}
          open={group === "Item identification"}
        >
          <summary>{group}</summary>
          {group === "Equipment details" && (
            <p className="field-help">
              Changing the category keeps hidden equipment values.
            </p>
          )}
          <div className="fields">
            {fields
              .filter((field) => itemFieldEnabled(card, field.key))
              .map((field) => {
                const value = card.fields[field.key] ?? "";
                const setValue = (next: string) =>
                  update({ fields: { ...card.fields, [field.key]: next } });
                const choices = Object.hasOwn(itemChoices, field.key)
                  ? itemChoices[field.key]
                  : undefined;
                return (
                  <div
                    key={field.key}
                    className={field.multiline ? "wide" : undefined}
                  >
                    <label>
                      {field.label}
                      {choices ? (
                        <select
                          value={value}
                          onChange={(event) => setValue(event.target.value)}
                        >
                          <option value="">Unspecified</option>
                          {choices.map((choice) => (
                            <option key={choice} value={choice}>
                              {field.key === "attunement"
                                ? (attunementLabels[choice] ?? choice)
                                : choice}
                            </option>
                          ))}
                        </select>
                      ) : field.multiline ? (
                        <textarea
                          rows={field.key === "description" ? 5 : 3}
                          maxLength={20000}
                          value={value}
                          onChange={(event) => setValue(event.target.value)}
                        />
                      ) : (
                        <input
                          maxLength={20000}
                          value={value}
                          onChange={(event) => setValue(event.target.value)}
                        />
                      )}
                    </label>
                    {!itemCustomNameFields.has(field.key) && (
                      <div className="field-placement">
                        <select
                          aria-label={`Side for ${field.label}`}
                          value={fieldSide(card, field)}
                          onChange={(event) =>
                            update({
                              placement: {
                                ...card.placement,
                                [field.key]: event.target.value as Side,
                              },
                            })
                          }
                        >
                          <option value="front">Front</option>
                          <option value="back">Back</option>
                        </select>
                        {field.multiline && (
                          <small>{value.length} characters</small>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </details>
      ))}
    </section>
  );
}
