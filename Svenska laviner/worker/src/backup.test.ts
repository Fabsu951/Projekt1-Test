/// <reference types="node" />
import { describe, expect, it } from "vitest";
import { backupStatus, exportDatabase, gunzip, restoreSql, runBackup, type BackupFile } from "./backup";
import { migratedD1 } from "./testing/sqliteD1";

/** Just enough of R2 for the backup: put, list and delete. */
function fakeBucket() {
  const objects = new Map<string, { body: ArrayBuffer; uploaded: Date }>();
  let clock = Date.now();
  return {
    objects,
    setClock: (d: Date) => (clock = d.getTime()),
    async put(key: string, body: ArrayBuffer) {
      objects.set(key, { body, uploaded: new Date(clock) });
    },
    async list({ prefix }: { prefix: string }) {
      return {
        objects: [...objects.entries()]
          .filter(([k]) => k.startsWith(prefix))
          .map(([key, o]) => ({ key, uploaded: o.uploaded, size: o.body.byteLength })),
      };
    },
    async delete(keys: string | string[]) {
      for (const k of [keys].flat()) objects.delete(k);
    },
  };
}

async function seeded() {
  const db = migratedD1();
  await db.prepare("INSERT INTO users (email, display_name, password_hash, created_at, lang) VALUES ('anna@test', 'Anna O''Hara', 'x', '2026-01-01', 'en')").run();
  await db.prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES ('h', 1, '2026-01-01', '2999-01-01')").run();
  await db
    .prepare(
      "INSERT INTO observations (user_id, type, lat, lon, region_id, observed_at, description, created_at) VALUES (1, 'lavin', 67.9, 18.5, 'kebnekaisefjallen', '2026-02-01', 'Färsk lavin; 35° – ”stor”', '2026-02-01')"
    )
    .run();
  await db.prepare("INSERT INTO trip_plans (user_id, region_id, date, created_at) VALUES (1, 'kebnekaisefjallen', '2026-02-14', '2026-02-01')").run();
  return db;
}

describe("database backup", () => {
  it("copies every table but the short-lived security data, and restores it exactly", async () => {
    const db = await seeded();
    const file = await exportDatabase(db, new Date("2026-02-02T02:37:00Z"));
    expect(file.tables.users.rows).toHaveLength(1);
    expect(file.tables.sessions).toBeUndefined();
    expect(file.tables.rate_limit_events).toBeUndefined();

    const fresh = migratedD1() as D1Database & { exec(sql: string): Promise<unknown> };
    await fresh.exec(restoreSql(file));
    for (const table of ["users", "observations", "trip_plans"]) {
      const before = await db.prepare(`SELECT * FROM ${table}`).all();
      const after = await fresh.prepare(`SELECT * FROM ${table}`).all();
      expect(after.results).toEqual(before.results);
    }
  });

  it("stores a gzipped copy each week in R2 and keeps four weeks", async () => {
    const bucket = fakeBucket();
    const env = { DB: await seeded(), IMAGES: bucket as unknown as R2Bucket };
    for (const day of ["2026-01-05", "2026-01-12", "2026-01-19", "2026-01-26", "2026-02-02", "2026-02-09"]) {
      const now = new Date(`${day}T02:37:00Z`);
      bucket.setClock(now);
      await runBackup(env, now);
    }
    expect([...bucket.objects.keys()].sort()).toEqual([
      "backups/d1/2026-01-12.json.gz",
      "backups/d1/2026-01-19.json.gz",
      "backups/d1/2026-01-26.json.gz",
      "backups/d1/2026-02-02.json.gz",
      "backups/d1/2026-02-09.json.gz",
    ]);
    const copy = JSON.parse(await gunzip(bucket.objects.get("backups/d1/2026-02-09.json.gz")!.body)) as BackupFile;
    expect(copy.tables.observations.rows[0]).toContain("Färsk lavin; 35° – ”stor”");
    expect(await backupStatus(env)).toMatchObject({ latestAt: "2026-02-09T02:37:00.000Z", count: 5 });
  });
});
