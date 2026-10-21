/// <reference types="node" />
// Test helper: a D1-shaped wrapper around Node's built-in SQLite with every
// migration applied, so worker SQL can be tested against a real database.
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

type Value = string | number | null;

export function migratedD1(): D1Database {
  const db = new DatabaseSync(":memory:");
  const dir = new URL("../../migrations/", import.meta.url);
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    db.exec(readFileSync(new URL(file, dir), "utf8"));
  }

  const statement = (sql: string, params: Value[] = []) => ({
    bind: (...values: unknown[]) => statement(sql, values.map((v) => (typeof v === "boolean" ? Number(v) : (v as Value)))),
    async first<T>() {
      return (db.prepare(sql).get(...params) as T | undefined) ?? null;
    },
    async all<T>() {
      return { results: db.prepare(sql).all(...params) as T[], success: true, meta: {} };
    },
    async run() {
      const r = db.prepare(sql).run(...params);
      return { success: true, meta: { last_row_id: Number(r.lastInsertRowid), changes: Number(r.changes) } };
    },
    _exec() {
      const r = db.prepare(sql).run(...params);
      return { success: true, meta: { last_row_id: Number(r.lastInsertRowid), changes: Number(r.changes) } };
    },
  });

  return {
    prepare: (sql: string) => statement(sql),
    async batch(statements: Array<{ _exec: () => unknown }>) {
      db.exec("BEGIN");
      try {
        const results = statements.map((s) => s._exec());
        db.exec("COMMIT");
        return results;
      } catch (err) {
        db.exec("ROLLBACK");
        throw err;
      }
    },
    exec: async (sql: string) => db.exec(sql),
  } as unknown as D1Database;
}
