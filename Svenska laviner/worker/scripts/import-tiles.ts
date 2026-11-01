// Uploads Lantmäteriet's "Topografisk webbkarta Nedladdning, raster"
// (GeoPackage, EPSG:3857) to our R2 bucket through the worker, so the map
// keeps working after the free WMTS closes on 2026-12-31.
//
// From the worker folder:
//   npx tsx scripts/import-tiles.ts C:\Nedladdningar\*.gpkg
// or straight from Lantmäteriet with HTTP Range requests, no download
// (fetch-topowebb.ps1 -DryRun / -Import does this with the login):
//   npx tsx scripts/import-tiles.ts https://…/topowebb-3857.gpkg
// or straight from Lantmäteriet without downloading (fetch-topowebb.ps1 -Import
// does this with the login): npx tsx scripts/import-tiles.ts https://…/topowebb-3857.gpkg
//
// Options: --max-zoom 15 (default; the app zooms in further from there),
//          --min-zoom <n> (skip the levels below, e.g. to add zoom 16 only),
//          --table <name> (which tile table, if the file has several),
//          --boxes main|more|all (which mountain boxes: MOUNTAIN_BOXES (default),
//                 MORE_MOUNTAIN_BOXES along the border, or both),
//          --all (all of the file, not just the mountain areas),
//          --skip <n> (remote only: continue after the first n tiles of an interrupted run),
//          --dry-run (just count what would be uploaded).
//
// Lantmäteriet ships all of Sweden in one ~145 GB file. By default only the
// three mountain boxes (MOUNTAIN_BOXES) are read, plus every tile up to zoom
// OVERVIEW_MAX_ZOOM, via the tile table's index, so the rest is never touched.
import { imageType, validTile, type Tile } from "../src/tileBatch";
import { createUploadToken, uploadTiles } from "./uploadClient";
import { RemoteGpkg } from "./remoteGpkg";
import { httpReader } from "./remoteSqlite";
import {
  gpkgRange,
  mapLevel,
  MORE_MOUNTAIN_BOXES,
  MOUNTAIN_BOXES,
  mountainBoxes,
  OVERVIEW_MAX_ZOOM,
  type BoxSet,
  type LevelMapping,
  type TileMatrix,
  type TileMatrixSet,
} from "../src/gpkgTiles";
// The app never asks for Lantmäteriet's (white) tiles wholly in Norway – Kartverket's map covers them.
import { tileInNorwayOnly } from "../../app/src/utils/norwayTiles";

// Well inside a Worker invocation's limits on the free plan.
// Small batches: on the free plan a Worker gets ~10 ms CPU per request, and
// 200 tiles per request hit "Worker exceeded resource limits" (1102) on 2026-10-07.
const BATCH_TILES = 40;
const BATCH_BYTES = 1024 * 1024;
// Uploads in flight at once; each is small, so more of them keep the line busy.
const PARALLEL = 10;

interface Options {
  files: string[];
  maxZoom: number;
  minZoom: number;
  table: string | null;
  dryRun: boolean;
  all: boolean;
  skip: number;
  boxes: BoxSet;
}

function parseArgs(argv: string[]): Options {
  const opts: Options = { files: [], maxZoom: 15, minZoom: 0, table: null, dryRun: false, all: false, skip: 0, boxes: "main" };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--max-zoom") opts.maxZoom = Number(argv[++i]);
    else if (arg === "--min-zoom") opts.minZoom = Number(argv[++i]);
    else if (arg === "--table") opts.table = argv[++i];
    else if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--all") opts.all = true;
    else if (arg === "--boxes") {
      const set = argv[++i];
      if (set !== "main" && set !== "more" && set !== "all") {
        console.error("--boxes ska vara main, more eller all.");
        process.exit(1);
      }
      opts.boxes = set;
    }
    else if (arg === "--skip") opts.skip = Math.max(0, Math.floor(Number(argv[++i]) || 0));
    else opts.files.push(arg);
  }
  if (opts.files.length === 0) {
    console.error("Ange minst en .gpkg-fil, t.ex.: npx tsx scripts/import-tiles.ts C:\\Nedladdningar\\*.gpkg");
    process.exit(1);
  }
  if (!Number.isInteger(opts.maxZoom) || opts.maxZoom < 0 || opts.maxZoom > 17) {
    console.error("--max-zoom ska vara ett heltal 0–17.");
    process.exit(1);
  }
  return opts;
}

type Row = Record<string, unknown>;

async function openDatabase(file: string) {
  // node:sqlite prints an "experimental" warning that only confuses here.
  process.removeAllListeners("warning");
  let sqlite: typeof import("node:sqlite");
  try {
    sqlite = await import("node:sqlite");
  } catch {
    console.error("Din Node.js saknar inbyggd SQLite. Uppdatera till Node 22.13 eller senare: https://nodejs.org");
    process.exit(1);
  }
  return new sqlite.DatabaseSync(file, { readOnly: true });
}

function pickTable(tables: string[], wanted: string | null): string {
  if (tables.length === 0) throw new Error("Filen innehåller inga tiles.");
  // Lantmäteriet ships a coloured and a toned-down ("nedtonad") layer; we want the coloured one.
  const table = wanted ?? tables.find((t) => !/nedton|grey|gray/i.test(t)) ?? tables[0];
  if (!tables.includes(table)) throw new Error(`Tabellen ${table} finns inte. Finns: ${tables.join(", ")}`);
  return table;
}

/** The tile table to import and how each of its levels maps onto z/x/y. */
function describe(db: import("node:sqlite").DatabaseSync, wanted: string | null) {
  const tables = db
    .prepare("SELECT table_name FROM gpkg_contents WHERE data_type = 'tiles'")
    .all()
    .map((r) => String((r as Row).table_name));
  const table = pickTable(tables, wanted);

  const set = db
    .prepare(
      `SELECT s.min_x AS minX, s.max_y AS maxY, s.srs_id AS srsId,
              r.organization AS org, r.organization_coordsys_id AS code
       FROM gpkg_tile_matrix_set s LEFT JOIN gpkg_spatial_ref_sys r ON r.srs_id = s.srs_id
       WHERE s.table_name = ?`
    )
    .get(table) as Row | undefined;
  if (!set) throw new Error(`Hittar inget tile matrix set för ${table}.`);
  const srs = String(set.org ?? "").toUpperCase() === "EPSG" ? Number(set.code) : Number(set.srsId);
  const matrixSet: TileMatrixSet = { srs, minX: Number(set.minX), maxY: Number(set.maxY) };

  const levels = db
    .prepare(
      `SELECT zoom_level AS zoomLevel, tile_width AS tileWidth, tile_height AS tileHeight,
              pixel_x_size AS pixelXSize, pixel_y_size AS pixelYSize
       FROM gpkg_tile_matrix WHERE table_name = ? ORDER BY zoom_level`
    )
    .all(table)
    .map((r) => mapLevel(matrixSet, r as unknown as TileMatrix));
  return { tables, table, levels };
}


const SELECT_TILES = (table: string) =>
  `SELECT zoom_level AS level, tile_column AS col, tile_row AS row, tile_data AS data FROM "${table.replace(/"/g, '""')}"`;

/** The rows to import: everything, or per level only the mountain boxes (uses the table's unique index). */
function* tileRows(db: import("node:sqlite").DatabaseSync, table: string, levels: LevelMapping[], all: boolean, boxes: BoxSet): Generator<unknown> {
  if (all) {
    yield* db.prepare(SELECT_TILES(table)).iterate();
    return;
  }
  const whole = db.prepare(`${SELECT_TILES(table)} WHERE zoom_level = ?`);
  const box = db.prepare(
    `${SELECT_TILES(table)} WHERE zoom_level = ? AND tile_column BETWEEN ? AND ? AND tile_row BETWEEN ? AND ?`
  );
  for (const level of levels) {
    if (level.z <= OVERVIEW_MAX_ZOOM) {
      yield* whole.iterate(level.gpkgLevel);
      continue;
    }
    // The boxes don't overlap, so no tile comes twice.
    for (const area of mountainBoxes(boxes)) {
      const r = gpkgRange(level, area);
      yield* box.iterate(level.gpkgLevel, r.minX, r.maxX, r.minY, r.maxY);
    }
  }
}

interface TileSource {
  label: string;
  tables: string[];
  table: string;
  levels: LevelMapping[];
  rows(wanted: LevelMapping[]): AsyncIterable<Row> | Iterable<Row>;
  /** Counts without reading every tile (remote files). */
  dryRun?(wanted: LevelMapping[]): Promise<{ total: number; skipped: number }>;
  progress?(): string;
  /** Tiles this run will handle, once known (for the time estimate). */
  planned?(): number | null;
  close(): void;
}

async function openLocal(file: string, opts: Options): Promise<TileSource> {
  const db = await openDatabase(file);
  const { tables, table, levels } = describe(db, opts.table);
  return {
    label: file,
    tables,
    table,
    levels,
    rows: (wanted) => tileRows(db, table, wanted, opts.all, opts.boxes) as Iterable<Row>,
    close: () => db.close(),
  };
}

/** Drops tiles wholly in Norway (see tileInNorwayOnly) – they're white and the app never asks for them. */
function withoutNorway<K extends { level: number; col: number; row: number }>(keys: K[], levels: LevelMapping[]): K[] {
  const byLevel = new Map(levels.map((l) => [l.gpkgLevel, l]));
  const kept = keys.filter((k) => {
    const l = byLevel.get(k.level);
    return !l || !tileInNorwayOnly(l.z, k.col + l.offsetX, k.row + l.offsetY);
  });
  if (kept.length < keys.length) console.log(`  ${(keys.length - kept.length).toLocaleString("sv-SE")} kartbitar helt i Norge hoppas över`);
  return kept;
}

/**
 * The GeoPackage read straight from Lantmäteriet with HTTP Range requests,
 * so the ~145 GB file never has to be downloaded. The Authorization header
 * comes from the LM_AUTH environment variable (set by fetch-topowebb.ps1).
 */
async function openRemote(url: string, opts: Options): Promise<TileSource> {
  if (opts.all) throw new Error("--all går bara med en nedladdad fil.");
  const reader = httpReader(url, process.env.LM_AUTH ? { Authorization: process.env.LM_AUTH } : {});
  const gpkg = await RemoteGpkg.open(reader);
  const tables = await gpkg.tileTables();
  if (tables.length === 0) {
    console.error(`\nHittade ingen tabell med kartbitar. Filen innehåller:\n${await gpkg.describeSchema()}`);
  }
  const table = pickTable(tables, opts.table);
  const set = await gpkg.matrixSet(table);
  const levels = (await gpkg.matrices(table)).map((m) => mapLevel(set, m));
  const mb = () => `(${reader.requests.toLocaleString("sv-SE")} anrop, ${(reader.bytes / 1e6).toFixed(0)} MB hämtat)`;
  let plannedCount: number | null = null;
  const label = url.replace(/\?.*$/, "");
  return {
    label,
    tables,
    table,
    levels,
    async *rows(wanted) {
      console.log("  letar upp kartbitarna i filens index…");
      const keys = withoutNorway(await gpkg.tileKeys(table, wanted, 6, mountainBoxes(opts.boxes)), wanted);
      console.log(`  ${keys.length.toLocaleString("sv-SE")} kartbitar att hämta ${mb()}`);
      if (opts.skip) console.log(`  hoppar över de första ${opts.skip.toLocaleString("sv-SE")} (--skip)`);
      plannedCount = Math.max(0, keys.length - opts.skip);
      // Fewer, larger reads (e.g. through the worker's proxy, whose requests count
      // against the free plan's 100 000 a day): IMPORT_CHUNK / IMPORT_GAP / IMPORT_MAX_PAGES.
      const env = (name: string) => Number(process.env[name]) || undefined;
      yield* gpkg.tiles(table, keys.slice(opts.skip), env("IMPORT_CHUNK"), 3, env("IMPORT_GAP"), env("IMPORT_MAX_PAGES")) as AsyncIterable<Row>;
    },
    async dryRun(wanted) {
      console.log("  letar upp kartbitarna i filens index…");
      const keys = withoutNorway(await gpkg.tileKeys(table, wanted, 6, mountainBoxes(opts.boxes)), wanted);
      const byLevel = new Map(wanted.map((l) => [l.gpkgLevel, l]));
      const perZoom = new Map<number, number>();
      for (const k of keys) {
        const z = byLevel.get(k.level)!.z;
        perZoom.set(z, (perZoom.get(z) ?? 0) + 1);
      }
      console.log(`  per zoom: ${[...perZoom].sort((a, b) => a[0] - b[0]).map(([z, n]) => `${z}: ${n.toLocaleString("sv-SE")}`).join(", ")}`);
      // Read a handful of tiles spread over the list to check they are real images.
      const sample = Array.from({ length: Math.min(12, keys.length) }, (_, i) => keys[Math.floor((i * keys.length) / Math.min(12, keys.length))]);
      let ok = 0;
      let bytes = 0;
      for await (const t of gpkg.tiles(table, sample)) {
        if (t.data.length && imageType(t.data)) ok++;
        bytes += t.data.length;
      }
      console.log(`  stickprov: ${ok} av ${sample.length} är giltiga bilder, i snitt ${sample.length ? Math.round(bytes / sample.length / 1000) : 0} kB ${mb()}`);
      if (sample.length && ok === 0) throw new Error("Inga giltiga kartbilder i stickprovet.");
      const gb = sample.length ? ((bytes / sample.length) * keys.length) / 1e9 : 0;
      console.log(`  uppskattad storlek: ca ${gb.toFixed(1)} GB`);
      return { total: keys.length, skipped: 0 };
    },
    progress: mb,
    planned: () => plannedCount,
    close: () => {},
  };
}

/** Tiles handled so far (incl. --skip), for the "continue with --skip" hint. */
let lastReported = 0;

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const token = opts.dryRun ? "" : createUploadToken();
  let total = 0;
  let skipped = 0;
  const started = Date.now();
  let runStarted = 0;
  /** " – ca 40 min kvar", from this run's pace. */
  const eta = (source: TileSource) => {
    const planned = source.planned?.() ?? null;
    if (!planned || !runStarted || total === 0) return "";
    const perTile = (Date.now() - runStarted) / total;
    const minutes = Math.round(((planned - total) * perTile) / 60000);
    return ` – ca ${minutes < 1 ? "1" : minutes.toLocaleString("sv-SE")} min kvar`;
  };
  // A sign of life every minute, so a slow stretch doesn't look like a hang.
  let lastTotal = -1;
  const heartbeat = setInterval(() => {
    if (total === lastTotal) {
      console.log(`  … väntar på svar (${new Date().toLocaleTimeString("sv-SE")}), ${(total + opts.skip).toLocaleString("sv-SE")} tiles hittills`);
    }
    lastTotal = total;
  }, 60_000);
  heartbeat.unref();

  for (const file of opts.files) {
    const source = /^https?:\/\//i.test(file) ? await openRemote(file, opts) : await openLocal(file, opts);
    const { tables, table, levels } = source;
    const wanted = levels.filter((l) => l.z <= opts.maxZoom && l.z >= opts.minZoom);
    console.log(`\n${source.label}\n  tabell: ${table}${tables.length > 1 ? ` (finns även: ${tables.filter((t) => t !== table).join(", ")})` : ""}`);
    console.log(`  zoomnivåer: ${wanted.map((l) => l.z).join(", ")}${wanted.length < levels.length ? ` (hoppar över nivåer utanför ${opts.minZoom}–${opts.maxZoom})` : ""}`);
    console.log(`  område: ${opts.all ? "hela filen" : `fjällrutorna (${Object.keys(opts.boxes === "more" ? MORE_MOUNTAIN_BOXES : opts.boxes === "all" ? { ...MOUNTAIN_BOXES, ...MORE_MOUNTAIN_BOXES } : MOUNTAIN_BOXES).join(", ")}), hela filen upp till zoom ${OVERVIEW_MAX_ZOOM}`}`);

    if (opts.dryRun && source.dryRun) {
      const counted = await source.dryRun(wanted);
      total += counted.total;
      skipped += counted.skipped;
      source.close();
      continue;
    }

    const byLevel = new Map<number, LevelMapping>(wanted.map((l) => [l.gpkgLevel, l]));
    let batch: Tile[] = [];
    let batchBytes = 0;
    const inFlight = new Set<Promise<void>>();
    const flush = async () => {
      if (batch.length === 0) return;
      const tiles = batch;
      batch = [];
      batchBytes = 0;
      if (opts.dryRun) return;
      const p = uploadTiles(token, "topowebb", tiles).finally(() => inFlight.delete(p));
      inFlight.add(p);
      if (inFlight.size >= PARALLEL) await Promise.race(inFlight);
    };

    for await (const r of source.rows(wanted)) {
      if (!runStarted) runStarted = Date.now();
      const level = byLevel.get(Number(r.level));
      if (!level) continue;
      const data = r.data as Uint8Array;
      const z = level.z;
      const x = Number(r.col) + level.offsetX;
      const y = Number(r.row) + level.offsetY;
      if (!data?.length || !imageType(data) || !validTile(z, x, y) || (!opts.all && tileInNorwayOnly(z, x, y))) {
        skipped++;
        continue;
      }
      batch.push({ z, x, y, data });
      batchBytes += data.length;
      total++;
      if (total % 5000 === 0) {
        lastReported = total + opts.skip;
        console.log(`  ${lastReported.toLocaleString("sv-SE")} tiles…${source.progress ? ` ${source.progress()}` : ""}${eta(source)}`);
      }
      if (batch.length >= BATCH_TILES || batchBytes >= BATCH_BYTES) await flush();
    }
    await flush();
    await Promise.all(inFlight);
    source.close();
  }

  const minutes = ((Date.now() - started) / 60000).toFixed(1);
  console.log(
    `\n${opts.dryRun ? "Skulle ladda upp" : "Klart! Laddade upp"} ${total.toLocaleString("sv-SE")} tiles` +
      `${skipped ? ` (hoppade över ${skipped})` : ""} på ${minutes} min.`
  );
}

main().catch((err) => {
  console.error(`\nFel: ${err instanceof Error ? err.message : err}`);
  if (lastReported > 0) {
    const skip = Math.max(0, lastReported - 5000);
    console.error(`Fortsätt där det slutade med: fetch-topowebb.ps1 -Import -Skip ${skip} (eller --skip ${skip} direkt till import-tiles.ts)`);
  }
  process.exit(1);
});
