import { useState } from "react";
import type { Flip, Library } from "./model";
import { backIndex } from "./print";

export function PrintSettings({
  library,
  setSetting,
}: {
  library: Library;
  setSetting: (patch: Partial<Library>) => void;
}) {
  const { print, printers } = library;
  const [name, setName] = useState("");
  const update = (patch: Partial<Library["print"]>) =>
    setSetting({ print: { ...print, ...patch } });
  const flip = print.flip === "single" ? "long" : print.flip;
  const slots = Array.from({ length: 9 }, (_, i) => i);
  const profile = printers.find((p) => p.name === name.trim());
  return (
    <>
      <label>
        Print sides
        <select
          value={print.flip}
          onChange={(e) => update({ flip: e.target.value as Flip })}
        >
          <option value="single">Single-sided</option>
          <option value="long">Duplex · long edge</option>
          <option value="short">Duplex · short edge</option>
        </select>
      </label>
      {print.flip !== "single" && (
        <div
          className="duplex-diagram"
          aria-label={
            flip === "long"
              ? "Back columns mirror left to right"
              : "Back rows mirror top to bottom"
          }
        >
          {[false, true].map((back) => (
            <div key={String(back)}>
              <strong>{back ? "Back ↑" : "Front ↑"}</strong>
              <div className="number-grid">
                {slots.map((i) => (
                  <span key={i}>{(back ? backIndex(i, flip) : i) + 1}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <details className="editor-disclosure">
        <summary>Printer calibration</summary>
        <p className="field-help">
          Adjust the back only. Positive X moves right and positive Y moves down
          on the PDF page.
        </p>
        {(["x", "y"] as const).map((axis) => (
          <label key={axis}>
            Back {axis.toUpperCase()} (mm) · {print[axis]}
            <input
              type="range"
              min={-4}
              max={4}
              step={0.1}
              value={print[axis]}
              onChange={(e) => update({ [axis]: Number(e.target.value) })}
            />
          </label>
        ))}
        <button type="button" onClick={() => update({ x: 0, y: 0 })}>
          Reset offsets
        </button>
        {!!printers.length && (
          <label>
            Load printer offsets
            <select
              value=""
              onChange={(e) => {
                const selected = printers.find(
                  (p) => p.name === e.target.value,
                );
                if (selected) {
                  setName(selected.name);
                  update({ x: selected.x, y: selected.y });
                }
              }}
            >
              <option value="">Choose a profile</option>
              {printers.map((p) => (
                <option key={p.name}>{p.name}</option>
              ))}
            </select>
          </label>
        )}
        <label>
          Printer profile name
          <input
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <div className="compact-actions">
          <button
            type="button"
            disabled={!name.trim() || (!profile && printers.length >= 20)}
            onClick={() =>
              setSetting({
                printers: [
                  ...printers.filter((p) => p.name !== name.trim()),
                  { name: name.trim(), x: print.x, y: print.y },
                ],
              })
            }
          >
            {profile ? "Update offsets" : "Save offsets"}
          </button>
          {profile && (
            <button
              type="button"
              onClick={() => {
                setSetting({
                  printers: printers.filter((p) => p.name !== profile.name),
                });
                setName("");
              }}
            >
              Remove profile
            </button>
          )}
        </div>
      </details>
      <label className="check-label">
        <input
          type="checkbox"
          checked={print.guides}
          onChange={(e) => update({ guides: e.target.checked })}
        />
        Include safe area and bleed guides
      </label>
    </>
  );
}
