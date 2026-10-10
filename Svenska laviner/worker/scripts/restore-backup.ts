// Turns a weekly database copy (backups/d1/<date>.json.gz from R2) into SQL
// that fills an empty, migrated database. Steps in "Svenska laviner/BACKUP.md".
//
//   npx tsx scripts/restore-backup.ts backup.json.gz > restore.sql

import { readFileSync } from "node:fs";
import { gunzip, restoreSql, type BackupFile } from "../src/backup";

const path = process.argv[2];
if (!path) {
  console.error("Ange säkerhetskopian: npx tsx scripts/restore-backup.ts backup.json.gz > restore.sql");
  process.exit(1);
}
const file = JSON.parse(await gunzip(readFileSync(path))) as BackupFile;
if (file.version !== 1) throw new Error(`Okänd version av säkerhetskopian: ${file.version}`);
const rows = Object.values(file.tables).reduce((n, t) => n + t.rows.length, 0);
console.error(`Säkerhetskopia från ${file.createdAt}: ${Object.keys(file.tables).length} tabeller, ${rows} rader.`);
console.error(`Databasen ska först ha migreringarna t.o.m. ${file.migrations.at(-1) ?? "(okänt)"}.`);
process.stdout.write(restoreSql(file));
