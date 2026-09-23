const MAX_EDGE = 1600;
const QUALITY = 0.85;

/**
 * Downscales and re-encodes a photo as JPEG in the browser. Re-encoding via
 * canvas drops all EXIF metadata — including the GPS position phones embed
 * — and keeps uploads small on a weak mountain connection.
 */
export async function prepareImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Kunde inte läsa bilden.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Kunde inte läsa bilden."))), "image/jpeg", QUALITY)
  );
}
