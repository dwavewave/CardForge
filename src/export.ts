import {
  type Card,
  type Side,
  type PrintOptions,
  defaultPrint,
  decorative,
} from "./model";
import {
  canvasMeasure,
  cardLayout,
  paint,
  PNG_H,
  PNG_W,
  safeBounds,
} from "./layout";
import { loadFrame, loadImage } from "./art";
import { printPages, printSlots } from "./print";
export const mm = (value: number) => (value * 72) / 25.4;
export async function fontsReady() {
  await Promise.allSettled([
    document.fonts.load("400 21px Inter"),
    document.fonts.load("700 16px Inter"),
    document.fonts.load("700 38px Lora"),
    document.fonts.load("700 38px Cinzel"),
  ]);
  await document.fonts.ready;
}
export async function renderCard(
  card: Card,
  safe: number,
  allowOverflow = false,
  side: Side = "front",
) {
  await fontsReady();
  const canvas = document.createElement("canvas");
  canvas.width = PNG_W;
  canvas.height = PNG_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable in this browser.");
  const layout = cardLayout(card, safe, canvasMeasure(ctx), side);
  if (layout.overflow && !allowOverflow)
    throw new Error(
      `“${card.title || "Untitled"}” overflows on the ${side}. Move content, shorten it, or create continuations.`,
    );
  const frameName = side === "back" && decorative(card) ? "back" : card.frame;
  const [frame, artwork] = await Promise.all([
    frameName === "plain" ? undefined : loadFrame(frameName),
    layout.ops.some((op) => op.kind === "artwork") && card.artwork
      ? loadImage(card.artwork.src)
      : undefined,
  ]);
  paint(ctx, layout, PNG_W, PNG_H, { frame, artwork });
  return { canvas, layout };
}
export function download(data: Blob, filename: string) {
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
export const filename = (name: string) =>
  name.replace(/[^\p{L}\p{N}_-]/gu, "-").slice(0, 70) || "card";
export async function exportPNG(
  card: Card,
  safe: number,
  side: Side = "front",
) {
  const { canvas } = await renderCard(card, safe, false, side);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("PNG export failed."))),
      "image/png",
    ),
  );
  download(blob, `${filename(card.title)}-${side}.png`);
}
export async function createPDF(
  cards: Card[],
  gap: number,
  safe: number,
  crop: boolean,
  options = defaultPrint,
): Promise<Uint8Array> {
  if (!cards.length) throw new Error("Add cards to the print queue first.");
  return writePDF(cards, gap, safe, crop, options);
}

export function createCalibrationPDF(
  gap: number,
  safe: number,
  crop: boolean,
  options: PrintOptions,
) {
  const duplex =
    options.flip === "single" ? { ...options, flip: "long" as const } : options;
  return writePDF([], gap, safe, crop, duplex, true);
}

async function writePDF(
  cards: Card[],
  gap: number,
  safe: number,
  crop: boolean,
  options: PrintOptions,
  calibration = false,
) {
  const { PDFDocument, StandardFonts, PrintScaling, Duplex, rgb } =
    await import("pdf-lib");
  const pdf = await PDFDocument.create();
  pdf.setTitle(
    calibration
      ? "CardForge duplex calibration"
      : "CardForge · Print at actual size",
  );
  pdf.setCreator("CardForge v0.2");
  const preferences = pdf.catalog.getOrCreateViewerPreferences();
  preferences.setPrintScaling(PrintScaling.None);
  preferences.setDuplex(
    {
      single: Duplex.Simplex,
      long: Duplex.DuplexFlipLongEdge,
      short: Duplex.DuplexFlipShortEdge,
    }[options.flip],
  );
  const face = await pdf.embedFont(StandardFonts.Helvetica);
  const source = calibration
    ? Array.from({ length: 9 }, (_, i) => i + 1)
    : cards;
  const pages = printPages<Card | number>(source, options.flip);
  const ink = rgb(0.3, 0.3, 0.3);
  // A repeated decorative face needs only one image resource in the PDF.
  let decorativeImage: Awaited<ReturnType<typeof pdf.embedPng>> | undefined;
  for (const [pageIndex, { items, side }] of pages.entries()) {
    const page = pdf.addPage([mm(210), mm(297)]);
    const slots = printSlots(gap, side, options);
    const label = (text: string, x: number, y: number, size = 7) =>
      page.drawText(text, {
        x: mm(x),
        y: mm(297 - y),
        size,
        font: face,
        color: ink,
      });
    const line = (
      x: number,
      y: number,
      endX: number,
      endY: number,
      thickness = 0.3,
    ) =>
      page.drawLine({
        start: { x: mm(x), y: mm(297 - y) },
        end: { x: mm(endX), y: mm(297 - endY) },
        thickness,
        color: ink,
      });
    const box = (x: number, y: number, w: number, h: number, dashed = false) =>
      page.drawRectangle({
        x: mm(x),
        y: mm(297 - y - h),
        width: mm(w),
        height: mm(h),
        borderColor: ink,
        borderWidth: 0.35,
        borderDashArray: dashed ? [2, 2] : undefined,
      });
    for (const [index, card] of items.entries()) {
      if (card === null) continue;
      const { x, y, width, height } = slots[index];
      if (typeof card === "number") {
        box(x, y, width, height);
        label(`${side.toUpperCase()} / SLOT ${card}`, x + 9, y + 42, 16);
        line(x + 31.5, y + 32, x + 31.5, y + 17, 1);
        line(x + 31.5, y + 17, x + 28.5, y + 21, 1);
        line(x + 31.5, y + 17, x + 34.5, y + 21, 1);
        const corners =
          side === "front"
            ? [1, 2, 3, 4]
            : options.flip === "long"
              ? [2, 1, 4, 3]
              : [3, 4, 1, 2];
        corners.forEach((corner, i) =>
          label(
            `${card}.${corner}`,
            x + (i % 2 ? 51 : 4),
            y + (i < 2 ? 7 : 83),
          ),
        );
        label("Hold to light to compare numbered corners.", x + 6, y + 53);
      } else {
        const usesDecoration = side === "back" && decorative(card);
        let png = usesDecoration ? decorativeImage : undefined;
        if (!png) {
          const { canvas } = await renderCard(card, safe, false, side);
          png = await pdf.embedPng(canvas.toDataURL("image/png"));
          if (usesDecoration) decorativeImage = png;
        }
        page.drawImage(png, {
          x: mm(x),
          y: mm(297 - y - height),
          width: mm(width),
          height: mm(height),
        });
      }
      if (options.guides) {
        const bounds =
          typeof card === "number" || (side === "back" && decorative(card))
            ? { pad: safe * 10, top: safe * 10, bottom: safe * 10 }
            : safeBounds(card, safe);
        box(
          x + bounds.pad / 10,
          y + bounds.top / 10,
          width - bounds.pad / 5,
          height - (bounds.top + bounds.bottom) / 10,
          true,
        );
        const bleed = Math.min(1, gap * 0.4, x - 0.15, 210 - x - width - 0.15);
        if (bleed > 0)
          box(
            x - bleed,
            y - bleed,
            width + 2 * bleed,
            height + 2 * bleed,
            true,
          );
      }
      if (crop) {
        const length = gap > 0 ? Math.min(2, gap / 2 - 0.25) : 2;
        const col = index % 3,
          row = Math.floor(index / 3);
        for (const dx of [-1, 1])
          for (const dy of [-1, 1]) {
            const cornerX = x + (dx > 0 ? width : 0),
              cornerY = y + (dy > 0 ? height : 0);
            if (gap > 0 || (dx < 0 ? col === 0 : col === 2)) {
              const available = (dx < 0 ? cornerX : 210 - cornerX) - 0.4;
              if (available > 0)
                line(
                  cornerX + dx * 0.25,
                  cornerY,
                  cornerX + dx * (0.25 + Math.min(length, available)),
                  cornerY,
                );
            }
            if (gap > 0 || (dy < 0 ? row === 0 : row === 2))
              line(
                cornerX,
                cornerY + dy * 0.25,
                cornerX,
                cornerY + dy * (0.25 + length),
              );
          }
      }
    }
    const rulerY = side === "back" && options.y > 0 ? 6 : 291;
    line(9, rulerY, 29, rulerY, 0.6);
    for (const x of [9, 29]) line(x, rulerY + 1, x, rulerY - 1, 0.6);
    const flip =
      options.flip === "single"
        ? "Single-sided"
        : `Flip on ${options.flip} edge`;
    label(
      `20 mm   |   A4 at 100% / actual size   |   ${flip}   |   ${side} ${pageIndex + 1}/${pages.length}`,
      33,
      rulerY + 0.6,
    );
  }
  return pdf.save();
}
