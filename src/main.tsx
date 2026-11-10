import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/inter/400.css";
import "@fontsource/inter/700.css";
import "@fontsource/lora/700.css";
import "@fontsource/cinzel/700.css";
import { CardAppearance } from "./CardAppearance";
import { ItemDetails } from "./ItemDetails";
import { CreatureDetails } from "./CreatureDetails";
import { CombatDetails } from "./CombatDetails";
import { PrintSettings } from "./PrintSettings";
import { importArtwork, frameURL, loadImage } from "./art";
import { printPages, printSlots } from "./print";
import {
  type Card,
  type Kind,
  type Library,
  type Side,
  VERSION,
  MAX_CARD_TYPE_LABEL,
  npcCombatKeys,
  creatureStatKeys,
  defaultPrint,
  fieldSide,
  decorative,
  tagSymbols,
  MAX_BACKUP,
  MAX_CARDS,
  mergeLibraries,
  templates,
  newCard,
  demoLibrary,
  fieldsFor,
  palette,
  uid,
  parseLibrary,
  serialize,
  STORAGE_KEY,
} from "./model";
import {
  canvasMeasure,
  cardLayout,
  cardTextFields,
  creatureFront,
  continuations,
  sheetGeometry,
} from "./layout";
import {
  renderCard,
  download,
  exportPNG,
  createPDF,
  createCalibrationPDF,
  fontsReady,
} from "./export";
import "./style.css";
function initial(): { library: Library; error: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return { library: raw ? parseLibrary(raw) : demoLibrary(), error: "" };
  } catch {
    return {
      library: {
        version: VERSION,
        print: { ...defaultPrint },
        printers: [],
        cards: [],
        queue: [],
        gap: 2,
        safe: 3,
        crop: true,
      },
      error:
        "Saved data could not be read. It has been left untouched. Import a backup, or explicitly save a card to start a new library.",
    };
  }
}
const loaded = initial();
function backupData(library: Library) {
  const data = serialize(library);
  if (new TextEncoder().encode(data).byteLength > MAX_BACKUP)
    throw new Error(
      "This change would exceed the 15 MB backup limit. Remove some artwork or cards first.",
    );
  return data;
}
function Preview({
  card,
  safe,
  side = "front",
  onOverflow,
}: {
  card: Card;
  safe: number;
  side?: Side;
  onOverflow?: (v: boolean) => void;
}) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let active = true;
    renderCard(card, safe, true, side)
      .then(({ canvas, layout }) => {
        if (active) {
          setSrc(canvas.toDataURL());
          if (onOverflow) {
            const other = side === "front" ? "back" : "front";
            const ctx = canvas.getContext("2d")!;
            onOverflow(
              layout.overflow ||
                cardLayout(card, safe, canvasMeasure(ctx), other).overflow,
            );
          }
        }
      })
      .catch(() => {
        if (active) {
          setSrc("");
          onOverflow?.(true);
        }
      });
    return () => {
      active = false;
    };
  }, [card, safe, side, onOverflow]);
  const stats = side === "front" ? creatureFront(card) : undefined;
  return (
    <>
      {src ? (
        <img
          className="card-image"
          src={src}
          alt={`${templates[card.type].label} ${side} preview: ${card.title || "Untitled card"}`}
        />
      ) : (
        <div className="card-placeholder">Preparing card…</div>
      )}
      <span className="sr-only">
        {side === "back" && decorative(card) ? (
          "Decorative dragon-compass reverse"
        ) : (
          <>
            {side === "front"
              ? `${card.subtitle}. Tags: ${card.tags.map((t) => t.label).join(", ")}.`
              : ""}{" "}
            {stats &&
              [
                stats.classification,
                ...[...stats.primary, ...stats.scores].map((cell) =>
                  [cell.label, cell.value, cell.modifier]
                    .filter(Boolean)
                    .join(" "),
                ),
                stats.details,
              ]
                .filter(Boolean)
                .join(". ")}{" "}
            {cardTextFields(card, side)
              .map((field) =>
                [field.label, field.value].filter(Boolean).join(": "),
              )
              .join(". ")}
          </>
        )}
      </span>
    </>
  );
}
function DeleteDialog({
  onCancel,
  onDelete,
}: {
  onCancel: () => void;
  onDelete: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="delete-title"
      onCancel={onCancel}
    >
      <h2 id="delete-title">Delete this card?</h2>
      <p>It will also be removed from the print queue.</p>
      <div>
        <button autoFocus onClick={onCancel}>
          Keep card
        </button>
        <button className="danger" onClick={onDelete}>
          Delete card
        </button>
      </div>
    </dialog>
  );
}
function ImportDialog({
  count,
  canMerge,
  onCancel,
  onImport,
}: {
  count: number;
  canMerge: boolean;
  onCancel: () => void;
  onImport: (mode: "merge" | "replace") => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal import-modal"
      aria-labelledby="import-title"
      onCancel={onCancel}
    >
      <h2 id="import-title">
        Import {count} {count === 1 ? "card" : "cards"}
      </h2>
      <p>
        Merge adds new cards and skips matching card IDs. Your cards, current
        draft, print queue, and settings stay as they are.
      </p>
      {!canMerge && (
        <p>Merge is unavailable because the saved library could not be read.</p>
      )}
      <p>
        Replace library loads the backup’s cards and settings and discards your
        current draft.
      </p>
      <div>
        <button autoFocus onClick={onCancel}>
          Cancel
        </button>
        <button className="danger" onClick={() => onImport("replace")}>
          Replace library
        </button>
        <button
          className="primary"
          disabled={!canMerge}
          onClick={() => onImport("merge")}
        >
          Merge
        </button>
      </div>
    </dialog>
  );
}
function App() {
  const [library, setLibrary] = useState(loaded.library),
    [card, setCard] = useState<Card>(
      loaded.library.cards[0] || newCard("spell"),
    );
  const [view, setView] = useState<"studio" | "print">("studio"),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all");
  const [side, setSide] = useState<Side>("front");
  const [grid, setGrid] = useState(false);
  const [collection, setCollection] = useState("");
  const [pdf, setPdf] = useState<{ url: string; file: File }>();
  useEffect(
    () => () => {
      if (pdf) URL.revokeObjectURL(pdf.url);
    },
    [pdf],
  );
  const [notice, setNotice] = useState(loaded.error),
    [storageError, setStorageError] = useState(""),
    [overflow, setOverflow] = useState(false),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false);
  const [canPersist, setCanPersist] = useState(!loaded.error),
    [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<Library>();
  const importRef = useRef<HTMLInputElement>(null);
  const activeCardId = useRef(card.id);
  const currentLibrary = useRef(library);
  useEffect(() => {
    activeCardId.current = card.id;
  }, [card.id]);
  useEffect(() => {
    currentLibrary.current = library;
  }, [library]);
  useEffect(() => {
    if (!canPersist) return;
    try {
      localStorage.setItem(STORAGE_KEY, backupData(library));
      setStorageError("");
    } catch {
      setStorageError(
        "Browser storage is unavailable or full. Export a JSON backup to keep your work.",
      );
    }
  }, [library, canPersist]);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  function update(patch: Partial<Card>) {
    setCard((c) => ({ ...c, ...patch, demo: false }));
    setDirty(true);
  }
  function choose(next: Card) {
    if (dirty && !window.confirm("Discard unsaved changes to this card?"))
      return;
    setCard(structuredClone(next));
    setSide("front");
    setDirty(false);
    setView("studio");
  }
  function save() {
    if (card.type === "item" && !card.title.trim()) {
      setNotice("Enter an item name before saving.");
      return;
    }
    if (
      library.cards.length >= MAX_CARDS &&
      !library.cards.some((c) => c.id === card.id)
    ) {
      setNotice(
        "Library limit reached (500 cards). Export a backup and remove cards first.",
      );
      return;
    }
    const saved = { ...card, title: card.title.trim() || "Untitled card" };
    const next = {
      ...library,
      cards: library.cards.some((c) => c.id === saved.id)
        ? library.cards.map((c) => (c.id === saved.id ? saved : c))
        : [...library.cards, saved],
    };
    try {
      backupData(next);
    } catch (error) {
      setNotice((error as Error).message);
      return;
    }
    setLibrary(next);
    setCard(saved);
    setDirty(false);
    setCanPersist(true);
    setNotice("Card saved to your library.");
  }
  function toggleQueue(id: string) {
    setLibrary((l) => ({
      ...l,
      queue: l.queue.includes(id)
        ? l.queue.filter((x) => x !== id)
        : [...l.queue, id],
    }));
  }
  function duplicate(c: Card) {
    const copy = {
      ...structuredClone(c),
      id: uid(),
      title: `${c.title.slice(0, 110)} (copy)`,
      demo: false,
    };
    choose(copy);
  }
  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }
  async function split() {
    if (card.type === "item" && !card.title.trim())
      throw new Error("Enter an item name before saving continuations.");
    await fontsReady();
    const ctx = document.createElement("canvas").getContext("2d")!;
    const cards = continuations(card, library.safe, canvasMeasure(ctx), uid);
    if (
      cards.length + library.cards.filter((c) => c.id !== card.id).length >
      MAX_CARDS
    )
      throw new Error("Continuations exceed the 500-card library limit.");
    const next = {
      ...library,
      cards: [...library.cards.filter((c) => c.id !== card.id), ...cards],
      queue: library.queue.includes(card.id)
        ? library.queue.flatMap((id) =>
            id === card.id ? cards.map((c) => c.id) : [id],
          )
        : library.queue,
    };
    backupData(next);
    if (currentLibrary.current !== library || activeCardId.current !== card.id)
      return;
    setLibrary(next);
    setCard(cards[0]);
    setDirty(false);
    setCanPersist(true);
    setNotice(
      `Saved ${cards.length} continuation cards. All source text is preserved.`,
    );
  }
  async function importFile(file: File) {
    if (file.size > MAX_BACKUP)
      throw new Error("Backup exceeds the 15 MB limit.");
    const incoming = parseLibrary(await file.text());
    backupData(incoming);
    for (const { artwork } of incoming.cards) {
      if (!artwork) continue;
      const image = await loadImage(artwork.src);
      if (image.width > 640 || image.height > 640)
        throw new Error("Artwork in the backup exceeds the 640 px limit.");
    }
    setPendingImport(incoming);
  }
  function applyImport(mode: "merge" | "replace") {
    const incoming = pendingImport;
    if (!incoming) return;
    setPendingImport(undefined);
    if (mode === "merge") {
      if (!canPersist) return;
      try {
        const result = mergeLibraries(library, incoming);
        if (result.added) {
          const data = backupData(result.library);
          try {
            localStorage.setItem(STORAGE_KEY, data);
          } catch {
            throw new Error(
              "Merge could not be saved. Browser storage is unavailable or full.",
            );
          }
          setLibrary(result.library);
        }
        setNotice(
          `Merged ${result.added} ${result.added === 1 ? "card" : "cards"}. Skipped ${result.skipped} existing.`,
        );
      } catch (error) {
        setNotice((error as Error).message);
      }
      return;
    }
    setLibrary(incoming);
    setCard(incoming.cards[0] || newCard("spell"));
    setSide("front");
    setDirty(false);
    setCanPersist(true);
    setNotice("Library imported and validated.");
  }
  const filtered = library.cards.filter(
    (c) =>
      (filter === "all" || c.type === filter) &&
      (!collection || c.collection === collection) &&
      `${c.title} ${c.subtitle} ${c.collection} ${c.tags.map((t) => t.label).join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const queued = library.queue
    .map((id) => library.cards.find((c) => c.id === id)!)
    .filter(Boolean);
  const saved = library.cards.some((c) => c.id === card.id),
    geometry = sheetGeometry(library.gap);
  const setSetting = (patch: Partial<Library>) =>
    setLibrary((l) => ({ ...l, ...patch }));
  const collections = [
    ...new Set(library.cards.map((c) => c.collection).filter(Boolean)),
  ].sort();
  useEffect(() => {
    setPdf(undefined);
  }, [library]);
  async function preparePDF(calibration: boolean) {
    setPdf(undefined);
    const bytes = await (calibration
      ? createCalibrationPDF(
          library.gap,
          library.safe,
          library.crop,
          library.print,
        )
      : createPDF(
          queued,
          library.gap,
          library.safe,
          library.crop,
          library.print,
        ));
    const file = new File(
      [new Uint8Array(bytes)],
      calibration ? "cardforge-calibration.pdf" : "cardforge-print.pdf",
      { type: "application/pdf" },
    );
    if (currentLibrary.current === library)
      setPdf({ url: URL.createObjectURL(file), file });
  }
  return (
    <div className="app">
      <header className="topbar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setView("studio");
          }}
        >
          <span className="brand-icon">◈</span>
          <span>
            CardForge<small>THE TABLETOP PRINT STUDIO</small>
          </span>
          <span className="version">v0.2.5</span>
        </a>
        <nav aria-label="Main navigation">
          <button
            className={view === "studio" ? "nav active" : "nav"}
            onClick={() => setView("studio")}
          >
            Card studio
          </button>
          <button
            className={view === "print" ? "nav active" : "nav"}
            onClick={() => setView("print")}
          >
            Print queue <span className="count">{queued.length}</span>
          </button>
        </nav>
        <span className="local">
          <i /> Local-first · Yours to keep
        </span>
      </header>
      {(notice || storageError) && (
        <div className={`notice ${storageError ? "error" : ""}`} role="status">
          <span>{storageError || notice}</span>
          <button
            aria-label="Dismiss message"
            onClick={() => {
              setNotice("");
              setStorageError("");
            }}
          >
            ×
          </button>
        </div>
      )}
      <div className="workspace">
        <aside className="sidebar">
          <div className="side-title">
            <span>YOUR LIBRARY</span>
            <span className="muted">{library.cards.length}</span>
          </div>
          <button
            className="primary new-card"
            onClick={() => choose(newCard(card.type))}
          >
            <span>＋</span> New card
          </button>
          <label className="search">
            <span>⌕</span>
            <input
              aria-label="Search cards"
              placeholder="Find a card…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <select
            aria-label="Filter library by template"
            className="filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All templates</option>
            {Object.entries(templates).map(([k, t]) => (
              <option key={k} value={k}>
                {t.label}
              </option>
            ))}
          </select>
          <div className="library-filters">
            {!!collections.length && (
              <select
                aria-label="Filter library by collection"
                value={collection}
                onChange={(e) => setCollection(e.target.value)}
              >
                <option value="">All collections</option>
                {collections.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            )}
            <button aria-pressed={grid} onClick={() => setGrid(!grid)}>
              {grid ? "List view" : "Frame grid"}
            </button>
          </div>
          <div className={grid ? "library-list library-grid" : "library-list"}>
            {filtered.map((c) => (
              <div
                key={c.id}
                className={`library-card ${c.id === card.id ? "selected" : ""}`}
              >
                <button className="library-open" onClick={() => choose(c)}>
                  {grid && c.frame !== "plain" && (
                    <img
                      className="library-thumb"
                      src={frameURL(c.frame)}
                      alt=""
                    />
                  )}
                  <span
                    className="type-icon"
                    style={{ color: templates[c.type].color }}
                  >
                    {templates[c.type].icon}
                  </span>
                  <span>
                    <strong>{c.title}</strong>
                    <small>
                      {templates[c.type].label}
                      {c.demo ? " · Demo" : ""}
                    </small>
                  </span>
                </button>
                <label className="queue-check" title="Add to print queue">
                  <input
                    type="checkbox"
                    aria-label={`Queue ${c.title}`}
                    checked={library.queue.includes(c.id)}
                    onChange={() => toggleQueue(c.id)}
                  />
                </label>
              </div>
            ))}
            {!filtered.length && (
              <p className="empty">
                No cards here yet.
                <br />
                Make room for your next idea.
              </p>
            )}
          </div>
          <div className="library-tools">
            <button
              onClick={() =>
                download(
                  new Blob([serialize(library)], { type: "application/json" }),
                  `cardforge-library-v${VERSION}.json`,
                )
              }
            >
              ↥ Export library
            </button>
            <button disabled={busy} onClick={() => importRef.current?.click()}>
              ↧ Import JSON
            </button>
            <input
              type="file"
              accept="application/json,.json"
              ref={importRef}
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void run(() => importFile(file));
                e.target.value = "";
              }}
            />
          </div>
          <div className="side-foot">
            <span>◉</span>
            <p>
              Stored in this browser.
              <br />
              <small>Back up your library to keep it safe.</small>
            </p>
          </div>
        </aside>
        <main>
          {view === "studio" ? (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">MAKE SOMETHING TABLE-WORTHY</div>
                  <h1>
                    Your next great session,
                    <br className="mobile-break" /> in the cards.
                  </h1>
                  <p>Shape an idea. Keep it close. Bring it to the table.</p>
                </div>
                <span className="heading-mark" aria-hidden="true">
                  ✧
                </span>
              </div>
              <div className="studio-grid">
                <section className="editor panel" aria-label="Card editor">
                  <div className="panel-heading">
                    <div>
                      <span className="step">01</span>
                      <h2>Craft your card</h2>
                    </div>
                    <span className="muted">
                      {dirty
                        ? "Unsaved changes"
                        : saved
                          ? "Saved locally"
                          : "New draft"}
                    </span>
                  </div>
                  <div className="editor-body">
                    <div className="section-label">CHOOSE A TEMPLATE</div>
                    <div className="template-grid">
                      {Object.entries(templates).map(([key, t]) => (
                        <button
                          key={key}
                          aria-pressed={card.type === key}
                          className={
                            card.type === key ? "template chosen" : "template"
                          }
                          onClick={() => {
                            if (card.type === key) return;
                            if (
                              (Object.values(card.fields).some(Boolean) ||
                                card.attacks?.length ||
                                card.legendaryActions) &&
                              !window.confirm(
                                "Changing template clears template fields. Continue?",
                              )
                            )
                              return;
                            update({
                              type: key as Kind,
                              cardTypeLabel: undefined,
                              miniStatBlock:
                                key === "monster"
                                  ? { enabled: true, layout: "standard" }
                                  : undefined,
                              ...(key === "plot" ? { attacks: undefined } : {}),
                              ...(key === "npc" || key === "monster"
                                ? {}
                                : { legendaryActions: undefined }),
                              ...(key === "item" &&
                              !saved &&
                              card.frame === "dragon"
                                ? { frame: "arcane" as const }
                                : {}),
                              fields: {},
                              placement: {},
                              customFields:
                                key === "custom"
                                  ? [
                                      {
                                        key: uid(),
                                        label: "Notes",
                                        multiline: true,
                                      },
                                    ]
                                  : [],
                            });
                          }}
                        >
                          <span aria-hidden="true">{t.icon}</span>
                          <strong>{t.label}</strong>
                        </button>
                      ))}
                    </div>
                    <div className="form-divider" />
                    <label>
                      {card.type === "item" ? "Item name" : "Card title"}
                      <input
                        required={card.type === "item"}
                        value={card.title}
                        maxLength={120}
                        placeholder="Give your card a name"
                        onChange={(e) => update({ title: e.target.value })}
                      />
                    </label>
                    {card.type === "custom" && (
                      <label>
                        Card Type Label{" "}
                        <span className="optional">optional</span>
                        <input
                          value={card.cardTypeLabel ?? ""}
                          maxLength={MAX_CARD_TYPE_LABEL}
                          placeholder="Location, Quest, Encounter…"
                          onChange={(e) =>
                            update({ cardTypeLabel: e.target.value })
                          }
                        />
                      </label>
                    )}
                    <label>
                      Subtitle <span className="optional">optional</span>
                      <input
                        value={card.subtitle}
                        maxLength={180}
                        placeholder="A little more context…"
                        onChange={(e) => update({ subtitle: e.target.value })}
                      />
                    </label>
                    {card.type === "item" && (
                      <ItemDetails card={card} update={update} />
                    )}
                    {(card.type === "monster" || card.type === "npc") && (
                      <CreatureDetails
                        key={card.id}
                        card={card}
                        update={update}
                      />
                    )}
                    <CardAppearance
                      card={card}
                      busy={busy}
                      update={update}
                      onArtwork={(file) => {
                        const id = card.id;
                        void run(async () => {
                          const artwork = await importArtwork(file);
                          if (activeCardId.current === id) update({ artwork });
                        });
                      }}
                    />
                    <div className="subheading">
                      <h3>Tags</h3>
                      <span className="optional">
                        Independent. Color-coded. Yours.
                      </span>
                    </div>
                    <div className="tag-editor">
                      {card.tags.map((tag, index) => (
                        <div className="tag-row" key={tag.id}>
                          <input
                            type="color"
                            value={tag.color}
                            aria-label={`Color for ${tag.label || "tag"}`}
                            onChange={(e) =>
                              update({
                                tags: card.tags.map((t) =>
                                  t.id === tag.id
                                    ? { ...t, color: e.target.value }
                                    : t,
                                ),
                              })
                            }
                          />
                          <input
                            aria-label={`Tag ${index + 1} label`}
                            value={tag.label}
                            maxLength={28}
                            placeholder="Tag label"
                            onChange={(e) =>
                              update({
                                tags: card.tags.map((t) =>
                                  t.id === tag.id
                                    ? { ...t, label: e.target.value }
                                    : t,
                                ),
                              })
                            }
                          />
                          <select
                            aria-label={`Tag ${index + 1} symbol`}
                            value={tag.symbol ?? ""}
                            onChange={(e) =>
                              update({
                                tags: card.tags.map((t) =>
                                  t.id === tag.id
                                    ? { ...t, symbol: e.target.value }
                                    : t,
                                ),
                              })
                            }
                          >
                            {tagSymbols.map((symbol) => (
                              <option key={symbol} value={symbol}>
                                {symbol || "—"}
                              </option>
                            ))}
                          </select>
                          <button
                            disabled={index === 0}
                            aria-label={`Move tag ${index + 1} up`}
                            onClick={() => {
                              const tags = [...card.tags];
                              [tags[index - 1], tags[index]] = [
                                tags[index],
                                tags[index - 1],
                              ];
                              update({ tags });
                            }}
                          >
                            ↑
                          </button>
                          <button
                            disabled={index === card.tags.length - 1}
                            aria-label={`Move tag ${index + 1} down`}
                            onClick={() => {
                              const tags = [...card.tags];
                              [tags[index + 1], tags[index]] = [
                                tags[index],
                                tags[index + 1],
                              ];
                              update({ tags });
                            }}
                          >
                            ↓
                          </button>
                          <button
                            aria-label={`Remove tag ${index + 1}`}
                            onClick={() =>
                              update({
                                tags: card.tags.filter((t) => t.id !== tag.id),
                              })
                            }
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      className="text-button"
                      disabled={card.tags.length >= 20}
                      onClick={() =>
                        update({
                          tags: [
                            ...card.tags,
                            {
                              id: uid(),
                              label: "New tag",
                              color: palette[card.tags.length % palette.length],
                            },
                          ],
                        })
                      }
                    >
                      ＋ Add tag
                    </button>
                    <div className="form-divider" />
                    {card.type !== "item" && (
                      <div className="subheading">
                        <h3>{templates[card.type].label} details</h3>
                        <span className="optional">
                          {card.type === "npc"
                            ? "Performance cues print first"
                            : ""}
                        </span>
                      </div>
                    )}
                    {(card.type === "item"
                      ? []
                      : card.type === "monster"
                        ? ["Actions, traits and tactics"]
                        : [""]
                    ).map((group) => {
                      const fieldList = fieldsFor(card).filter(
                        (f) =>
                          (card.type !== "npc" || !npcCombatKeys.has(f.key)) &&
                          (card.type !== "monster" ||
                            !creatureStatKeys.has(f.key)),
                      );
                      const controls = (
                        <div className="fields">
                          {fieldList.map((field) => (
                            <div
                              key={field.key}
                              className={`${field.multiline ? "wide" : ""} ${field.cue ? "cue-field" : ""}`}
                            >
                              {card.type === "custom" && (
                                <div className="custom-label">
                                  <input
                                    aria-label="Field label"
                                    maxLength={60}
                                    value={field.label}
                                    onChange={(e) =>
                                      update({
                                        customFields: card.customFields.map(
                                          (f) =>
                                            f.key === field.key
                                              ? { ...f, label: e.target.value }
                                              : f,
                                        ),
                                      })
                                    }
                                  />
                                  <button
                                    aria-label={`Remove ${field.label} field`}
                                    onClick={() => {
                                      const values = { ...card.fields };
                                      delete values[field.key];
                                      const placement = { ...card.placement };
                                      delete placement[field.key];
                                      update({
                                        fields: values,
                                        placement,
                                        customFields: card.customFields.filter(
                                          (f) => f.key !== field.key,
                                        ),
                                      });
                                    }}
                                  >
                                    ×
                                  </button>
                                </div>
                              )}
                              <label
                                className={field.toggle ? "check-label" : ""}
                              >
                                {field.toggle ? (
                                  <>
                                    <input
                                      type="checkbox"
                                      checked={card.fields[field.key] === "Yes"}
                                      onChange={(e) =>
                                        update({
                                          fields: {
                                            ...card.fields,
                                            [field.key]: e.target.checked
                                              ? "Yes"
                                              : "",
                                          },
                                        })
                                      }
                                    />
                                    {field.label}
                                  </>
                                ) : (
                                  <>
                                    {card.type !== "custom" && field.label}
                                    {field.cue && (
                                      <span
                                        className="cue-dot"
                                        title="Performance cue"
                                      >
                                        {" "}
                                        ●
                                      </span>
                                    )}
                                    {field.multiline ? (
                                      <textarea
                                        aria-label={field.label}
                                        maxLength={20000}
                                        rows={
                                          field.key === "description" ? 5 : 3
                                        }
                                        value={card.fields[field.key] || ""}
                                        placeholder={`${field.label}…`}
                                        onChange={(e) =>
                                          update({
                                            fields: {
                                              ...card.fields,
                                              [field.key]: e.target.value,
                                            },
                                          })
                                        }
                                      />
                                    ) : (
                                      <input
                                        aria-label={field.label}
                                        maxLength={20000}
                                        value={card.fields[field.key] || ""}
                                        onChange={(e) =>
                                          update({
                                            fields: {
                                              ...card.fields,
                                              [field.key]: e.target.value,
                                            },
                                          })
                                        }
                                      />
                                    )}
                                  </>
                                )}
                              </label>
                              <div className="field-placement">
                                <select
                                  aria-label={`Side for ${field.label}`}
                                  value={fieldSide(card, field)}
                                  onChange={(e) =>
                                    update({
                                      placement: {
                                        ...card.placement,
                                        [field.key]: e.target.value as Side,
                                      },
                                    })
                                  }
                                >
                                  <option value="front">Front</option>
                                  <option value="back">Back</option>
                                </select>
                                {field.multiline && (
                                  <small>
                                    {(card.fields[field.key] || "").length}{" "}
                                    characters
                                  </small>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                      return group ? (
                        <details className="editor-disclosure" key={group}>
                          <summary>{group}</summary>
                          {controls}
                        </details>
                      ) : (
                        <React.Fragment key="fields">{controls}</React.Fragment>
                      );
                    })}
                    {card.type !== "plot" && (
                      <CombatDetails
                        key={`${card.id}:${card.type}`}
                        card={card}
                        update={update}
                      />
                    )}
                    <label className="back-notes">
                      DM notes (back)
                      <textarea
                        rows={3}
                        maxLength={20000}
                        value={card.backNotes}
                        onChange={(e) => update({ backNotes: e.target.value })}
                      />
                      <small className="field-help">
                        {card.backNotes.length} characters · Fit depends on the
                        selected frame and other fields.
                      </small>
                    </label>
                    {card.type === "custom" && (
                      <button
                        className="text-button"
                        disabled={card.customFields.length >= 40}
                        onClick={() =>
                          update({
                            customFields: [
                              ...card.customFields,
                              {
                                key: uid(),
                                label: "New field",
                                multiline: true,
                              },
                            ],
                          })
                        }
                      >
                        ＋ Add field
                      </button>
                    )}
                  </div>
                  <div className="editor-actions">
                    <button className="primary" onClick={save}>
                      Save card <span>↗</span>
                    </button>
                    <button onClick={() => duplicate(card)}>Duplicate</button>
                    {saved && (
                      <button
                        className="danger"
                        onClick={() => setPendingDelete(card.id)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </section>
                <section className="preview-column" aria-label="Live preview">
                  <div className="preview-title">
                    <div>
                      <span className="step">02</span>
                      <h2>The real thing</h2>
                    </div>
                    <span className="live">
                      <i /> LIVE PREVIEW
                    </span>
                  </div>
                  <div className="side-toggle" aria-label="Preview side">
                    <button
                      aria-pressed={side === "front"}
                      onClick={() => setSide("front")}
                    >
                      Front
                    </button>
                    <button
                      aria-pressed={side === "back"}
                      onClick={() => setSide("back")}
                    >
                      Back
                    </button>
                  </div>
                  <div className="preview-stage">
                    <span className="dimension top">63 mm</span>
                    <div className="preview-card">
                      <Preview
                        card={card}
                        safe={library.safe}
                        side={side}
                        onOverflow={setOverflow}
                      />
                    </div>
                    <span className="dimension bottom">
                      88 mm portrait · 300 DPI export
                    </span>
                  </div>
                  <div
                    className={overflow ? "fit-status warning" : "fit-status"}
                  >
                    <span>{overflow ? "△" : "✓"}</span>
                    <div>
                      <strong>
                        {overflow
                          ? "This story needs more room."
                          : "Looking good. Ready for the table."}
                      </strong>
                      <p>
                        {overflow
                          ? "A side exceeds its safe area. Try Auto or a smaller Text Size, move fields, or create continuations. The overflowing side cannot export."
                          : "Preview and exports use the same card layout."}
                      </p>
                    </div>
                  </div>
                  {overflow && (
                    <button
                      className="continuation"
                      disabled={busy}
                      onClick={() => void run(split)}
                    >
                      Create & save continuation cards →
                    </button>
                  )}
                  <div className="preview-options">
                    <label>
                      Content safe area{" "}
                      <select
                        value={library.safe}
                        onChange={(e) =>
                          setSetting({ safe: Number(e.target.value) })
                        }
                      >
                        {[3, 4, 5, 6].map((v) => (
                          <option key={v} value={v}>
                            {v} mm
                          </option>
                        ))}
                      </select>
                    </label>
                    <span>Ornamental frames use larger insets</span>
                  </div>
                  <div className="export-actions">
                    <button
                      disabled={busy}
                      onClick={() =>
                        void run(() => exportPNG(card, library.safe, side))
                      }
                    >
                      ↓ Export {side} PNG
                    </button>
                    <button
                      className="primary"
                      disabled={!saved || dirty}
                      title={
                        !saved || dirty
                          ? "Save your changes before queueing this card"
                          : ""
                      }
                      onClick={() => toggleQueue(card.id)}
                    >
                      {library.queue.includes(card.id)
                        ? "✓ In print queue"
                        : "+ Add to print queue"}
                    </button>
                  </div>
                  <div className="print-note">
                    <span>▦</span>
                    <p>
                      <strong>Small cards. Big possibilities.</strong>
                      <br />
                      Nine cards on A4. Precise dimensions.
                      <br />
                      Made for your scissors, sleeves, and sessions.
                    </p>
                  </div>
                </section>
              </div>
            </>
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">FROM SCREEN TO SESSION</div>
                  <h1>Ready for the table.</h1>
                  <p>
                    Arrange your queue, export an A4 PDF, and print at actual
                    size.
                  </p>
                </div>
                <span className="heading-mark">▦</span>
              </div>
              <div className="print-grid">
                <section className="panel print-controls">
                  <div className="panel-heading">
                    <h2>Print setup</h2>
                    <span className="count">{queued.length} cards</span>
                  </div>
                  <div className="editor-body">
                    <p className="muted">
                      A4 portrait · 210 × 297 mm
                      <br />
                      Cards · 63 × 88 mm
                    </p>
                    <label>
                      Inter-card gap
                      <select
                        value={library.gap}
                        onChange={(e) =>
                          setSetting({ gap: Number(e.target.value) })
                        }
                      >
                        {[0, 1, 2, 3, 4, 5, 6].map((v) => (
                          <option key={v} value={v}>
                            {v} mm{v === 2 ? " (recommended)" : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Content safe area
                      <select
                        value={library.safe}
                        onChange={(e) =>
                          setSetting({ safe: Number(e.target.value) })
                        }
                      >
                        {[3, 4, 5, 6].map((v) => (
                          <option key={v} value={v}>
                            {v} mm
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={library.crop}
                        onChange={(e) => setSetting({ crop: e.target.checked })}
                      />
                      Include crop marks
                    </label>
                    <PrintSettings library={library} setSetting={setSetting} />
                    {library.print.flip === "single" &&
                      queued.some((c) => !decorative(c)) && (
                        <p className="field-help">
                          Some queued cards have information on the back.
                          Single-sided printing includes the fronts only.
                        </p>
                      )}
                    <div className="geometry">
                      Margins recomputed for your gap:
                      <br />
                      <strong>{geometry.left} mm</strong> left / right
                      <br />
                      <strong>{geometry.top} mm</strong> top / bottom
                    </div>
                    <p className="print-instruction">
                      Print at <strong>100% / actual size</strong>.<br />
                      Disable “fit to page” and check the 20 mm ruler. Match the
                      duplex flip setting in your print dialog. Printer margins
                      and feed alignment vary. Test on plain paper before
                      trimming or laminating.
                    </p>
                    <button
                      className="primary full"
                      disabled={busy || !queued.length}
                      onClick={() => void run(() => preparePDF(false))}
                    >
                      {busy ? "Preparing…" : "Prepare A4 PDF"}
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => void run(() => preparePDF(true))}
                    >
                      Prepare duplex test sheet
                    </button>
                    {pdf && (
                      <div className="pdf-ready" role="status">
                        <a href={pdf.url} download={pdf.file.name}>
                          Download PDF
                        </a>
                        <a href={pdf.url} target="_blank" rel="noreferrer">
                          Open PDF
                        </a>
                        {navigator.canShare?.({ files: [pdf.file] }) && (
                          <button
                            onClick={() => {
                              void navigator
                                .share({ files: [pdf.file] })
                                .catch((error) => {
                                  if (error.name !== "AbortError")
                                    setNotice(
                                      "Sharing failed. Use Download PDF or Open PDF.",
                                    );
                                });
                            }}
                          >
                            Share PDF
                          </button>
                        )}
                      </div>
                    )}
                    <div className="subheading">
                      <h3>Queue order</h3>
                      <button
                        className="text-button"
                        disabled={!queued.length}
                        onClick={() => setSetting({ queue: [] })}
                      >
                        Clear
                      </button>
                    </div>
                    <ol className="queue-list">
                      {queued.map((c, i) => (
                        <li key={c.id}>
                          <span>
                            {i + 1}. {c.title}
                          </span>
                          <div>
                            <button
                              aria-label={`Move ${c.title} earlier`}
                              disabled={i === 0}
                              onClick={() => {
                                const q = [...library.queue];
                                [q[i - 1], q[i]] = [q[i], q[i - 1]];
                                setSetting({ queue: q });
                              }}
                            >
                              ↑
                            </button>
                            <button
                              aria-label={`Move ${c.title} later`}
                              disabled={i === queued.length - 1}
                              onClick={() => {
                                const q = [...library.queue];
                                [q[i + 1], q[i]] = [q[i], q[i + 1]];
                                setSetting({ queue: q });
                              }}
                            >
                              ↓
                            </button>
                            <button
                              aria-label={`Remove ${c.title} from queue`}
                              onClick={() => toggleQueue(c.id)}
                            >
                              ×
                            </button>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                </section>
                <section className="sheets" aria-label="A4 sheet preview">
                  {!queued.length ? (
                    <div className="queue-empty">
                      <span>▦</span>
                      <h2>A fresh sheet awaits.</h2>
                      <p>
                        Select cards in your library to fill the print queue.
                      </p>
                      <button onClick={() => setView("studio")}>
                        Back to the studio
                      </button>
                    </div>
                  ) : (
                    printPages(queued, library.print.flip).map(
                      ({ items, side }, i) => (
                        <div className="sheet-wrap" key={i}>
                          <div className="sheet-caption">
                            PAGE {i + 1} · {side.toUpperCase()}{" "}
                            <span>A4 · 9 slots</span>
                          </div>
                          <div className="sheet">
                            {printSlots(library.gap, side, library.print).map(
                              (s, j) => {
                                const c = items[j];
                                return (
                                  <div
                                    key={j}
                                    className={`sheet-slot ${c ? "" : "blank"}`}
                                    style={{
                                      left: `${(s.x / 210) * 100}%`,
                                      top: `${(s.y / 297) * 100}%`,
                                      width: "30%",
                                      height: `${(88 / 297) * 100}%`,
                                    }}
                                  >
                                    {c ? (
                                      <Preview
                                        card={c}
                                        safe={library.safe}
                                        side={side}
                                      />
                                    ) : (
                                      <span>Empty slot</span>
                                    )}
                                  </div>
                                );
                              },
                            )}
                            <span className="sheet-footer">
                              20 mm ─── Print at 100% / actual size
                            </span>
                          </div>
                        </div>
                      ),
                    )
                  )}
                </section>
              </div>
            </>
          )}
        </main>
      </div>
      <footer className="app-footer">
        <span>CARDFORGE</span>
        <p>A little preparation. A lot of adventure.</p>
        <span>Local by design.</span>
      </footer>
      {pendingImport && (
        <ImportDialog
          count={pendingImport.cards.length}
          canMerge={canPersist}
          onCancel={() => setPendingImport(undefined)}
          onImport={applyImport}
        />
      )}
      {pendingDelete && (
        <DeleteDialog
          onCancel={() => setPendingDelete(null)}
          onDelete={() => {
            setLibrary((l) => ({
              ...l,
              cards: l.cards.filter((c) => c.id !== pendingDelete),
              queue: l.queue.filter((id) => id !== pendingDelete),
            }));
            if (card.id === pendingDelete) {
              setCard(newCard(card.type));
              setDirty(false);
            }
            setPendingDelete(null);
            setNotice("Card deleted.");
          }}
        />
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener(
    "load",
    () => {
      void navigator.serviceWorker
        .register(`${import.meta.env.BASE_URL}sw.js`, {
          scope: import.meta.env.BASE_URL,
          updateViaCache: "none",
        })
        .catch((error) =>
          console.warn("CardForge offline setup failed.", error),
        );
    },
    { once: true },
  );
}
