import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HALF_WORLD, mapLevel, MOUNTAIN_BOXES, OVERVIEW_MAX_ZOOM, tileRange } from "../src/gpkgTiles";
import { RemoteGpkg } from "./remoteGpkg";
import { httpReader, indexColumns, tableColumns } from "./remoteSqlite";

// A GeoPackage shaped like Lantmäteriet's (world-anchored Web Mercator pyramid,
// UNIQUE (zoom_level, tile_column, tile_row)), with tiles big enough to spill
// into overflow pages, served over HTTP with Range support.

const tx = (lon: number, z: number) => Math.floor(((lon + 180) / 360) * 2 ** z);
const ty = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
};

/** A fake PNG whose bytes depend on z/x/y, 300 B – 9 kB, so some fit in a page and some overflow. */
function tileBytes(z: number, x: number, y: number): Uint8Array {
  const size = 300 + ((x * 7919 + y * 104729 + z * 13) % 9000);
  const out = new Uint8Array(size);
  out.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  for (let i = 8; i < size; i++) out[i] = (x * 31 + y * 17 + z + i) & 0xff;
  return out;
}

let dir: string;
let server: Server;
let url: string;
let file: string;
const MAX_Z = 11;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "gpkg-"));
  file = join(dir, "sweden.gpkg");
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA page_size = 4096;
    CREATE TABLE gpkg_spatial_ref_sys (srs_name TEXT NOT NULL, srs_id INTEGER NOT NULL PRIMARY KEY, organization TEXT NOT NULL,
      organization_coordsys_id INTEGER NOT NULL, definition TEXT NOT NULL, description TEXT);
    INSERT INTO gpkg_spatial_ref_sys VALUES ('WGS 84 / Pseudo-Mercator', 3857, 'EPSG', 3857, 'PROJCS[...]', NULL);
    CREATE TABLE gpkg_contents (table_name TEXT NOT NULL PRIMARY KEY, data_type TEXT NOT NULL, identifier TEXT UNIQUE);
    INSERT INTO gpkg_contents VALUES ('topowebb_nedtonad', 'tiles', 'n'), ('topowebb', 'tiles', 't');
    CREATE TABLE gpkg_tile_matrix_set (table_name TEXT NOT NULL PRIMARY KEY, srs_id INTEGER NOT NULL,
      min_x DOUBLE NOT NULL, min_y DOUBLE NOT NULL, max_x DOUBLE NOT NULL, max_y DOUBLE NOT NULL);
    CREATE TABLE gpkg_tile_matrix (table_name TEXT NOT NULL, zoom_level INTEGER NOT NULL, matrix_width INTEGER NOT NULL,
      matrix_height INTEGER NOT NULL, tile_width INTEGER NOT NULL, tile_height INTEGER NOT NULL,
      pixel_x_size DOUBLE NOT NULL, pixel_y_size DOUBLE NOT NULL, CONSTRAINT pk_ttm PRIMARY KEY (table_name, zoom_level));
    CREATE TABLE "topowebb" (id INTEGER PRIMARY KEY AUTOINCREMENT, zoom_level INTEGER NOT NULL, tile_column INTEGER NOT NULL,
      tile_row INTEGER NOT NULL, tile_data BLOB NOT NULL, UNIQUE (zoom_level, tile_column, tile_row));
  `);
  db.prepare("INSERT INTO gpkg_tile_matrix_set VALUES ('topowebb', 3857, ?, ?, ?, ?)").run(-HALF_WORLD, -HALF_WORLD, HALF_WORLD, HALF_WORLD);
  const insert = db.prepare(`INSERT INTO "topowebb" (zoom_level, tile_column, tile_row, tile_data) VALUES (?, ?, ?, ?)`);
  db.exec("BEGIN");
  for (let z = 0; z <= MAX_Z; z++) {
    const px = (2 * HALF_WORLD) / 256 / 2 ** z;
    db.prepare("INSERT INTO gpkg_tile_matrix VALUES ('topowebb', ?, ?, ?, 256, 256, ?, ?)").run(z, 2 ** z, 2 ** z, px, px);
    // Inserted row by row (not column by column) so rowid order differs from index order.
    for (let y = ty(69.5, z); y <= ty(55, z); y++) for (let x = tx(10, z); x <= tx(25, z); x++) insert.run(z, x, y, tileBytes(z, x, y));
  }
  db.exec("COMMIT");
  db.close();

  const bytes = readFileSync(file);
  server = createServer((req, res) => {
    if (req.headers.authorization !== "Basic dGVzdDp0ZXN0") {
      res.writeHead(401).end();
      return;
    }
    const m = /^bytes=(\d+)-(\d+)$/.exec(req.headers.range ?? "");
    if (!m) {
      res.writeHead(200).end(bytes);
      return;
    }
    const [start, end] = [Number(m[1]), Math.min(Number(m[2]), bytes.length - 1)];
    res.writeHead(206, { "Content-Range": `bytes ${start}-${end}/${bytes.length}` }).end(bytes.subarray(start, end + 1));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/topowebb-3857.gpkg`;
}, 120_000);

afterAll(() => {
  server?.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("reading a GeoPackage over HTTP Range requests", () => {
  it("parses CREATE TABLE and index column lists", () => {
    expect(tableColumns(`CREATE TABLE "t" (id INTEGER PRIMARY KEY, "zoom_level" INTEGER, tile_data BLOB, UNIQUE (zoom_level, id))`)).toEqual([
      "id",
      "zoom_level",
      "tile_data",
    ]);
    expect(indexColumns(`CREATE UNIQUE INDEX i ON t ("zoom_level", tile_column ASC, [tile_row])`)).toEqual(["zoom_level", "tile_column", "tile_row"]);
  });

  it("finds exactly the tiles SQLite itself finds, with identical bytes", async () => {
    const reader = httpReader(url, { Authorization: "Basic dGVzdDp0ZXN0" });
    const gpkg = await RemoteGpkg.open(reader);
    expect(await gpkg.tileTables()).toEqual(["topowebb_nedtonad", "topowebb"]);
    const set = await gpkg.matrixSet("topowebb");
    expect(set.srs).toBe(3857);
    const levels = (await gpkg.matrices("topowebb")).map((m) => mapLevel(set, m));
    expect(levels.map((l) => l.z)).toEqual([...Array(MAX_Z + 1).keys()]);

    const keys = await gpkg.tileKeys("topowebb", levels);
    const got = new Map<string, Uint8Array>();
    for await (const t of gpkg.tiles("topowebb", keys)) got.set(`${t.level}/${t.col}/${t.row}`, t.data);

    // The same selection straight from SQLite.
    const db = new DatabaseSync(file, { readOnly: true });
    const expected = new Map<string, Uint8Array>();
    const all = db.prepare(`SELECT zoom_level z, tile_column x, tile_row y, tile_data d FROM topowebb`).all() as Array<{ z: number; x: number; y: number; d: Uint8Array }>;
    db.close();
    for (const r of all) {
      const inBox =
        r.z <= OVERVIEW_MAX_ZOOM ||
        Object.values(MOUNTAIN_BOXES).some((b) => {
          const t = tileRange(b, r.z);
          return r.x >= t.minX && r.x <= t.maxX && r.y >= t.minY && r.y <= t.maxY;
        });
      if (inBox) expected.set(`${r.z}/${r.x}/${r.y}`, r.d);
    }
    expect(expected.size).toBeGreaterThan(1000);
    expect([...got.keys()].sort()).toEqual([...expected.keys()].sort());
    for (const [k, d] of expected) expect(Buffer.from(got.get(k)!).equals(Buffer.from(d))).toBe(true);
    // Far less than the whole file was read.
    expect(reader.bytes).toBeLessThan(readFileSync(file).length);
  }, 120_000);

  it("stops with a clear message when the login is wrong", async () => {
    await expect(RemoteGpkg.open(httpReader(url, { Authorization: "Basic fel" }))).rejects.toThrow(/nekade åtkomst/);
  });
});
