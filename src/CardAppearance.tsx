import {
  frames,
  themes,
  textSizes,
  type TextSize,
  decorative,
  visibleFields,
  type Card,
  type Side,
} from "./model";
import { hasCombatBack } from "./combat";
import { frameURL } from "./art";

export function CardAppearance({
  card,
  busy,
  update,
  onArtwork,
}: {
  card: Card;
  busy: boolean;
  update: (patch: Partial<Card>) => void;
  onArtwork: (file: File) => void;
}) {
  const art = card.artwork;
  const hidesContent =
    card.reverse === "decorative" &&
    (card.backNotes.trim() ||
      art?.side === "back" ||
      visibleFields(card, "back").length > 0 ||
      hasCombatBack(card.attacks, card.legendaryActions));
  return (
    <section className="appearance" aria-label="Card appearance">
      <div className="section-label">FRAME STYLE</div>
      <div className="frame-grid">
        {Object.entries(frames).map(([name, label]) => (
          <button
            key={name}
            type="button"
            aria-pressed={card.frame === name}
            onClick={() => update({ frame: name as Card["frame"] })}
          >
            {name === "plain" ? (
              <span className="plain-thumb" aria-hidden="true">
                ◇
              </span>
            ) : (
              <img src={frameURL(name)} alt="" />
            )}
            <span>{label}</span>
          </button>
        ))}
      </div>
      <div className="appearance-options">
        <label>
          Theme
          <select
            value={card.theme}
            onChange={(e) => update({ theme: e.target.value as Card["theme"] })}
          >
            {Object.entries(themes).map(([name, label]) => (
              <option key={name} value={name}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Reverse mode
          <select
            value={card.reverse}
            onChange={(e) =>
              update({ reverse: e.target.value as Card["reverse"] })
            }
          >
            <option value="auto">Automatic</option>
            <option value="info">Information</option>
            <option value="decorative">Decorative</option>
          </select>
        </label>
        <label>
          Text Size
          <select
            value={card.textSize ?? "auto"}
            onChange={(e) => update({ textSize: e.target.value as TextSize })}
          >
            {textSizes.map((size) => (
              <option key={size} value={size}>
                {size[0].toUpperCase() + size.slice(1)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="field-help">
        {hidesContent
          ? "Decorative mode hides your reverse content in exports. Your edits stay saved."
          : decorative(card)
            ? "The reverse uses the dragon-compass artwork."
            : "The reverse uses the selected frame and fields placed on the back."}
      </p>
      <details className="editor-disclosure">
        <summary>Collection and artwork</summary>
        <label>
          Collection
          <input
            maxLength={60}
            value={card.collection}
            placeholder="Optional collection name"
            onChange={(e) => update({ collection: e.target.value })}
          />
        </label>
        <label>
          Import artwork
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onArtwork(file);
              e.target.value = "";
            }}
          />
        </label>
        {art && (
          <>
            <label>
              Artwork side
              <select
                value={art.side}
                onChange={(e) =>
                  update({ artwork: { ...art, side: e.target.value as Side } })
                }
              >
                <option value="front">Front</option>
                <option value="back">Back</option>
              </select>
            </label>
            {(
              [
                ["x", "Horizontal focus", 0, 100, 1],
                ["y", "Vertical focus", 0, 100, 1],
                ["zoom", "Crop zoom", 1, 3, 0.05],
              ] as const
            ).map(([key, label, min, max, step]) => (
              <label key={key}>
                {label} <span className="optional">{art[key]}</span>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={art[key]}
                  onChange={(e) =>
                    update({
                      artwork: { ...art, [key]: Number(e.target.value) },
                    })
                  }
                />
              </label>
            ))}
            <button
              type="button"
              onClick={() => update({ artwork: undefined })}
            >
              Remove artwork
            </button>
          </>
        )}
      </details>
    </section>
  );
}
