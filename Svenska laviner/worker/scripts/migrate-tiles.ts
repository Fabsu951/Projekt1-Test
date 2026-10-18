// Moves the map tiles from their old place in IMAGES ("maptiles/…") to the
// public map bucket TILES (kartor.snolage.se), one page per request to the
// worker's POST /admin/tiles/migrate. Tiles already there are skipped, so it
// is safe to run again. Run by .github/workflows/kartor.yml; by hand:
//   npx tsx scripts/migrate-tiles.ts
import { createUploadToken, WORKER } from "./uploadClient";

interface Page {
  copied: number;
  skipped: number;
  cursor: string | null;
}

const MAX_FAILURES = 30;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const token = createUploadToken();
  // A new secret takes a few seconds to reach every Cloudflare location.
  await sleep(10_000);

  let cursor: string | null = null;
  let limit = 100;
  let copied = 0;
  let skipped = 0;
  let calls = 0;
  let failures = 0;
  const started = Date.now();
  for (;;) {
    let page: Page | null = null;
    let problem = "";
    try {
      const res = await fetch(`${WORKER}/admin/tiles/migrate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ cursor, limit }),
        signal: AbortSignal.timeout(60_000),
      });
      if (res.ok) page = (await res.json()) as Page;
      else problem = `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`;
    } catch (err) {
      problem = String(err);
    }
    if (!page) {
      // Out of CPU (1102), a timeout or a hiccup: retry the same page smaller.
      if (++failures > MAX_FAILURES) {
        console.error(`Ger upp efter ${MAX_FAILURES} fel. Senaste: ${problem}`);
        process.exit(1);
      }
      limit = Math.max(10, Math.floor(limit / 2));
      console.log(`Fel (${problem}); försöker igen med ${limit} per anrop.`);
      await sleep(2000 * Math.min(failures, 10));
      continue;
    }
    copied += page.copied;
    skipped += page.skipped;
    calls++;
    if (calls % 100 === 0) {
      const min = ((Date.now() - started) / 60_000).toFixed(1);
      console.log(`${copied + skipped} genomgångna (${copied} kopierade, ${skipped} fanns redan), ${calls} anrop, ${min} min`);
    }
    if (!page.cursor) break;
    cursor = page.cursor;
  }
  const min = ((Date.now() - started) / 60_000).toFixed(1);
  console.log(`Klart: ${copied} kartbitar kopierade, ${skipped} fanns redan, ${calls} anrop, ${min} min.`);
}

void main();
