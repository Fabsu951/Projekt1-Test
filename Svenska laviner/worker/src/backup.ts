import { mailAdmins, type AdminMailEnv } from "./adminMail";

// A weekly copy of the database in R2 (backups/d1/<date>.json.gz), besides
// Cloudflare's own 30-day point-in-time restore (D1 Time Travel). Kept 28
// days, as the privacy policy says deleted data may stay in backups for up
// to 30. Short-lived security data (sessions, email links, rate-limit
// counters) is left out: after a restore everyone just signs in again.
// scripts/restore-backup.ts turns a copy into SQL; steps in BACKUP.md.

export interface BackupEnv extends AdminMailEnv {
  IMAGES: R2Bucket;
}

export const BACKUP_PREFIX = "backups/d1/";
const KEEP_DAYS = 28;
const PAGE = 500;
const SKIP = new Set(["d1_migrations", "sessions", "email_tokens", "rate_limit_events", "service_alerts"]);

export interface BackupFile {
  version: 1;
  createdAt: string;
  /** Migrations applied when the copy was made; restore into a database migrated this far. */
  migrations: string[];
  tables: Record<string, { columns: string[]; rows: unknown[][] }>;
}

const quoteId = (name: string) => `"${name.replace(/"/g, '""')}"`;

/** Every table's rows (in rowid order) as plain JSON. */
export async function exportDatabase(db: D1Database, now = new Date()): Promise<BackupFile> {
  const names = await db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name")
    .all<{ name: string }>();
  const migrations = await db
    .prepare("SELECT name FROM d1_migrations ORDER BY id")
    .all<{ name: string }>()
    .then((r) => r.results.map((m) => m.name))
    .catch(() => []);
  const tables: BackupFile["tables"] = {};
  for (const { name } of names.results) {
    if (SKIP.has(name)) continue;
    const columns = (await db.prepare(`PRAGMA table_info(${quoteId(name)})`).all<{ name: string }>()).results.map((c) => c.name);
    const rows: unknown[][] = [];
    let after = -Infinity;
    for (;;) {
      const page = await db
        .prepare(`SELECT rowid AS __rowid, * FROM ${quoteId(name)} WHERE rowid > ? ORDER BY rowid LIMIT ${PAGE}`)
        .bind(after === -Infinity ? -9007199254740991 : after)
        .all<Record<string, unknown>>();
      for (const r of page.results) rows.push(columns.map((c) => r[c] ?? null));
      if (page.results.length < PAGE) break;
      after = Number(page.results[page.results.length - 1].__rowid);
    }
    tables[name] = { columns, rows };
  }
  return { version: 1, createdAt: now.toISOString(), migrations, tables };
}

async function gzip(text: string): Promise<ArrayBuffer> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Response(stream).arrayBuffer();
}

export async function gunzip(data: ArrayBuffer | Uint8Array): Promise<string> {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).text();
}

/** Makes this week's copy and removes copies older than four weeks. */
export async function runBackup(env: BackupEnv, now = new Date()): Promise<{ key: string; bytes: number; rows: number }> {
  try {
    const file = await exportDatabase(env.DB, now);
    const body = await gzip(JSON.stringify(file));
    const rows = Object.values(file.tables).reduce((n, t) => n + t.rows.length, 0);
    const key = `${BACKUP_PREFIX}${now.toISOString().slice(0, 10)}.json.gz`;
    await env.IMAGES.put(key, body, {
      httpMetadata: { contentType: "application/gzip" },
      customMetadata: { rows: String(rows), tables: String(Object.keys(file.tables).length) },
    });
    const listed = await env.IMAGES.list({ prefix: BACKUP_PREFIX });
    const cutoff = now.getTime() - KEEP_DAYS * 864e5;
    const old = listed.objects.filter((o) => o.key !== key && o.uploaded.getTime() < cutoff).map((o) => o.key);
    if (old.length) await env.IMAGES.delete(old);
    return { key, bytes: body.byteLength, rows };
  } catch (err) {
    await mailAdmins(env, "Snöläge: säkerhetskopian misslyckades", [
      `Veckans säkerhetskopia av databasen kunde inte göras: ${err instanceof Error ? err.message : String(err)}`,
      "Cloudflares egen återställning (D1 Time Travel, 30 dagar) finns kvar. Starta en session med Claude om det händer igen.",
    ]).catch(() => {});
    throw err;
  }
}

/** For the admin overview: the latest copy and how many there are. */
export async function backupStatus(env: Pick<BackupEnv, "IMAGES">): Promise<{ latestAt: string | null; bytes: number | null; count: number }> {
  const listed = await env.IMAGES.list({ prefix: BACKUP_PREFIX });
  const latest = [...listed.objects].sort((a, b) => b.uploaded.getTime() - a.uploaded.getTime())[0];
  return { latestAt: latest ? latest.uploaded.toISOString() : null, bytes: latest ? latest.size : null, count: listed.objects.length };
}

/** SQL that puts a copy's rows back into an empty database migrated as far as the copy says. */
export function restoreSql(file: BackupFile): string {
  const value = (v: unknown): string => {
    if (v === null || v === undefined) return "NULL";
    if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
    if (typeof v === "boolean") return v ? "1" : "0";
    return `'${String(v).replace(/'/g, "''")}'`;
  };
  const out = ["PRAGMA defer_foreign_keys = true;"];
  // Users first, so every other table's references exist as it is filled.
  const names = Object.keys(file.tables).sort((a, b) => Number(b === "users") - Number(a === "users") || a.localeCompare(b));
  for (const name of names) {
    const { columns, rows } = file.tables[name];
    const cols = columns.map(quoteId).join(", ");
    for (const row of rows) out.push(`INSERT INTO ${quoteId(name)} (${cols}) VALUES (${row.map(value).join(", ")});`);
  }
  return out.join("\n") + "\n";
}
