import { expect, it } from "vitest";
import { backIndex, printPages, printSlots } from "./print";
import { defaultPrint } from "./model";

it("maps portrait long-edge and short-edge backs without rotating card artwork", () => {
  const indexes = Array.from({ length: 9 }, (_, i) => i);
  expect(indexes.map((i) => backIndex(i, "long"))).toEqual([
    2, 1, 0, 5, 4, 3, 8, 7, 6,
  ]);
  expect(indexes.map((i) => backIndex(i, "short"))).toEqual([
    6, 7, 8, 3, 4, 5, 0, 1, 2,
  ]);
});
it.each([1, 3, 9, 10, 19])(
  "pairs and preserves occupied slots for %s cards",
  (count) => {
    const cards = Array.from({ length: count }, (_, i) => i + 1);
    for (const flip of ["long", "short"] as const) {
      const pages = printPages(cards, flip);
      expect(pages).toHaveLength(2 * Math.ceil(count / 9));
      for (let i = 0; i < pages.length; i += 2) {
        expect(pages[i].side).toBe("front");
        expect(pages[i + 1].side).toBe("back");
        pages[i].items.forEach((card, j) =>
          expect(pages[i + 1].items[backIndex(j, flip)]).toBe(card),
        );
      }
    }
  },
);
it("applies printer offsets to back coordinates only", () => {
  const options = { ...defaultPrint, x: 1.5, y: -0.5 };
  expect(printSlots(2, "front", options)[0]).toMatchObject({ x: 8.5, y: 14.5 });
  expect(printSlots(2, "back", options)[0]).toMatchObject({ x: 10, y: 14 });
});
