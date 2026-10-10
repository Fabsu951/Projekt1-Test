// Shared by import-tiles.ts (topographic map) and import-slope.ts (slope
// map): batches of tiles to the worker's /admin/tiles/<layer>, authorised by
// a fresh TILE_UPLOAD_TOKEN secret that each run sets with wrangler.
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { encodeTiles, type Tile } from "../src/tileBatch";

export const WORKER = process.env.FJALLKOLL_WORKER_URL ?? "https://fjallkoll-worker.fabian-n-sund.workers.dev";

/** The Worker ran out of CPU/memory for this request (Cloudflare error 1102) – a smaller batch will do. */
const tooBig = (status: number, text: string) => status === 413 || ((status === 503 || status === 500) && /1102|exceeded resource limits/i.test(text));

export async function uploadTiles(token: string, layer: "topowebb" | "slope", tiles: Tile[]): Promise<void> {
  const body = encodeTiles(tiles);
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(`${WORKER}/admin/tiles/${layer}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/octet-stream" },
        body: body as Uint8Array<ArrayBuffer>,
        signal: AbortSignal.timeout(120_000),
      });
      if (res.ok) return;
      if (res.status === 401) throw Object.assign(new Error("Workern godkände inte uppladdningsnyckeln."), { fatal: true });
      const text = await res.text();
      if (tooBig(res.status, text) && tiles.length > 1) {
        // Split in half and send each part on its own.
        const half = Math.ceil(tiles.length / 2);
        try {
          await uploadTiles(token, layer, tiles.slice(0, half));
          await uploadTiles(token, layer, tiles.slice(half));
        } catch (err) {
          // The halves already retried on their own.
          throw Object.assign(err as Error, { fatal: true });
        }
        return;
      }
      throw new Error(`HTTP ${res.status}: ${text.length > 300 ? `${text.slice(0, 300)}…` : text}`);
    } catch (err) {
      if ((err as { fatal?: boolean }).fatal || attempt >= 6) throw err;
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
}

/** A fresh random upload token, stored as a worker secret for this run. */
export function createUploadToken(): string {
  if (process.env.TILE_UPLOAD_TOKEN) return process.env.TILE_UPLOAD_TOKEN;
  const token = randomBytes(32).toString("base64url");
  const result = spawnSync("npx", ["wrangler", "secret", "put", "TILE_UPLOAD_TOKEN"], {
    input: token,
    stdio: ["pipe", "inherit", "inherit"],
    shell: true,
  });
  if (result.status !== 0) {
    console.error("Kunde inte spara uppladdningsnyckeln på workern. Är du inloggad (npx wrangler login)?");
    process.exit(1);
  }
  return token;
}
