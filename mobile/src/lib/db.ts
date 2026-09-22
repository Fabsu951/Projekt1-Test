import * as SQLite from 'expo-sqlite';

export type Find = {
  id: number;
  taxonId: string;
  commonName: string;
  scientificName: string;
  photoUri: string;
  xpAwarded: number;
  createdAt: string;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('wildfind.db').then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS finds (
          id INTEGER PRIMARY KEY NOT NULL,
          taxonId TEXT NOT NULL,
          commonName TEXT NOT NULL,
          scientificName TEXT NOT NULL,
          photoUri TEXT NOT NULL,
          xpAwarded INTEGER NOT NULL,
          createdAt TEXT NOT NULL
        );
      `);
      return db;
    });
  }
  return dbPromise;
}

export async function insertFind(find: Omit<Find, 'id'>): Promise<Find> {
  const db = await getDb();
  const result = await db.runAsync(
    'INSERT INTO finds (taxonId, commonName, scientificName, photoUri, xpAwarded, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
    [find.taxonId, find.commonName, find.scientificName, find.photoUri, find.xpAwarded, find.createdAt]
  );
  return { id: result.lastInsertRowId, ...find };
}

export async function getAllFinds(): Promise<Find[]> {
  const db = await getDb();
  return db.getAllAsync<Find>('SELECT * FROM finds ORDER BY createdAt DESC');
}

export async function hasSeenSpecies(taxonId: string): Promise<boolean> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM finds WHERE taxonId = ?',
    [taxonId]
  );
  return (row?.count ?? 0) > 0;
}

export async function getTotalXp(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ total: number }>(
    'SELECT COALESCE(SUM(xpAwarded), 0) as total FROM finds'
  );
  return row?.total ?? 0;
}

/** Distinct days (YYYY-MM-DD) a find was logged, most recent first. */
export async function getFindDates(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ day: string }>(
    "SELECT DISTINCT substr(createdAt, 1, 10) as day FROM finds ORDER BY day DESC"
  );
  return rows.map((r) => r.day);
}
