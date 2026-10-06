// Reads a SQLite file (here: Lantmäteriet's all-Sweden GeoPackage, ~145 GB)
// straight from a web server with HTTP Range requests, so only the pages we
// need are fetched: the schema, the tile index, and the tiles inside the
// mountain boxes. Read-only and deliberately small: table b-trees by rowid,
// index b-trees by key range, records with overflow pages. Format reference:
// https://www.sqlite.org/fileformat2.html

export type Value = number | bigint | string | Uint8Array | null;

export interface RangeReader {
  /** Bytes [offset, offset + length) of the file. */
  read(offset: number, length: number): Promise<Uint8Array>;
}

/** HTTP Range reads with retries; `headers` carries e.g. the Authorization header. */
export function httpReader(url: string, headers: Record<string, string> = {}, attempts = 6): RangeReader & { requests: number; bytes: number } {
  const reader = {
    requests: 0,
    bytes: 0,
    async read(offset: number, length: number): Promise<Uint8Array> {
      for (let attempt = 1; ; attempt++) {
        try {
          const res = await fetch(url, { headers: { ...headers, Range: `bytes=${offset}-${offset + length - 1}` } });
          if (res.status === 401 || res.status === 403) {
            throw Object.assign(new Error(`Servern nekade åtkomst (HTTP ${res.status}).`), { fatal: true });
          }
          if (res.status !== 206) throw new Error(`Väntade HTTP 206, fick ${res.status}.`);
          const data = new Uint8Array(await res.arrayBuffer());
          if (data.length !== length) throw new Error(`Fick ${data.length} byte, väntade ${length}.`);
          reader.requests++;
          reader.bytes += data.length;
          return data;
        } catch (err) {
          if ((err as { fatal?: boolean }).fatal || attempt >= attempts) throw err;
          await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
        }
      }
    },
  };
  return reader;
}

function varint(buf: Uint8Array, pos: number): [number, number] {
  let value = 0n;
  for (let i = 0; i < 8; i++) {
    const b = buf[pos + i];
    value = (value << 7n) | BigInt(b & 0x7f);
    if (b < 0x80) return [Number(value), pos + i + 1];
  }
  value = (value << 8n) | BigInt(buf[pos + 8]);
  return [Number(BigInt.asIntN(64, value)), pos + 9];
}

const u16 = (b: Uint8Array, p: number) => (b[p] << 8) | b[p + 1];
const u32 = (b: Uint8Array, p: number) => ((b[p] << 24) >>> 0) + (b[p + 1] << 16) + (b[p + 2] << 8) + b[p + 3];

function intOf(b: Uint8Array, p: number, n: number): number {
  let v = BigInt(b[p] & 0x80 ? -1 : 0);
  for (let i = 0; i < n; i++) v = (v << 8n) | BigInt(b[p + i]);
  return Number(BigInt.asIntN(64, v));
}

/** Decodes a record (header + body). */
export function decodeRecord(rec: Uint8Array): Value[] {
  const [headerSize, start] = varint(rec, 0);
  const types: number[] = [];
  for (let p = start; p < headerSize; ) {
    const [t, next] = varint(rec, p);
    types.push(t);
    p = next;
  }
  const out: Value[] = [];
  let p = headerSize;
  for (const t of types) {
    if (t === 0) out.push(null);
    else if (t >= 1 && t <= 6) {
      const n = [0, 1, 2, 3, 4, 6, 8][t];
      out.push(intOf(rec, p, n));
      p += n;
    } else if (t === 7) {
      out.push(new DataView(rec.buffer, rec.byteOffset + p, 8).getFloat64(0));
      p += 8;
    } else if (t === 8) out.push(0);
    else if (t === 9) out.push(1);
    else if (t >= 12) {
      const n = Math.floor((t - 12) / 2);
      const bytes = rec.subarray(p, p + n);
      out.push(t % 2 === 0 ? bytes : new TextDecoder().decode(bytes));
      p += n;
    } else throw new Error(`Okänd SQLite-typ ${t}.`);
  }
  return out;
}

interface Page {
  no: number;
  data: Uint8Array;
}

/** Compares the first values of an index key with a tuple of numbers. */
function compareKey(key: Value[], bound: number[]): number {
  for (let i = 0; i < bound.length; i++) {
    const k = Number(key[i]);
    if (k !== bound[i]) return k < bound[i] ? -1 : 1;
  }
  return 0;
}

export interface SchemaEntry {
  type: string;
  name: string;
  tblName: string;
  rootPage: number;
  sql: string | null;
}

export class RemoteSqlite {
  private pageSize = 0;
  private usable = 0;
  private cache = new Map<number, Promise<Uint8Array>>();
  private static readonly CACHE_PAGES = 16384; // 64 MB with 4 kB pages

  private constructor(private reader: RangeReader) {}

  static async open(reader: RangeReader): Promise<RemoteSqlite> {
    const db = new RemoteSqlite(reader);
    const head = await reader.read(0, 100);
    if (new TextDecoder().decode(head.subarray(0, 15)) !== "SQLite format 3") throw new Error("Filen är ingen SQLite-databas.");
    const size = u16(head, 16);
    db.pageSize = size === 1 ? 65536 : size;
    db.usable = db.pageSize - head[20];
    if (u32(head, 56) !== 1) throw new Error("Bara UTF-8-databaser stöds.");
    return db;
  }

  /** Reads pages [first, first + count) in one request and caches them. */
  private fetchPages(first: number, count: number): void {
    const all = this.reader.read((first - 1) * this.pageSize, count * this.pageSize);
    for (let i = 0; i < count; i++) {
      const no = first + i;
      if (this.cache.has(no)) continue;
      this.cache.set(
        no,
        all.then((d) => d.subarray(i * this.pageSize, (i + 1) * this.pageSize))
      );
    }
    if (this.cache.size > RemoteSqlite.CACHE_PAGES) {
      // Map keeps insertion order: drop the oldest quarter.
      let drop = this.cache.size - (RemoteSqlite.CACHE_PAGES * 3) / 4;
      for (const key of this.cache.keys()) {
        if (drop-- <= 0) break;
        this.cache.delete(key);
      }
    }
  }

  private async page(no: number, readAhead = 1): Promise<Page> {
    if (!this.cache.has(no)) this.fetchPages(no, readAhead);
    try {
      return { no, data: await this.cache.get(no)! };
    } catch (err) {
      this.cache.delete(no);
      throw err;
    }
  }

  /** Offset of the b-tree page header (page 1 starts after the 100-byte file header). */
  private static headerAt(page: Page): number {
    return page.no === 1 ? 100 : 0;
  }

  private cells(page: Page): { type: number; offsets: number[]; right: number } {
    const h = RemoteSqlite.headerAt(page);
    const type = page.data[h];
    const n = u16(page.data, h + 3);
    const interior = type === 0x02 || type === 0x05;
    const ptrs = h + (interior ? 12 : 8);
    const offsets = Array.from({ length: n }, (_, i) => u16(page.data, ptrs + 2 * i));
    return { type, offsets, right: interior ? u32(page.data, h + 8) : 0 };
  }

  /** The full payload of a cell, following overflow pages. */
  private async payload(page: Page, pos: number, size: number, index: boolean): Promise<Uint8Array> {
    const u = this.usable;
    const x = index ? Math.floor(((u - 12) * 64) / 255) - 23 : u - 35;
    if (size <= x) return page.data.subarray(pos, pos + size);
    const m = Math.floor(((u - 12) * 32) / 255) - 23;
    const k = m + ((size - m) % (u - 4));
    const local = k <= x ? k : m;
    const out = new Uint8Array(size);
    out.set(page.data.subarray(pos, pos + local));
    let filled = local;
    let next = u32(page.data, pos + local);
    // Overflow pages are usually stored one after another; read them in one go.
    const pagesLeft = Math.ceil((size - local) / (u - 4));
    let readAhead = Math.min(pagesLeft, 64);
    while (filled < size) {
      if (next === 0) throw new Error("Överflödskedjan tog slut för tidigt.");
      const over = await this.page(next, readAhead);
      readAhead = 1;
      const n = Math.min(u - 4, size - filled);
      out.set(over.data.subarray(4, 4 + n), filled);
      filled += n;
      next = u32(over.data, 0);
    }
    return out;
  }

  /** Every row of a table b-tree, in rowid order. */
  async *scanTable(root: number): AsyncGenerator<{ rowid: number; values: Value[] }> {
    const page = await this.page(root);
    const { type, offsets, right } = this.cells(page);
    if (type === 0x05) {
      for (const off of offsets) yield* this.scanTable(u32(page.data, off));
      yield* this.scanTable(right);
    } else if (type === 0x0d) {
      for (const off of offsets) {
        const [size, p1] = varint(page.data, off);
        const [rowid, p2] = varint(page.data, p1);
        yield { rowid, values: decodeRecord(await this.payload(page, p2, size, false)) };
      }
    } else throw new Error(`Oväntad sidtyp ${type} i tabell.`);
  }

  /** One row by rowid, or null. */
  async row(root: number, rowid: number): Promise<Value[] | null> {
    const at = await this.locate(root, rowid);
    return at ? decodeRecord(await this.payload(at.page, at.pos, at.size, false)) : null;
  }

  /** The leaf page and payload position of a row, without reading the payload. */
  private async locate(root: number, rowid: number): Promise<{ page: Page; pos: number; size: number } | null> {
    let page = await this.page(root);
    for (;;) {
      const { type, offsets, right } = this.cells(page);
      if (type === 0x05) {
        let child = right;
        let lo = 0;
        let hi = offsets.length - 1;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          const [key] = varint(page.data, offsets[mid] + 4);
          if (key >= rowid) {
            child = u32(page.data, offsets[mid]);
            hi = mid - 1;
          } else lo = mid + 1;
        }
        page = await this.page(child);
      } else if (type === 0x0d) {
        let lo = 0;
        let hi = offsets.length - 1;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          const [size, p1] = varint(page.data, offsets[mid]);
          const [key, p2] = varint(page.data, p1);
          if (key === rowid) return { page, pos: p2, size };
          if (key < rowid) lo = mid + 1;
          else hi = mid - 1;
        }
        return null;
      } else throw new Error(`Oväntad sidtyp ${type} i tabell.`);
    }
  }

  /**
   * Reads the overflow pages of many rows with as few requests as possible:
   * page runs closer than `gap` pages are merged, up to `maxPages` per request.
   */
  async prefetchRows(root: number, rowids: number[], gap = 16, maxPages = 512): Promise<void> {
    // First the leaf pages (found through the cached interior pages), merged like the rest:
    // with big tiles each leaf sits right before its rows' overflow pages, so this often gets those too.
    const leaves: number[] = [];
    for (const rowid of rowids) {
      const leaf = await this.leafOf(root, rowid);
      if (!this.cache.has(leaf)) leaves.push(leaf);
    }
    await this.fetchMerged(leaves, gap, maxPages);

    const u = this.usable;
    const wanted: number[] = [];
    for (const rowid of rowids) {
      const at = await this.locate(root, rowid);
      if (!at || at.size <= u - 35) continue;
      const m = Math.floor(((u - 12) * 32) / 255) - 23;
      const k = m + ((at.size - m) % (u - 4));
      const local = k <= u - 35 ? k : m;
      const first = u32(at.page.data, at.pos + local);
      const count = Math.ceil((at.size - local) / (u - 4));
      // Assumes the chain runs forward; payload() fetches any page this misses.
      for (let i = 0; i < count; i++) if (!this.cache.has(first + i)) wanted.push(first + i);
    }
    await this.fetchMerged(wanted, gap, maxPages);
  }

  private depths = new Map<number, number>();

  /** Number of interior levels above the leaves of a table b-tree. */
  private async depth(root: number): Promise<number> {
    let d = this.depths.get(root);
    if (d !== undefined) return d;
    d = 0;
    let page = await this.page(root);
    for (let c = this.cells(page); c.type === 0x05; c = this.cells(page)) {
      page = await this.page(c.right);
      d++;
    }
    this.depths.set(root, d);
    return d;
  }

  /** The number of the leaf page that holds (or would hold) a rowid; reads only interior pages. */
  private async leafOf(root: number, rowid: number): Promise<number> {
    let no = root;
    for (let level = await this.depth(root); level > 0; level--) {
      const page = await this.page(no);
      const { offsets, right } = this.cells(page);
      let child = right;
      let lo = 0;
      let hi = offsets.length - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const [key] = varint(page.data, offsets[mid] + 4);
        if (key >= rowid) {
          child = u32(page.data, offsets[mid]);
          hi = mid - 1;
        } else lo = mid + 1;
      }
      no = child;
    }
    return no;
  }

  /** Fetches pages in as few requests as possible: runs closer than `gap` pages merged, ≤ `maxPages` each. */
  private async fetchMerged(pages: number[], gap: number, maxPages: number): Promise<void> {
    const wanted = [...new Set(pages)].sort((a, b) => a - b);
    const runs: Array<[number, number]> = [];
    for (const no of wanted) {
      const last = runs[runs.length - 1];
      if (last && no - (last[0] + last[1] - 1) <= gap && no - last[0] < maxPages) last[1] = no - last[0] + 1;
      else if (!last || no > last[0] + last[1] - 1) runs.push([no, 1]);
    }
    for (const [first, count] of runs) this.fetchPages(first, count);
    await Promise.all(runs.map(([first]) => this.cache.get(first)));
  }

  /** Index entries whose leading values lie between `lo` and `hi` (inclusive), in order. */
  async indexRange(root: number, lo: number[], hi: number[], out: Value[][] = []): Promise<Value[][]> {
    await this.indexWalk(root, lo, hi, out);
    return out;
  }

  /** Returns true once a key above `hi` was seen (nothing further can match). */
  private async indexWalk(no: number, lo: number[], hi: number[], out: Value[][]): Promise<boolean> {
    const page = await this.page(no);
    const { type, offsets, right } = this.cells(page);
    const interior = type === 0x02;
    if (!interior && type !== 0x0a) throw new Error(`Oväntad sidtyp ${type} i index.`);
    for (const off of offsets) {
      const start = interior ? off + 4 : off;
      const [size, p] = varint(page.data, start);
      const key = decodeRecord(await this.payload(page, p, size, true));
      const aboveLo = compareKey(key, lo) >= 0;
      // Everything left of this key is smaller than it.
      if (interior && aboveLo && (await this.indexWalk(u32(page.data, off), lo, hi, out))) return true;
      if (compareKey(key, hi) > 0) return true;
      if (aboveLo) out.push(key);
    }
    return interior ? this.indexWalk(right, lo, hi, out) : false;
  }

  /** The schema (sqlite_master). */
  async schema(): Promise<SchemaEntry[]> {
    const out: SchemaEntry[] = [];
    for await (const { values } of this.scanTable(1)) {
      out.push({
        type: String(values[0]),
        name: String(values[1]),
        tblName: String(values[2]),
        rootPage: Number(values[3]),
        sql: values[4] === null ? null : String(values[4]),
      });
    }
    return out;
  }
}

/** Column names of a CREATE TABLE statement, in order (constraints skipped). */
export function tableColumns(sql: string): string[] {
  const body = sql.slice(sql.indexOf("(") + 1, sql.lastIndexOf(")"));
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of body) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else current += ch;
  }
  parts.push(current);
  return parts
    .map((p) => p.trim())
    .filter((p) => p && !/^(constraint|primary\s+key|unique|check|foreign\s+key)\b/i.test(p))
    .map((p) => p.match(/^(?:"([^"]+)"|`([^`]+)`|\[([^\]]+)\]|(\S+))/)!.slice(1).find(Boolean)!);
}

/** The column list of a UNIQUE (...) table constraint or CREATE INDEX statement. */
export function indexColumns(sql: string): string[] {
  const inner = sql.slice(sql.lastIndexOf("(") + 1, sql.lastIndexOf(")"));
  return inner.split(",").map((c) => c.trim().replace(/^["`[]|["`\]]$/g, "").split(/\s+/)[0].replace(/^["`[]|["`\]]$/g, ""));
}

/** The table's rows as objects; an INTEGER PRIMARY KEY column gets the rowid. */
export async function readTable(db: RemoteSqlite, entry: SchemaEntry): Promise<Array<Record<string, Value>>> {
  const columns = tableColumns(entry.sql ?? "");
  const rowidColumn = columns.find((c) => new RegExp(`(^|[\\s,(])"?${c}"?\\s+integer\\s+primary\\s+key`, "i").test(entry.sql ?? ""));
  const rows: Array<Record<string, Value>> = [];
  for await (const { rowid, values } of db.scanTable(entry.rootPage)) {
    const row: Record<string, Value> = {};
    columns.forEach((c, i) => (row[c] = c === rowidColumn ? rowid : (values[i] ?? null)));
    rows.push(row);
  }
  return rows;
}
