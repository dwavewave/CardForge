import { createCanvas, loadImage } from "@napi-rs/canvas";
import { mkdir, writeFile } from "node:fs/promises";

const source = await loadImage("reference/cardinspo.png");
// Inclusive left/top, exclusive right/bottom in the supplied 1536 × 1024 composite.
const crops = {
  dragon: [23, 40, 622, 881],
  sword: [651, 16, 917, 432],
  arcane: [942, 34, 1210, 432],
  wings: [1218, 26, 1530, 432],
  back: [1171, 457, 1492, 886],
};
if (source.width !== 1536 || source.height !== 1024)
  throw new Error(
    "Crop coordinates are for the original 1536 × 1024 composite.",
  );
await mkdir("public/frames", { recursive: true });
for (const [name, [left, top, right, bottom]] of Object.entries(crops)) {
  const width = right - left,
    height = bottom - top;
  const canvas = createCanvas(width, height);
  canvas
    .getContext("2d")
    .drawImage(source, left, top, width, height, 0, 0, width, height);
  await writeFile(`public/frames/${name}.png`, canvas.toBuffer("image/png"));
}
for (const size of [180, 192, 512]) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#161721";
  ctx.fillRect(0, 0, size, size);
  const back = await loadImage("public/frames/back.png");
  const height = size * 0.84;
  const width = (height * back.width) / back.height;
  ctx.drawImage(back, (size - width) / 2, (size - height) / 2, width, height);
  await writeFile(`public/icon-${size}.png`, canvas.toBuffer("image/png"));
}
