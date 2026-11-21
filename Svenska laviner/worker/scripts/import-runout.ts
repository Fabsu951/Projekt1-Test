// Builds Snöläge's runout-zone map (runout.ts) for the Swedish mountain boxes
// and uploads the tiles to the map bucket (kartor.snolage.se/runout/…)
// through the worker, like import-tiles.ts does for the topographic map.
//
// Heights: Mapterhorn's Terrarium tiles at zoom 11 (512 px, ≈ 15 m in the
// mountains; built from Lantmäteriet's and Kartverket's 1 m height models).
// Work goes in blocks of one zoom-9 tile with one zoom-11 tile of margin
// (≥ 7 km), more than any runout in Sweden can reach. Output: zoom 12 tiles
// (one tile pixel = one height cell) and their parents down to zoom 8.
//
//   npx tsx scripts/import-runout.ts --calibrate            compare with NVE in Norway, print the best angles
//   npx tsx scripts/import-runout.ts --dry-run [--limit 3]  compute a few blocks, write PNGs to ./runout-prov
//   npx tsx scripts/import-runout.ts                        compute and upload everything
// Options: --alphas 30,25,20  --boxes main|more|all (default all)  --skip <n>  --limit <n>
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { mountainBoxes } from "../src/gpkgTiles";
import type { Tile } from "../src/tileBatch";
import { tileInNorwayOnly } from "../../app/src/utils/norwayTiles";
import { DEFAULT_ALPHAS, flowNeighbours, reachedCells, slopeGrid, type HeightGrid } from "./runout";
import { cut, encodeRunoutPng, nveClass, parentOf, TILE } from "./runoutTiles";
import { createUploadToken, uploadTiles, WORKER } from "./uploadClient";

const DEM_Z = 11;
const DEM_PX = 512;
const BLOCK_Z = 9;
const OUT_Z = 12;
const MIN_Z = 8;
/** zoom-11 tiles per block side, plus one of margin on each side. */
const PER_BLOCK = 2 ** (DEM_Z - BLOCK_Z);
const GRID = (PER_BLOCK + 2) * DEM_PX;
const CORE = DEM_PX;
const DEM_URL = "https://tiles.mapterhorn.com/{z}/{x}/{y}.webp";
const NVE_RUNOUT = "https://gis3.nve.no/arcgis/rest/services/wmts/Bratthet_med_utlop_2024/MapServer/tile/{z}/{y}/{x}";
const EARTH = 6378137;
const BATCH_TILES = 40;
const BATCH_BYTES = 1024 * 1024;
/** Steep ground: the slope map shows it, and the comparison leaves it out. */
const STEEP = 30;
/** Our tiles stop this far into Norway (NVE's map covers Norway). */
const NORWAY_MARGIN_KM = 3;

interface Options {
  mode: "calibrate" | "dry-run" | "import";
  alphas: number[];
  boxes: "main" | "more" | "all";
  skip: number;
  limit: number;
}

function parseArgs(argv: string[]): Options {
  const opts: Options = { mode: "import", alphas: DEFAULT_ALPHAS, boxes: "all", skip: 0, limit: Infinity };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--calibrate") opts.mode = "calibrate";
    else if (a === "--dry-run") opts.mode = "dry-run";
    else if (a === "--alphas") opts.alphas = argv[++i].split(",").map(Number);
    else if (a === "--boxes") opts.boxes = argv[++i] as Options["boxes"];
    else if (a === "--skip") opts.skip = Number(argv[++i]);
    else if (a === "--limit") opts.limit = Number(argv[++i]);
  }
  if (opts.alphas.some((x) => !(x > 5 && x < 60))) throw new Error("--alphas: grader mellan 5 och 60, t.ex. 30,25,20");
  opts.alphas = [...opts.alphas].sort((a, b) => b - a);
  return opts;
}

const lonToX = (lon: number, z: number) => Math.floor(((lon + 180) / 360) * 2 ** z);
const latToY = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
};
/** Latitude of a global pixel row (centre) at zoom z with `px`-pixel tiles. */
const rowLat = (row: number, z: number, px: number) => {
  const n = Math.PI * (1 - (2 * (row + 0.5)) / (px * 2 ** z));
  return (Math.atan(Math.sinh(n)) * 180) / Math.PI;
};

// ---- heights -------------------------------------------------------------

const demCache = new Map<string, Promise<Float32Array | null>>();

async function fetchWithRetry(url: string): Promise<Response | null> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60_000), headers: { "User-Agent": "Snolage-runout-import (snolage.se)" } });
      if (res.status === 404) return null;
      if (res.ok) return res;
      if (attempt >= 5) throw new Error(`${url}: HTTP ${res.status}`);
    } catch (err) {
      if (attempt >= 5) throw err;
    }
    await new Promise((r) => setTimeout(r, 1500 * attempt));
  }
}

function demTile(x: number, y: number): Promise<Float32Array | null> {
  const key = `${x}/${y}`;
  let p = demCache.get(key);
  if (!p) {
    p = (async () => {
      const res = await fetchWithRetry(DEM_URL.replace("{z}", String(DEM_Z)).replace("{x}", String(x)).replace("{y}", String(y)));
      if (!res) return null;
      const { data, info } = await sharp(Buffer.from(await res.arrayBuffer())).raw().toBuffer({ resolveWithObject: true });
      if (info.width !== DEM_PX || info.height !== DEM_PX) throw new Error(`Höjdbit ${key} är ${info.width}×${info.height}`);
      const ch = info.channels;
      const out = new Float32Array(DEM_PX * DEM_PX);
      for (let i = 0; i < out.length; i++) out[i] = data[i * ch] * 256 + data[i * ch + 1] + data[i * ch + 2] / 256 - 32768;
      return out;
    })();
    demCache.set(key, p);
    // Keep roughly two block rows of tiles.
    if (demCache.size > 200) demCache.delete(demCache.keys().next().value!);
  }
  return p;
}

/** The block's height grid: (PER_BLOCK + 2)² zoom-11 tiles; missing tiles are NaN. */
async function blockGrid(bx: number, by: number): Promise<HeightGrid | null> {
  const x0 = bx * PER_BLOCK - 1;
  const y0 = by * PER_BLOCK - 1;
  const n = PER_BLOCK + 2;
  const z = new Float32Array(GRID * GRID).fill(NaN);
  const jobs: Array<Promise<void>> = [];
  let found = 0;
  for (let ty = 0; ty < n; ty++) {
    for (let tx = 0; tx < n; tx++) {
      jobs.push(
        demTile(x0 + tx, y0 + ty).then((tile) => {
          if (!tile) return;
          found++;
          for (let r = 0; r < DEM_PX; r++) z.set(tile.subarray(r * DEM_PX, (r + 1) * DEM_PX), (ty * DEM_PX + r) * GRID + tx * DEM_PX);
        })
      );
    }
  }
  await Promise.all(jobs);
  if (!found) return null;
  const rowStart = y0 * DEM_PX;
  const sizes = new Float64Array(GRID);
  for (let r = 0; r < GRID; r++) sizes[r] = (2 * Math.PI * EARTH * Math.cos((rowLat(rowStart + r, DEM_Z, DEM_PX) * Math.PI) / 180)) / (DEM_PX * 2 ** DEM_Z);
  return { width: GRID, height: GRID, z, cellSize: (row) => sizes[row] };
}

// ---- blocks --------------------------------------------------------------

function blocksFor(boxes: Options["boxes"]): Array<[number, number]> {
  const seen = new Set<string>();
  const out: Array<[number, number]> = [];
  for (const [w, s, e, n] of mountainBoxes(boxes)) {
    for (let by = latToY(n, BLOCK_Z); by <= latToY(s, BLOCK_Z); by++) {
      for (let bx = lonToX(w, BLOCK_Z); bx <= lonToX(e, BLOCK_Z); bx++) {
        const key = `${bx}/${by}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push([bx, by]);
        }
      }
    }
  }
  return out.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}

interface BlockResult {
  /** Zoom-12 tiles with anything in them, keyed "x/y". */
  tiles: Map<string, Uint8Array>;
  releaseCells: number;
}

async function computeBlock(bx: number, by: number, alphas: number[]): Promise<BlockResult | null> {
  const grid = await blockGrid(bx, by);
  if (!grid) return null;
  const slope = slopeGrid(grid);
  let releaseCells = 0;
  for (let i = 0; i < slope.length; i++) if (slope[i] >= 30 && slope[i] <= 60) releaseCells++;
  const tiles = new Map<string, Uint8Array>();
  if (!releaseCells) return { tiles, releaseCells };
  const flow = flowNeighbours(grid);
  const classes = new Uint8Array(GRID * GRID);
  for (const alpha of alphas) {
    const reached = reachedCells(grid, slope, flow, alpha);
    for (let i = 0; i < classes.length; i++) if (reached[i]) classes[i]++;
  }
  for (let i = 0; i < classes.length; i++) if (!(slope[i] < STEEP)) classes[i] = 0;
  const per = 2 ** (OUT_Z - BLOCK_Z);
  for (let ty = 0; ty < per; ty++) {
    for (let tx = 0; tx < per; tx++) {
      const x = bx * per + tx;
      const y = by * per + ty;
      if (tileInNorwayOnly(OUT_Z, x, y, NORWAY_MARGIN_KM)) continue;
      const t = cut(classes, GRID, CORE + tx * TILE, CORE + ty * TILE);
      if (t.some((v) => v > 0)) tiles.set(`${x}/${y}`, t);
    }
  }
  return { tiles, releaseCells };
}

/** The block's zoom-12 tiles plus their parents up to the block's own zoom-9 tile. */
function pyramid(bx: number, by: number, z12: Map<string, Uint8Array>): Array<{ z: number; x: number; y: number; data: Uint8Array }> {
  const out: Array<{ z: number; x: number; y: number; data: Uint8Array }> = [];
  let level = z12;
  for (const [key, data] of level) {
    const [x, y] = key.split("/").map(Number);
    out.push({ z: OUT_Z, x, y, data });
  }
  for (let z = OUT_Z - 1; z >= BLOCK_Z; z--) {
    const next = new Map<string, Uint8Array>();
    const per = 2 ** (z - BLOCK_Z);
    for (let y = by * per; y < (by + 1) * per; y++) {
      for (let x = bx * per; x < (bx + 1) * per; x++) {
        const kids = [level.get(`${2 * x}/${2 * y}`), level.get(`${2 * x + 1}/${2 * y}`), level.get(`${2 * x}/${2 * y + 1}`), level.get(`${2 * x + 1}/${2 * y + 1}`)];
        const p = parentOf(kids.map((k) => k ?? null));
        if (p) {
          next.set(`${x}/${y}`, p);
          out.push({ z, x, y, data: p });
        }
      }
    }
    level = next;
  }
  return out;
}

// ---- calibration against NVE (Norway) ------------------------------------

/** Norwegian mountains with NVE's runout map, chosen to resemble the Swedish fjäll; whole blocks in Norway. */
const CALIBRATION = [
  { name: "Rondane", lat: 61.9, lon: 9.8 },
  { name: "Trollheimen", lat: 62.8, lon: 9.2 },
  { name: "Sulitjelma", lat: 67.1, lon: 15.8 },
  { name: "Skjomen (Narvik)", lat: 68.25, lon: 17.1 },
];
const CALIBRATION_ALPHAS = [18, 20, 22, 24, 26, 28, 30, 32, 34];

async function nveTile(x: number, y: number): Promise<Int8Array | null> {
  const res = await fetchWithRetry(NVE_RUNOUT.replace("{z}", String(OUT_Z)).replace("{x}", String(x)).replace("{y}", String(y)));
  if (!res) return null;
  const { data, info } = await sharp(Buffer.from(await res.arrayBuffer())).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = new Int8Array(TILE * TILE);
  for (let i = 0; i < out.length; i++) out[i] = nveClass(data[i * 4], data[i * 4 + 1], data[i * 4 + 2], data[i * 4 + 3]);
  void info;
  return out;
}

async function calibrate() {
  // stats[alpha][k] for NVE's cumulative zones k = 1 (any), 2 (medium or short), 3 (short).
  const stats = new Map<number, Array<{ both: number; ours: number; nve: number }>>();
  for (const a of CALIBRATION_ALPHAS) stats.set(a, [1, 2, 3].map(() => ({ both: 0, ours: 0, nve: 0 })));
  for (const place of CALIBRATION) {
    const bx = lonToX(place.lon, BLOCK_Z);
    const by = latToY(place.lat, BLOCK_Z);
    const t0 = Date.now();
    const grid = await blockGrid(bx, by);
    if (!grid) {
      console.log(`${place.name}: inga höjddata`);
      continue;
    }
    const slope = slopeGrid(grid);
    const flow = flowNeighbours(grid);
    const reached = new Map(CALIBRATION_ALPHAS.map((a) => [a, reachedCells(grid, slope, flow, a)]));
    const per = 2 ** (OUT_Z - BLOCK_Z);
    let compared = 0;
    for (let ty = 0; ty < per; ty++) {
      for (let tx = 0; tx < per; tx++) {
        const nve = await nveTile(bx * per + tx, by * per + ty);
        if (!nve) continue;
        for (let py = 0; py < TILE; py++) {
          for (let px = 0; px < TILE; px++) {
            const k = nve[py * TILE + px];
            const gi = (CORE + ty * TILE + py) * GRID + CORE + tx * TILE + px;
            if (k < 0 || !(slope[gi] < STEEP)) continue; // steep ground in either map
            compared++;
            for (const a of CALIBRATION_ALPHAS) {
              const ours = reached.get(a)![gi] === 1;
              const s = stats.get(a)!;
              for (let zone = 1; zone <= 3; zone++) {
                const inNve = k >= zone;
                if (ours) s[zone - 1].ours++;
                if (inNve) s[zone - 1].nve++;
                if (ours && inNve) s[zone - 1].both++;
              }
            }
          }
        }
      }
    }
    console.log(`${place.name}: block ${bx}/${by}, ${compared.toLocaleString("sv-SE")} celler jämförda, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  const names = ["lång (alla blå)", "medellång (mörk+mellan)", "kort (mörkblå)"];
  const best: number[] = [];
  for (let zone = 1; zone <= 3; zone++) {
    console.log(`\nNVE:s zon ${names[zone - 1]}: alfa  täckning  träffsäkerhet  IoU`);
    let top = { a: 0, iou: -1 };
    for (const a of CALIBRATION_ALPHAS) {
      const s = stats.get(a)![zone - 1];
      const recall = s.nve ? s.both / s.nve : 0;
      const precision = s.ours ? s.both / s.ours : 0;
      const iou = s.both / Math.max(1, s.ours + s.nve - s.both);
      console.log(`  ${a}°  ${(recall * 100).toFixed(0).padStart(3)} %  ${(precision * 100).toFixed(0).padStart(3)} %  ${iou.toFixed(3)}`);
      if (iou > top.iou) top = { a, iou };
    }
    best.push(top.a);
  }
  console.log(`\nBästa vinklar (kort, medellång, lång): ${[best[2], best[1], best[0]].join(", ")}`);
}

// ---- import / dry run ------------------------------------------------------

async function run(opts: Options) {
  const blocks = blocksFor(opts.boxes).slice(opts.skip, opts.skip + opts.limit);
  console.log(`${blocks.length} block (zoom ${BLOCK_Z}), vinklar ${opts.alphas.join("/")}°, läge ${opts.mode}`);
  const token = opts.mode === "import" ? createUploadToken() : null;
  if (opts.mode === "dry-run") mkdirSync("runout-prov", { recursive: true });
  const z9 = new Map<string, Uint8Array>();
  let batch: Tile[] = [];
  let batchBytes = 0;
  let uploaded = 0;
  let totalBytes = 0;
  const flush = async () => {
    if (!batch.length) return;
    if (token) await uploadTiles(token, "runout", batch);
    uploaded += batch.length;
    batch = [];
    batchBytes = 0;
  };
  const add = async (t: { z: number; x: number; y: number; data: Uint8Array }) => {
    const png = encodeRunoutPng(t.data);
    totalBytes += png.length;
    if (opts.mode === "dry-run" && t.z === OUT_Z && uploaded + batch.length < 40) writeFileSync(`runout-prov/${t.z}-${t.x}-${t.y}.png`, png);
    batch.push({ z: t.z, x: t.x, y: t.y, data: png });
    batchBytes += png.length;
    if (batch.length >= BATCH_TILES || batchBytes >= BATCH_BYTES) await flush();
  };
  const started = Date.now();
  for (let i = 0; i < blocks.length; i++) {
    const [bx, by] = blocks[i];
    const t0 = Date.now();
    const result = await computeBlock(bx, by, opts.alphas);
    if (result) {
      for (const t of pyramid(bx, by, result.tiles)) {
        if (t.z === BLOCK_Z) z9.set(`${t.x}/${t.y}`, t.data);
        await add(t);
      }
    }
    const left = ((Date.now() - started) / (i + 1)) * (blocks.length - i - 1);
    console.log(
      `${opts.skip + i + 1}/${opts.skip + blocks.length} block ${bx}/${by}: ${result?.tiles.size ?? 0} bitar, ${(result?.releaseCells ?? 0).toLocaleString("sv-SE")} utlösningsceller, ${((Date.now() - t0) / 1000).toFixed(0)} s (kvar ca ${Math.round(left / 60000)} min)`
    );
  }
  // Zoom 8 and below from the zoom-9 tiles (across blocks).
  let level = z9;
  for (let z = BLOCK_Z - 1; z >= MIN_Z; z--) {
    const parents = new Map<string, Uint8Array>();
    const keys = new Set([...level.keys()].map((k) => k.split("/").map((v) => Math.floor(Number(v) / 2)).join("/")));
    for (const key of keys) {
      const [x, y] = key.split("/").map(Number);
      const p = parentOf([level.get(`${2 * x}/${2 * y}`) ?? null, level.get(`${2 * x + 1}/${2 * y}`) ?? null, level.get(`${2 * x}/${2 * y + 1}`) ?? null, level.get(`${2 * x + 1}/${2 * y + 1}`) ?? null]);
      if (!p) continue;
      parents.set(key, p);
      await add({ z, x, y, data: p });
    }
    level = parents;
  }
  await flush();
  console.log(`${uploaded.toLocaleString("sv-SE")} bitar, ${(totalBytes / 1e6).toFixed(1)} MB, ${Math.round((Date.now() - started) / 60000)} min${token ? " – uppladdade" : " (inget uppladdat)"}`);
  if (token && opts.skip === 0 && opts.limit === Infinity) {
    const res = await fetch(`${WORKER}/admin/tiles/runout/meta`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ made: new Date().toISOString(), alphas: opts.alphas, minZoom: MIN_Z, maxZoom: OUT_Z, model: "alfavinkel v1" }),
    });
    console.log(`Metadata: HTTP ${res.status}`);
    if (!res.ok) process.exit(1);
  }
}

const opts = parseArgs(process.argv.slice(2));
if (opts.mode === "calibrate") await calibrate();
else await run(opts);
