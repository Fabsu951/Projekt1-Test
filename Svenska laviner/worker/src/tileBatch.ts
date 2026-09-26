// Binary format for uploading many map tiles in one request:
// repeated [z: u8][x: u32][y: u32][length: u32][bytes], big-endian.

export interface Tile {
  z: number;
  x: number;
  y: number;
  data: Uint8Array;
}

const HEADER = 13;

export function encodeTiles(tiles: Tile[]): Uint8Array {
  const size = tiles.reduce((n, t) => n + HEADER + t.data.length, 0);
  const out = new Uint8Array(size);
  const view = new DataView(out.buffer);
  let o = 0;
  for (const t of tiles) {
    view.setUint8(o, t.z);
    view.setUint32(o + 1, t.x);
    view.setUint32(o + 5, t.y);
    view.setUint32(o + 9, t.data.length);
    out.set(t.data, o + HEADER);
    o += HEADER + t.data.length;
  }
  return out;
}

export function decodeTiles(buffer: ArrayBuffer): Tile[] {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const tiles: Tile[] = [];
  let o = 0;
  while (o < bytes.length) {
    if (o + HEADER > bytes.length) throw new Error("truncated tile header");
    const length = view.getUint32(o + 9);
    if (o + HEADER + length > bytes.length) throw new Error("truncated tile data");
    tiles.push({
      z: view.getUint8(o),
      x: view.getUint32(o + 1),
      y: view.getUint32(o + 5),
      data: bytes.subarray(o + HEADER, o + HEADER + length),
    });
    o += HEADER + length;
  }
  return tiles;
}

/** Web Mercator tile coordinates are valid for this zoom. */
export function validTile(z: number, x: number, y: number, maxZoom = 17): boolean {
  return Number.isInteger(z) && z >= 0 && z <= maxZoom && x >= 0 && y >= 0 && x < 2 ** z && y < 2 ** z;
}

export function imageType(data: Uint8Array): "image/png" | "image/jpeg" | null {
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) return "image/png";
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "image/jpeg";
  return null;
}
