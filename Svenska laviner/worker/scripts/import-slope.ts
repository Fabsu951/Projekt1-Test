// Builds the detailed slope map ("Lutning, detaljerad") from Lantmäteriet's
// height model ("Markhöjdmodell Nedladdning, grid 1+", GeoTIFF, SWEREF 99 TM)
// and uploads the tiles to R2 through the worker, like import-tiles.ts does
// for the topographic map. Only the three mountain boxes; zoom 12–15 (the app
// enlarges beyond 15). Tiles with no ground of 30° or more are not stored.
//
// From the worker folder (fetch-hojd.ps1 runs this for you):
//   npx tsx scripts/import-slope.ts C:\Nedladdningar\hojd              (downloaded .tif files)
//   npx tsx scripts/import-slope.ts --items stac-items-hojd.json      (straight from Lantmäteriet; login in env LM_AUTH)
// Options: --dry-run (render a few areas into ./slope-prov and estimate, nothing uploaded),
//          --box norra|mitten|sodra (one box only), --skip <n> (continue after n areas).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { MOUNTAIN_BOXES } from "../src/gpkgTiles";
import type { Tile } from "../src/tileBatch";
import { filesFromStac, filesInFolder, HeightModel, project, type DemFile } from "./dem";
import { encodeBandsPng, mergeChildren, renderSlopeTile, tileLat, tileLon } from "./slopeRender";
import { createUploadToken, uploadTiles, WORKER } from "./uploadClient";

const BLOCK_ZOOM = 12;
const MAX_ZOOM = 15;
const BATCH_TILES = 40;
const BATCH_BYTES = 1024 * 1024;
const PARALLEL = 8;
const DRY_RUN_BLOCKS = 3;

interface Options {
  folder: string | null;
  items: string | null;
  dryRun: boolean;
  box: string | null;
  skip: number;
}

function parseArgs(argv: string[]): Options {
  const opts: Options = { folder: null, items: null, dryRun: false, box: null, skip: 0 };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--items") opts.items = argv[++i];
    else if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--box") opts.box = argv[++i];
    else if (arg === "--skip") opts.skip = Number(argv[++i]);
    else opts.folder = arg;
  }
  if (!opts.folder && !opts.items) {
    console.error("Ange en mapp med .tif-filer eller --items <stac-items.json>.");
    process.exit(1);
  }
  if (opts.box && !(opts.box in MOUNTAIN_BOXES)) {
    console.error(`Okänd ruta "${opts.box}". Välj ${Object.keys(MOUNTAIN_BOXES).join(", ")}.`);
    process.exit(1);
  }
  return opts;
}

const lonToX = (lon: number, z: number) => Math.floor(((lon + 180) / 360) * 2 ** z);
const latToY = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
};

/** z12 tiles inside the chosen mountain boxes that some height file overlaps. */
function blocks(files: DemFile[], box: string | null): Array<[number, number]> {
  const out = new Map<string, [number, number]>();
  for (const [name, [w, s, e, n]] of Object.entries(MOUNTAIN_BOXES)) {
    if (box && box !== name) continue;
    for (let x = lonToX(w, BLOCK_ZOOM); x <= lonToX(e, BLOCK_ZOOM); x++) {
      for (let y = latToY(n, BLOCK_ZOOM); y <= latToY(s, BLOCK_ZOOM); y++) {
        const bw = tileLon(x, BLOCK_ZOOM), be = tileLon(x + 1, BLOCK_ZOOM);
        const bn = tileLat(y, BLOCK_ZOOM), bs = tileLat(y + 1, BLOCK_ZOOM);
        if (files.some((f) => f.lonLat[0] < be && f.lonLat[2] > bw && f.lonLat[1] < bn && f.lonLat[3] > bs)) out.set(`${x}/${y}`, [x, y]);
      }
    }
  }
  return [...out.values()].sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}

/** SWEREF 99 TM box of a tile, with a margin for the slope step. */
function swerefArea(z: number, x: number, y: number): [number, number, number, number] {
  const corners = [
    project(tileLon(x, z), tileLat(y, z)),
    project(tileLon(x + 1, z), tileLat(y, z)),
    project(tileLon(x, z), tileLat(y + 1, z)),
    project(tileLon(x + 1, z), tileLat(y + 1, z)),
  ];
  const m = 10;
  return [
    Math.min(...corners.map((c) => c[0])) - m,
    Math.min(...corners.map((c) => c[1])) - m,
    Math.max(...corners.map((c) => c[0])) + m,
    Math.max(...corners.map((c) => c[1])) + m,
  ];
}

/** All tiles z12–15 of one z12 block, steepest band kept when zooming out. */
function renderBlock(model: HeightModel, bx: number, by: number): Tile[] {
  const levels = new Map<number, Map<string, Uint8Array | null>>();
  const scale = 2 ** (MAX_ZOOM - BLOCK_ZOOM);
  const finest = new Map<string, Uint8Array | null>();
  for (let y = by * scale; y < (by + 1) * scale; y++) {
    for (let x = bx * scale; x < (bx + 1) * scale; x++) finest.set(`${x}/${y}`, renderSlopeTile(MAX_ZOOM, x, y, model.height, project));
  }
  levels.set(MAX_ZOOM, finest);
  for (let z = MAX_ZOOM - 1; z >= BLOCK_ZOOM; z--) {
    const children = levels.get(z + 1)!;
    const here = new Map<string, Uint8Array | null>();
    const n = 2 ** (z - BLOCK_ZOOM);
    for (let y = by * n; y < (by + 1) * n; y++) {
      for (let x = bx * n; x < (bx + 1) * n; x++) {
        here.set(
          `${x}/${y}`,
          mergeChildren([
            children.get(`${2 * x}/${2 * y}`) ?? null,
            children.get(`${2 * x + 1}/${2 * y}`) ?? null,
            children.get(`${2 * x}/${2 * y + 1}`) ?? null,
            children.get(`${2 * x + 1}/${2 * y + 1}`) ?? null,
          ])
        );
      }
    }
    levels.set(z, here);
  }
  const tiles: Tile[] = [];
  for (const [z, map] of levels) {
    for (const [key, bands] of map) {
      if (!bands) continue;
      const [x, y] = key.split("/").map(Number);
      tiles.push({ z, x, y, data: encodeBandsPng(bands) });
    }
  }
  return tiles;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const files = opts.items
    ? filesFromStac(JSON.parse(readFileSync(opts.items, "utf8").replace(/^\uFEFF/, "")), process.env.LM_AUTH)
    : await filesInFolder(opts.folder!);
  if (files.length === 0) {
    console.error("Hittade inga GeoTIFF-filer med höjddata.");
    process.exit(1);
  }
  const todo = blocks(files, opts.box);
  console.log(`${files.length} höjdfiler, ${todo.length} områden (z12) att räkna${opts.skip ? `, hoppar över de första ${opts.skip}` : ""}.`);

  const model = new HeightModel(files);
  const token = opts.dryRun ? "" : createUploadToken();
  const started = Date.now();
  let uploaded = 0;
  let pending: Tile[] = [];
  let pendingBytes = 0;
  const inFlight = new Set<Promise<void>>();
  const flush = async () => {
    if (!pending.length) return;
    const batch = pending;
    pending = [];
    pendingBytes = 0;
    if (opts.dryRun) return;
    const p = uploadTiles(token, "slope", batch)
      .then(() => {
        uploaded += batch.length;
      })
      .finally(() => inFlight.delete(p));
    inFlight.add(p);
    if (inFlight.size >= PARALLEL) await Promise.race(inFlight);
  };

  let done = 0;
  let rendered = 0;
  const outDir = join(process.cwd(), "slope-prov");
  if (opts.dryRun) mkdirSync(outDir, { recursive: true });
  for (let i = opts.skip; i < todo.length; i++) {
    const [bx, by] = todo[i];
    const covering = await model.prepare(swerefArea(BLOCK_ZOOM, bx, by));
    const tiles = covering ? renderBlock(model, bx, by) : [];
    rendered += tiles.length;
    if (opts.dryRun) {
      for (const t of tiles.filter((t) => t.z === MAX_ZOOM).slice(0, 4)) writeFileSync(join(outDir, `${t.z}-${t.x}-${t.y}.png`), t.data);
    }
    for (const t of tiles) {
      pending.push(t);
      pendingBytes += t.data.length;
      if (pending.length >= BATCH_TILES || pendingBytes >= BATCH_BYTES) await flush();
    }
    done++;
    const perBlock = (Date.now() - started) / done;
    const left = Math.round((perBlock * (todo.length - i - 1)) / 60_000);
    console.log(`Område ${i + 1}/${todo.length} (z12 ${bx}/${by}): ${tiles.length} rutor med brant terräng. Kvar: ca ${left} min. Hoppa hit med --skip ${i + 1}.`);
    if (opts.dryRun && done >= DRY_RUN_BLOCKS) break;
  }
  await flush();
  await Promise.all(inFlight);

  if (opts.dryRun) {
    const perBlock = (Date.now() - started) / Math.max(1, done);
    console.log(`Provkörning klar: ${rendered} rutor från ${done} områden. Exempel i ${outDir}.`);
    console.log(`Hela importen beräknas ta ca ${Math.round((perBlock * todo.length) / 3_600_000)} timmar.`);
    return;
  }

  const meta = { updated: new Date().toISOString(), minZoom: BLOCK_ZOOM, maxZoom: MAX_ZOOM, source: "Lantmäteriet, Markhöjdmodell Nedladdning, grid 1+" };
  const res = await fetch(`${WORKER}/admin/tiles/slope/meta`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(meta),
  });
  if (!res.ok) console.error(`Kunde inte spara att lutningskartan finns: HTTP ${res.status}`);
  console.log(`Klart: ${uploaded} rutor uppladdade. Lagret "Lutning, detaljerad" syns nu i appen.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
