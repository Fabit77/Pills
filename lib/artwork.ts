import sharp from "sharp";

export const MAX_ARTWORK_INPUT_BYTES = 5 * 1024 * 1024;
export const MAX_ARTWORK_OUTPUT_BYTES = 1024 * 1024;
const ACCEPTED_ARTWORK_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export class ArtworkError extends Error {}

export async function optimizeArtwork(file: File) {
  if (!ACCEPTED_ARTWORK_TYPES.has(file.type)) throw new ArtworkError("Usa una imagen PNG, JPEG, WebP o GIF.");
  if (!file.size || file.size > MAX_ARTWORK_INPUT_BYTES) throw new ArtworkError("La imagen original debe pesar menos de 5 MB.");

  const source = Buffer.from(await file.arrayBuffer());
  const attempts = [
    { size: 1000, quality: 82 },
    { size: 900, quality: 72 },
    { size: 800, quality: 62 },
  ];

  try {
    for (const attempt of attempts) {
      const output = await sharp(source, { animated: true, limitInputPixels: 40_000_000 })
        .rotate()
        .resize(attempt.size, attempt.size, { fit: "cover", position: "centre" })
        .webp({ quality: attempt.quality, effort: 5, smartSubsample: true })
        .toBuffer();
      if (output.byteLength <= MAX_ARTWORK_OUTPUT_BYTES) return output;
    }
  } catch {
    throw new ArtworkError("No pudimos procesar esa imagen. Prueba con otro archivo.");
  }

  throw new ArtworkError("La imagen optimizada todavía supera 1 MB. Usa una imagen más simple o con menos cuadros.");
}
