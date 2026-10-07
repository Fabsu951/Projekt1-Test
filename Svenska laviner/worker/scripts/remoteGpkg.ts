// Lantmäteriet's GeoPackage read over HTTP Range requests (see remoteSqlite.ts):
// the tile pyramid's metadata, and the tiles inside the mountain boxes found
// through the tile table's unique (zoom_level, tile_column, tile_row) index.
import { gpkgRange, MOUNTAIN_BOXES, OVERVIEW_MAX_ZOOM, type LevelMapping, type TileMatrix, type TileMatrixSet } from "../src/gpkgTiles";
import { indexColumns, readTable, RemoteSqlite, tableColumns, type RangeReader, type SchemaEntry, type Value } from "./remoteSqlite";

export interface GpkgTile {
  level: number;
  col: number;
  row: number;
  data: Uint8Array;
}

/** Runs `work` on every item with at most `limit` at a time, yielding results as they finish (any order). */
async function* pool<T, R>(items: T[], limit: number, work: (item: T) => Promise<R>): AsyncGenerator<R> {
  const running = new Map<number, Promise<[number, R]>>();
  let next = 0;
  const start = () => {
    const i = next++;
    running.set(i, work(items[i]).then((r) => [i, r] as [number, R]));
  };
  while (next < items.length && running.size < limit) start();
  while (running.size > 0) {
    const [i, result] = await Promise.race(running.values());
    running.delete(i);
    if (next < items.length) start();
    yield result;
  }
}

/** SQLite compares table and column names case-insensitively (ASCII). */
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export class RemoteGpkg {
  private constructor(
    private db: RemoteSqlite,
    private schemaEntries: SchemaEntry[]
  ) {}

  static async open(reader: RangeReader): Promise<RemoteGpkg> {
    const db = await RemoteSqlite.open(reader);
    return new RemoteGpkg(db, await db.schema());
  }

  private entry(name: string): SchemaEntry {
    const e = this.schemaEntries.find((s) => s.type === "table" && same(s.name, name));
    if (!e) throw new Error(`Tabellen ${name} saknas i filen.`);
    return e;
  }

  async rows(name: string): Promise<Array<Record<string, Value>>> {
    return readTable(this.db, this.entry(name));
  }

  /**
   * Tile tables: registered as "tiles" in gpkg_contents, else listed in
   * gpkg_tile_matrix_set, else any table with the tile pyramid's columns.
   */
  async tileTables(): Promise<string[]> {
    const tables = this.schemaEntries.filter((e) => e.type === "table");
    const has = (name: string) => tables.some((t) => same(t.name, name));
    const found = new Set<string>();
    if (has("gpkg_contents")) {
      for (const r of await this.rows("gpkg_contents")) {
        if (String(r.data_type ?? "").trim().toLowerCase() === "tiles") found.add(String(r.table_name));
      }
    }
    if (found.size === 0 && has("gpkg_tile_matrix_set")) {
      for (const r of await this.rows("gpkg_tile_matrix_set")) found.add(String(r.table_name));
    }
    if (found.size === 0) {
      for (const t of tables) {
        const cols = tableColumns(t.sql ?? "").map((c) => c.toLowerCase());
        if (["zoom_level", "tile_column", "tile_row", "tile_data"].every((c) => cols.includes(c))) found.add(t.name);
      }
    }
    // Use the table's own spelling (gpkg_contents may differ in case; SQLite doesn't care).
    return [...found].flatMap((name) => tables.filter((t) => same(t.name, name)).map((t) => t.name)).filter((n, i, a) => a.indexOf(n) === i);
  }

  /** What the file contains, for error messages: tables with their columns and gpkg_contents. */
  async describeSchema(): Promise<string> {
    const lines = this.schemaEntries
      .filter((e) => e.type === "table" || e.type === "view")
      .map((e) => `    ${e.type} ${e.name} (${tableColumns(e.sql ?? "").join(", ")})`);
    if (this.schemaEntries.some((e) => e.type === "table" && same(e.name, "gpkg_contents"))) {
      lines.push("  gpkg_contents:");
      for (const r of await this.rows("gpkg_contents")) lines.push(`    ${String(r.table_name)}: ${String(r.data_type)}`);
    }
    return lines.join("\n");
  }

  async matrixSet(table: string): Promise<TileMatrixSet> {
    const set = (await this.rows("gpkg_tile_matrix_set")).find((r) => same(String(r.table_name), table));
    if (!set) throw new Error(`Hittar inget tile matrix set för ${table}.`);
    const srs = (await this.rows("gpkg_spatial_ref_sys")).find((r) => Number(r.srs_id) === Number(set.srs_id));
    const code = String(srs?.organization ?? "").toUpperCase() === "EPSG" ? Number(srs?.organization_coordsys_id) : Number(set.srs_id);
    return { srs: code, minX: Number(set.min_x), maxY: Number(set.max_y) };
  }

  async matrices(table: string): Promise<TileMatrix[]> {
    return (await this.rows("gpkg_tile_matrix"))
      .filter((r) => same(String(r.table_name), table))
      .map((r) => ({
        zoomLevel: Number(r.zoom_level),
        tileWidth: Number(r.tile_width),
        tileHeight: Number(r.tile_height),
        pixelXSize: Number(r.pixel_x_size),
        pixelYSize: Number(r.pixel_y_size),
      }))
      .sort((a, b) => a.zoomLevel - b.zoomLevel);
  }

  /** The tile table's unique index and where tile_data sits in its rows. */
  private tileIndex(table: string): { root: number; order: "col-row" | "row-col"; tableRoot: number; dataAt: number } {
    const tableEntry = this.entry(table);
    const columns = tableColumns(tableEntry.sql ?? "").map((c) => c.toLowerCase());
    const dataAt = columns.indexOf("tile_data");
    if (dataAt < 0) throw new Error(`${table} saknar kolumnen tile_data.`);
    // Autoindexes (no SQL of their own) come from UNIQUE constraints, numbered in order.
    const uniques = (tableEntry.sql ?? "").match(/unique\s*\([^)]*\)/gi) ?? [];
    for (const idx of this.schemaEntries.filter((s) => s.type === "index" && same(s.tblName, table))) {
      const auto = /_autoindex_.*_(\d+)$/.exec(idx.name);
      const constraint = auto ? (uniques[Number(auto[1]) - 1] ?? uniques[0]) : undefined;
      const cols = (idx.sql ? indexColumns(idx.sql) : constraint ? indexColumns(constraint) : []).map((c) => c.toLowerCase());
      if (cols.length !== 3 || cols[0] !== "zoom_level") continue;
      if (cols[1] === "tile_column" && cols[2] === "tile_row") return { root: idx.rootPage, order: "col-row", tableRoot: tableEntry.rootPage, dataAt };
      if (cols[1] === "tile_row" && cols[2] === "tile_column") return { root: idx.rootPage, order: "row-col", tableRoot: tableEntry.rootPage, dataAt };
    }
    throw new Error(`Hittar inget index på (zoom_level, tile_column, tile_row) i ${table}.`);
  }

  /** Index entries (level, col, row, rowid) for the mountain boxes, everything up to OVERVIEW_MAX_ZOOM. */
  async tileKeys(table: string, levels: LevelMapping[], parallel = 6): Promise<Array<{ level: number; col: number; row: number; rowid: number }>> {
    const index = this.tileIndex(table);
    const ranges: Array<{ lo: number[]; hi: number[] }> = [];
    for (const level of levels) {
      if (level.z <= OVERVIEW_MAX_ZOOM) {
        ranges.push({ lo: [level.gpkgLevel], hi: [level.gpkgLevel] });
        continue;
      }
      for (const box of Object.values(MOUNTAIN_BOXES)) {
        const r = gpkgRange(level, box);
        const [outerLo, outerHi, innerLo, innerHi] = index.order === "col-row" ? [r.minX, r.maxX, r.minY, r.maxY] : [r.minY, r.maxY, r.minX, r.maxX];
        for (let v = outerLo; v <= outerHi; v++) ranges.push({ lo: [level.gpkgLevel, v, innerLo], hi: [level.gpkgLevel, v, innerHi] });
      }
    }
    const keys: Array<{ level: number; col: number; row: number; rowid: number }> = [];
    for await (const found of pool(ranges, parallel, (r) => this.db.indexRange(index.root, r.lo, r.hi))) {
      for (const k of found) {
        const [level, a, b, rowid] = k.map(Number);
        keys.push(index.order === "col-row" ? { level, col: a, row: b, rowid } : { level, col: b, row: a, rowid });
      }
    }
    // Rowid order keeps neighbouring tiles' pages together.
    return keys.sort((x, y) => x.rowid - y.rowid);
  }

  /** The tiles for the given keys (in rowid order), read in chunks whose pages are fetched in merged requests. */
  async *tiles(
    table: string,
    keys: Array<{ level: number; col: number; row: number; rowid: number }>,
    chunk = 200,
    ahead = 3
  ): AsyncGenerator<GpkgTile> {
    const index = this.tileIndex(table);
    const parts: Array<typeof keys> = [];
    for (let i = 0; i < keys.length; i += chunk) parts.push(keys.slice(i, i + chunk));
    // Fetch the next few chunks' pages while this one is handed out and uploaded.
    const pending: Array<Promise<void>> = [];
    const queue = (n: number) => {
      const p = this.db.prefetchRows(index.tableRoot, parts[n].map((k) => k.rowid));
      p.catch(() => {}); // awaited below; this only keeps an early failure from being "unhandled"
      pending.push(p);
    };
    for (let n = 0; n < parts.length; n++) {
      while (pending.length < ahead && n + pending.length < parts.length) queue(n + pending.length);
      await pending.shift();
      for (const k of parts[n]) {
        const values = await this.db.row(index.tableRoot, k.rowid);
        const data = values?.[index.dataAt];
        yield { level: k.level, col: k.col, row: k.row, data: data instanceof Uint8Array ? data : new Uint8Array() };
      }
    }
  }
}
