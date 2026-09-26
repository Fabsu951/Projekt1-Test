// Uploads Lantmäteriet's "Topografisk webbkarta Nedladdning, raster"
// (GeoPackage, EPSG:3857) to our R2 bucket through the worker, so the map
// keeps working after the free WMTS closes on 2026-12-31.
//
// From the worker folder:
//   npx tsx scripts/import-tiles.ts C:\Nedladdningar\*.gpkg
//
// Options: --max-zoom 15 (default; the app zooms in further from there),
//          --table <name> (which tile table, if the file has several),
//          --dry-run (just count what would be uploaded).
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { encodeTiles, imageType, validTile, type Tile } from "../src/tileBatch";
import { mapLevel, type LevelMapping, type TileMatrix, type TileMatrixSet } from "../src/gpkgTiles";

const WORKER = process.env.FJALLKOLL_WORKER_URL ?? "https://fjallkoll-worker.fabian-n-sund.workers.dev";
// Well inside a Worker invocation's limits on the free plan.
const BATCH_TILES = 200;
const BATCH_BYTES = 8 * 1024 * 1024;
const PARALLEL = 4;

interface Options {
  files: string[];
  maxZoom: number;
  table: string | null;
  dryRun: boolean;
}

function parseArgs(argv: string[]): Options {
  const opts: Options = { files: [], maxZoom: 15, table: null, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--max-zoom") opts.maxZoom = Number(argv[++i]);
    else if (arg === "--table") opts.table = argv[++i];
    else if (arg === "--dry-run") opts.dryRun = true;
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

/** The tile table to import and how each of its levels maps onto z/x/y. */
function describe(db: import("node:sqlite").DatabaseSync, wanted: string | null) {
  const tables = db
    .prepare("SELECT table_name FROM gpkg_contents WHERE data_type = 'tiles'")
    .all()
    .map((r) => String((r as Row).table_name));
  if (tables.length === 0) throw new Error("Filen innehåller inga tiles.");
  // Lantmäteriet ships a coloured and a toned-down ("nedtonad") layer; we want the coloured one.
  const table = wanted ?? tables.find((t) => !/nedton|grey|gray/i.test(t)) ?? tables[0];
  if (!tables.includes(table)) throw new Error(`Tabellen ${table} finns inte. Finns: ${tables.join(", ")}`);

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

async function upload(token: string, tiles: Tile[]): Promise<void> {
  const body = encodeTiles(tiles);
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(`${WORKER}/admin/tiles/topowebb`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/octet-stream" },
        body,
      });
      if (res.ok) return;
      if (res.status === 401) throw Object.assign(new Error("Workern godkände inte uppladdningsnyckeln."), { fatal: true });
      throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    } catch (err) {
      if ((err as { fatal?: boolean }).fatal || attempt >= 4) throw err;
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
}

/** A fresh random upload token, stored as a worker secret for this run. */
function createUploadToken(): string {
  if (process.env.TILE_UPLOAD_TOKEN) return process.env.TILE_UPLOAD_TOKEN;
  const token = randomBytes(32).toString("base64url");
  const result = spawnSync("npx", ["wrangler", "secret", "put", "TILE_UPLOAD_TOKEN"], {
    input: token,
    stdio: ["pipe", "inherit", "inherit"],
    shell: true,
  });
  if (result.status !== 0) {
    console.error("Kunde inte spara uppladdningsnyckeln på workern. Är du inloggad (npx wrangler login)?");
    process.exit(1);
  }
  return token;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const token = opts.dryRun ? "" : createUploadToken();
  let total = 0;
  let skipped = 0;
  const started = Date.now();

  for (const file of opts.files) {
    const db = await openDatabase(file);
    const { tables, table, levels } = describe(db, opts.table);
    const wanted = levels.filter((l) => l.z <= opts.maxZoom);
    console.log(`\n${file}\n  tabell: ${table}${tables.length > 1 ? ` (finns även: ${tables.filter((t) => t !== table).join(", ")})` : ""}`);
    console.log(`  zoomnivåer: ${wanted.map((l) => l.z).join(", ")}${wanted.length < levels.length ? ` (hoppar över nivåer över ${opts.maxZoom})` : ""}`);

    const byLevel = new Map<number, LevelMapping>(wanted.map((l) => [l.gpkgLevel, l]));
    const rows = db
      .prepare(`SELECT zoom_level AS level, tile_column AS col, tile_row AS row, tile_data AS data FROM "${table.replace(/"/g, '""')}"`)
      .iterate();

    let batch: Tile[] = [];
    let batchBytes = 0;
    const inFlight = new Set<Promise<void>>();
    const flush = async () => {
      if (batch.length === 0) return;
      const tiles = batch;
      batch = [];
      batchBytes = 0;
      if (opts.dryRun) return;
      const p = upload(token, tiles).finally(() => inFlight.delete(p));
      inFlight.add(p);
      if (inFlight.size >= PARALLEL) await Promise.race(inFlight);
    };

    for (const raw of rows) {
      const r = raw as Row;
      const level = byLevel.get(Number(r.level));
      if (!level) continue;
      const data = r.data as Uint8Array;
      const z = level.z;
      const x = Number(r.col) + level.offsetX;
      const y = Number(r.row) + level.offsetY;
      if (!data?.length || !imageType(data) || !validTile(z, x, y)) {
        skipped++;
        continue;
      }
      batch.push({ z, x, y, data });
      batchBytes += data.length;
      total++;
      if (total % 5000 === 0) console.log(`  ${total.toLocaleString("sv-SE")} tiles…`);
      if (batch.length >= BATCH_TILES || batchBytes >= BATCH_BYTES) await flush();
    }
    await flush();
    await Promise.all(inFlight);
    db.close();
  }

  const minutes = ((Date.now() - started) / 60000).toFixed(1);
  console.log(
    `\n${opts.dryRun ? "Skulle ladda upp" : "Klart! Laddade upp"} ${total.toLocaleString("sv-SE")} tiles` +
      `${skipped ? ` (hoppade över ${skipped})` : ""} på ${minutes} min.`
  );
}

main().catch((err) => {
  console.error(`\nFel: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
