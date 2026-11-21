// Turns runout classes (runout.ts) into 256×256 map tiles: palette PNGs in
// NVE's three blues, so Sweden (our model) and Norway (NVE's map) look alike.
import { deflateSync } from "node:zlib";

export const TILE = 256;

/** Index = class: 0 transparent, 1 long reach, 2 medium, 3 short (NVE's runout colours). */
export const RUNOUT_COLORS: Array<[number, number, number]> = [
  [0, 0, 0],
  [154, 177, 230],
  [76, 155, 255],
  [0, 77, 168],
];

/** One tile from a larger class grid: the 256×256 square at (left, top). */
export function cut(classes: Uint8Array, gridWidth: number, left: number, top: number): Uint8Array {
  const out = new Uint8Array(TILE * TILE);
  for (let y = 0; y < TILE; y++) out.set(classes.subarray((top + y) * gridWidth + left, (top + y) * gridWidth + left + TILE), y * TILE);
  return out;
}

/** The parent tile of four children (top-left, top-right, bottom-left, bottom-right; null = empty): the highest class of each 2×2. */
export function parentOf(children: Array<Uint8Array | null>): Uint8Array | null {
  if (children.every((c) => !c)) return null;
  const out = new Uint8Array(TILE * TILE);
  const half = TILE / 2;
  children.forEach((child, q) => {
    if (!child) return;
    const ox = (q % 2) * half;
    const oy = (q >> 1) * half;
    for (let y = 0; y < half; y++) {
      for (let x = 0; x < half; x++) {
        const i = 2 * y * TILE + 2 * x;
        out[(oy + y) * TILE + ox + x] = Math.max(child[i], child[i + 1], child[i + TILE], child[i + TILE + 1]);
      }
    }
  });
  return out.some((v) => v > 0) ? out : null;
}

const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});

function crc32(data: Uint8Array): number {
  let c = -1;
  for (let i = 0; i < data.length; i++) c = CRC[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
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

/** A 256×256 palette PNG; class 0 fully transparent. */
export function encodeRunoutPng(classes: Uint8Array): Uint8Array {
  const header = new Uint8Array(13);
  const hv = new DataView(header.buffer);
  hv.setUint32(0, TILE);
  hv.setUint32(4, TILE);
  header.set([8, 3, 0, 0, 0], 8);
  const raw = new Uint8Array(TILE * (TILE + 1));
  for (let y = 0; y < TILE; y++) raw.set(classes.subarray(y * TILE, (y + 1) * TILE), y * (TILE + 1) + 1);
  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("PLTE", new Uint8Array(RUNOUT_COLORS.flat())),
    chunk("tRNS", new Uint8Array(RUNOUT_COLORS.map((_, i) => (i === 0 ? 0 : 255)))),
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

/** NVE's runout tile pixel → its class (3 short … 1 long), -1 for its slope colours (steep ground), 0 otherwise. */
export function nveClass(r: number, g: number, b: number, a: number): number {
  if (a < 128) return 0;
  for (let k = 1; k <= 3; k++) {
    const [cr, cg, cb] = RUNOUT_COLORS[k];
    if (Math.abs(r - cr) + Math.abs(g - cg) + Math.abs(b - cb) < 30) return k;
  }
  return -1;
}
