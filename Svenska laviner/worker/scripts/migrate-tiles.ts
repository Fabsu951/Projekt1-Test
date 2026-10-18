// Moves the map tiles from their old place in IMAGES ("maptiles/…") to the
// public map bucket TILES (kartor.snolage.se) through the worker's
// POST /admin/tiles/migrate: first lists both buckets, then copies only what
// is missing, several small batches at a time. Safe to run again. Run by
// .github/workflows/kartor.yml; by hand: npx tsx scripts/migrate-tiles.ts
import { publicKeyFor } from "../src/tiles";
import { createUploadToken, WORKER } from "./uploadClient";

/** Batches in flight at once; each is its own worker request with its own CPU budget. */
const PARALLEL = 8;
const BATCH = 25;
const MAX_TRIES = 8;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function call<T>(token: string, body: unknown): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    let problem: string;
    try {
      const res = await fetch(`${WORKER}/admin/tiles/migrate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60_000),
      });
      if (res.ok) return (await res.json()) as T;
      problem = `HTTP ${res.status}: ${(await res.text()).replace(/\s+/g, " ").slice(0, 120)}`;
    } catch (err) {
      problem = String(err);
    }
    // Out of CPU (Cloudflare 1102), a timeout or a hiccup: wait and try again.
    if (attempt >= MAX_TRIES) throw new Error(problem);
    await sleep(1500 * attempt);
  }
}

async function listAll(token: string, which: "old" | "new"): Promise<string[]> {
  const keys: string[] = [];
  let cursor: string | null = null;
  do {
    const page: { keys: string[]; cursor: string | null } = await call(token, { list: which, cursor });
    keys.push(...page.keys);
    cursor = page.cursor;
  } while (cursor);
  return keys;
}

async function main() {
  const token = createUploadToken();
  // A new secret takes a few seconds to reach every Cloudflare location.
  await sleep(10_000);
  const started = Date.now();
  const minutes = () => ((Date.now() - started) / 60_000).toFixed(1);

  const [old, done] = await Promise.all([listAll(token, "old"), listAll(token, "new")]);
  const there = new Set(done);
  const todo = old.filter((k) => {
    const target = publicKeyFor(k);
    return target !== null && !there.has(target);
  });
  console.log(`${old.length} i den gamla lagringen, ${done.length} redan flyttade, ${todo.length} kvar (${minutes()} min).`);

  let next = 0;
  let copied = 0;
  let failed = 0;
  let reported = 0;
  async function worker() {
    while (next < todo.length) {
      const batch = todo.slice(next, next + BATCH);
      next += BATCH;
      try {
        const r: { copied: number } = await call(token, { keys: batch });
        copied += r.copied;
      } catch (err) {
        failed += batch.length;
        console.log(`Gav upp ${batch.length} kartbitar (${String(err).slice(0, 160)}); en ny körning tar dem.`);
      }
      if (copied + failed - reported >= 5000) {
        reported = copied + failed;
        console.log(`${copied} kopierade, ${failed} misslyckade av ${todo.length}, ${minutes()} min`);
      }
    }
  }
  await Promise.all(Array.from({ length: PARALLEL }, worker));
  console.log(`Klart: ${copied} kopierade, ${failed} misslyckade, ${minutes()} min.`);
  if (failed > 0) process.exit(1);
}

void main();
