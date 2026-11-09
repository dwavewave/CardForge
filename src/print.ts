import type { Flip, PrintOptions, Side } from "./model";
import { paginate, sheetGeometry } from "./layout";

export function backIndex(index: number, flip: Exclude<Flip, "single">) {
  const row = Math.floor(index / 3),
    col = index % 3;
  return flip === "long" ? row * 3 + (2 - col) : (2 - row) * 3 + col;
}

export function printPages<T>(items: T[], flip: Flip) {
  return paginate(items).flatMap((front) => {
    const page = { side: "front" as Side, items: front };
    if (flip === "single") return [page];
    const back = front.map((_, i) => front[backIndex(i, flip)]);
    return [page, { side: "back" as Side, items: back }];
  });
}

export function printSlots(gap: number, side: Side, options: PrintOptions) {
  const { slots } = sheetGeometry(gap);
  if (side === "front") return slots;
  return slots.map((slot) => ({
    ...slot,
    x: slot.x + options.x,
    y: slot.y + options.y,
  }));
}
