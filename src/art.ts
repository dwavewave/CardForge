import type { Artwork } from "./model";

export const frameURL = (name: string) =>
  `${import.meta.env.BASE_URL}frames/${name}.png`;

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not decode card artwork."));
    image.src = src;
  });
}
const frameImages = new Map<string, Promise<HTMLImageElement>>();
export function loadFrame(name: string) {
  const cached = frameImages.get(name);
  if (cached) return cached;
  const pending = loadImage(frameURL(name)).catch((error) => {
    frameImages.delete(name);
    throw error;
  });
  frameImages.set(name, pending);
  return pending;
}

export async function importArtwork(file: File): Promise<Artwork> {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 12_000_000
  )
    throw new Error("Choose a JPEG, PNG or WebP up to 12 MB.");
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 640 / Math.max(image.width, image.height));
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is unavailable in this browser.");
    ctx.fillStyle = "#f2e6d1";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    let src = canvas.toDataURL("image/jpeg", 0.82);
    if (src.length > 300_000) src = canvas.toDataURL("image/jpeg", 0.58);
    if (src.length > 300_000 || !src.startsWith("data:image/jpeg;"))
      throw new Error(
        "This image could not be compacted for the local library.",
      );
    return { src, side: "front", x: 50, y: 50, zoom: 1 };
  } finally {
    URL.revokeObjectURL(url);
  }
}
