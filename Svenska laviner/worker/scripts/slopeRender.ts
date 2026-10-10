import { deflateSync } from "node:zlib";

// Slope map tiles from a height model: the angle of the ground for every
// pixel of a Web Mercator tile, in the same bands as the app's slope layer
// (app/src/utils/routePlan.ts SLOPE_BANDS). Below 30° stays transparent, so
// the topographic map shows through.

export const TILE_SIZE = 256;

/** Band 0 = transparent (under 30°), then 30–35, 35–40, 40–45, over 45. */
export const BAND_LIMITS = [30, 35, 40, 45];
export const BAND_COLORS: Array<[number, number, number]> = [
  [0, 0, 0],
  [0xff, 0xeb, 0x3b],
  [0xff, 0x98, 0x00],
  [0xf4, 0x43, 0x36],
  [0x8c, 0x14, 0x5a],
];

export function band(slopeDegrees: number): number {
  let b = 0;
  for (const limit of BAND_LIMITS) if (slopeDegrees >= limit) b++;
  return b;
}

/** Heights in metres at a SWEREF 99 TM point (east, north), or null where there is no data. */
export type HeightAt = (east: number, north: number) => number | null;
/** lon/lat → SWEREF 99 TM [east, north]. */
export type Project = (lon: number, lat: number) => [number, number];

export function tileLon(x: number, z: number): number {
  return (x / 2 ** z) * 360 - 180;
}

export function tileLat(y: number, z: number): number {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return (180 / Math.PI) * Math.atan(Math.sinh(n));
}

/** Ground metres per pixel at a latitude and zoom (Web Mercator, 256 px tiles). */
export function metresPerPixel(lat: number, z: number): number {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** z;
}

const GRID = 16;

/**
 * The slope band of each pixel of tile z/x/y (row by row), or null when the
 * tile has no steep ground. The projection is computed on a 17×17 grid and
 * interpolated in between (a tile is a few hundred metres across, where it
 * is practically linear). The slope uses height differences over
 * `max(2 m, pixel size)` either side, which smooths the noise of a 1 m model.
 */
export function renderSlopeTile(z: number, x: number, y: number, height: HeightAt, project: Project): Uint8Array | null {
  const west = tileLon(x, z);
  const east = tileLon(x + 1, z);
  const north = tileLat(y, z);
  const south = tileLat(y + 1, z);
  const grid: Array<[number, number]> = [];
  for (let j = 0; j <= GRID; j++) {
    // Pixel rows are evenly spaced in Mercator y, not in latitude.
    const lat = tileLat(y + j / GRID, z);
    for (let i = 0; i <= GRID; i++) grid.push(project(west + ((east - west) * i) / GRID, lat));
  }
  const step = Math.max(2, metresPerPixel((north + south) / 2, z));
  const out = new Uint8Array(TILE_SIZE * TILE_SIZE);
  let steep = false;
  for (let py = 0; py < TILE_SIZE; py++) {
    const gy = ((py + 0.5) / TILE_SIZE) * GRID;
    const j = Math.min(GRID - 1, Math.floor(gy));
    const ty = gy - j;
    for (let px = 0; px < TILE_SIZE; px++) {
      const gx = ((px + 0.5) / TILE_SIZE) * GRID;
      const i = Math.min(GRID - 1, Math.floor(gx));
      const tx = gx - i;
      const a = grid[j * (GRID + 1) + i];
      const b = grid[j * (GRID + 1) + i + 1];
      const c = grid[(j + 1) * (GRID + 1) + i];
      const d = grid[(j + 1) * (GRID + 1) + i + 1];
      const e = (a[0] * (1 - tx) + b[0] * tx) * (1 - ty) + (c[0] * (1 - tx) + d[0] * tx) * ty;
      const n = (a[1] * (1 - tx) + b[1] * tx) * (1 - ty) + (c[1] * (1 - tx) + d[1] * tx) * ty;
      const hE = height(e + step, n);
      const hW = height(e - step, n);
      const hN = height(e, n + step);
      const hS = height(e, n - step);
      if (hE === null || hW === null || hN === null || hS === null) continue;
      const dx = (hE - hW) / (2 * step);
      const dy = (hN - hS) / (2 * step);
      const slope = (Math.atan(Math.hypot(dx, dy)) * 180) / Math.PI;
      const v = band(slope);
      if (v) {
        out[py * TILE_SIZE + px] = v;
        steep = true;
      }
    }
  }
  return steep ? out : null;
}

/**
 * The parent tile from its four children (top-left, top-right, bottom-left,
 * bottom-right; null = nothing steep), keeping the steepest band of each
 * 2×2 block so short steep parts don't disappear when zooming out.
 */
export function mergeChildren(children: Array<Uint8Array | null>): Uint8Array | null {
  if (children.every((c) => c === null)) return null;
  const out = new Uint8Array(TILE_SIZE * TILE_SIZE);
  const half = TILE_SIZE / 2;
  children.forEach((child, k) => {
    if (!child) return;
    const ox = (k % 2) * half;
    const oy = Math.floor(k / 2) * half;
    for (let y = 0; y < half; y++) {
      for (let x = 0; x < half; x++) {
        const i = 2 * y * TILE_SIZE + 2 * x;
        out[(oy + y) * TILE_SIZE + ox + x] = Math.max(child[i], child[i + 1], child[i + TILE_SIZE], child[i + TILE_SIZE + 1]);
      }
    }
  });
  return out;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/** A 256×256 palette PNG (band 0 fully transparent). */
export function encodeBandsPng(bands: Uint8Array): Uint8Array {
  const header = new Uint8Array(13);
  const hv = new DataView(header.buffer);
  hv.setUint32(0, TILE_SIZE);
  hv.setUint32(4, TILE_SIZE);
  header.set([8, 3, 0, 0, 0], 8); // 8-bit, palette
  const palette = new Uint8Array(BAND_COLORS.flat());
  const alpha = new Uint8Array(BAND_COLORS.map((_, i) => (i === 0 ? 0 : 255)));
  const raw = new Uint8Array(TILE_SIZE * (TILE_SIZE + 1));
  for (let y = 0; y < TILE_SIZE; y++) raw.set(bands.subarray(y * TILE_SIZE, (y + 1) * TILE_SIZE), y * (TILE_SIZE + 1) + 1);
  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("PLTE", palette),
    chunk("tRNS", alpha),
    chunk("IDAT", new Uint8Array(deflateSync(raw, { level: 9 }))),
    chunk("IEND", new Uint8Array(0)),
  ];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
