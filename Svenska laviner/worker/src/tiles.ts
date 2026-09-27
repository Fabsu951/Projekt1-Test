import { corsHeaders } from "./http";
import { imageType, decodeTiles, validTile } from "./tileBatch";

// Lantmäteriet shuts its free WMTS ("Topografisk webbkarta Visning,
// översiktlig") on 2026-12-31. Its CC0 replacement, "Topografisk webbkarta
// Nedladdning, raster", is a GeoPackage download, so we host the tiles
// ourselves in R2 (scripts/import-tiles.ts). Until then, tiles missing from
// R2 are fetched from the old service and kept, so everything users have
// looked at survives the shutdown; after it, missing tiles fall back to
// OpenStreetMap.

export interface TilesEnv {
  IMAGES: R2Bucket;
  LANTMATERIET_USER?: string;
  LANTMATERIET_PASSWORD?: string;
  /** Bearer token for scripts/import-tiles.ts; uploads are refused without it. */
  TILE_UPLOAD_TOKEN?: string;
}

const WMTS = "https://maps.lantmateriet.se/open/topowebb-ccby/v1/wmts";
const TILE_TTL_SECONDS = 60 * 60 * 24 * 7;

/**
 * Tiles fetched from Lantmäteriet on demand (and kept in R2) are limited to
 * what the app actually requests: zoom ≤ 15 (the app enlarges beyond that)
 * inside a box around Sweden. Otherwise anyone could make us crawl the old
 * service with our credentials and fill the bucket.
 */
const FETCH_MAX_ZOOM = 15;
const FETCH_BOUNDS = { minLon: 10, maxLon: 25, minLat: 55, maxLat: 70 };

function tileLon(x: number, z: number): number {
  return (x / 2 ** z) * 360 - 180;
}

function tileLat(y: number, z: number): number {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return (180 / Math.PI) * Math.atan(Math.sinh(n));
}

/** Whether a tile may be fetched from Lantmäteriet and stored: low zooms always, else overlapping Sweden. */
export function fetchable(z: number, x: number, y: number): boolean {
  if (z > FETCH_MAX_ZOOM) return false;
  if (z <= 5) return true;
  const west = tileLon(x, z);
  const east = tileLon(x + 1, z);
  const north = tileLat(y, z);
  const south = tileLat(y + 1, z);
  return (
    east >= FETCH_BOUNDS.minLon &&
    west <= FETCH_BOUNDS.maxLon &&
    north >= FETCH_BOUNDS.minLat &&
    south <= FETCH_BOUNDS.maxLat
  );
}
const MAX_BATCH_TILES = 1000;

export const tileKey = (z: number, x: number, y: number) => `maptiles/topowebb/${z}/${x}/${y}`;

export function parseTilePath(pathname: string): { z: number; x: number; y: number } | null {
  const m = pathname.match(/^\/tiles\/topowebb\/(\d{1,2})\/(\d{1,6})\/(\d{1,6})\.png$/);
  if (!m) return null;
  const [z, x, y] = m.slice(1).map(Number);
  return validTile(z, x, y) ? { z, x, y } : null;
}

function tileResponse(body: BodyInit, contentType: string, origin: string): Response {
  return new Response(body, {
    headers: {
      ...corsHeaders(origin),
      "Content-Type": contentType,
      "Cache-Control": `public, max-age=${TILE_TTL_SECONDS}`,
    },
  });
}

async function fromLantmateriet(env: TilesEnv, z: number, x: number, y: number): Promise<Uint8Array | null> {
  if (!env.LANTMATERIET_USER || !env.LANTMATERIET_PASSWORD) return null;
  const url = new URL(WMTS);
  url.search = new URLSearchParams({
    SERVICE: "WMTS",
    REQUEST: "GetTile",
    VERSION: "1.0.0",
    LAYER: "topowebb",
    STYLE: "default",
    TILEMATRIXSET: "3857",
    TILEMATRIX: String(z),
    TILEROW: String(y),
    TILECOL: String(x),
    FORMAT: "image/png",
  }).toString();
  try {
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Basic ${btoa(`${env.LANTMATERIET_USER}:${env.LANTMATERIET_PASSWORD}`)}` },
    });
    if (!res.ok) return null;
    const data = new Uint8Array(await res.arrayBuffer());
    return imageType(data) ? data : null;
  } catch {
    return null;
  }
}

export async function serveTile(
  request: Request,
  env: TilesEnv,
  ctx: ExecutionContext,
  origin: string,
  tile: { z: number; x: number; y: number }
): Promise<Response> {
  const { z, x, y } = tile;
  const cache = caches.default;
  // Keyed on the tile alone, so query strings can't multiply cache entries.
  const cacheKey = new Request(new URL(`/tiles/topowebb/${z}/${x}/${y}.png`, request.url).toString());
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  let response: Response;
  const stored = await env.IMAGES.get(tileKey(z, x, y));
  if (stored) {
    response = tileResponse(stored.body, stored.httpMetadata?.contentType ?? "image/png", origin);
  } else {
    const data = fetchable(z, x, y) ? await fromLantmateriet(env, z, x, y) : null;
    if (data) {
      const type = imageType(data)!;
      ctx.waitUntil(env.IMAGES.put(tileKey(z, x, y), data, { httpMetadata: { contentType: type } }));
      response = tileResponse(data, type, origin);
    } else {
      // Outside what we host, once Lantmäteriet's service is gone.
      return Response.redirect(`https://tile.openstreetmap.org/${z}/${x}/${y}.png`, 302);
    }
  }
  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

async function sameSecret(a: string, b: string): Promise<boolean> {
  const digest = async (s: string) =>
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  const [ha, hb] = await Promise.all([digest(a), digest(b)]);
  let diff = 0;
  for (let i = 0; i < ha.length; i++) diff |= ha[i] ^ hb[i];
  return diff === 0;
}

/** POST /admin/tiles/topowebb: stores a batch of tiles (see tileBatch.ts). */
export async function uploadTiles(request: Request, env: TilesEnv, origin: string): Promise<Response> {
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } });

  const token = request.headers.get("Authorization")?.match(/^Bearer\s+(\S+)$/)?.[1] ?? "";
  if (!env.TILE_UPLOAD_TOKEN || !token || !(await sameSecret(token, env.TILE_UPLOAD_TOKEN))) {
    return json({ error: "Inte behörig." }, 401);
  }

  let tiles;
  try {
    tiles = decodeTiles(await request.arrayBuffer());
  } catch {
    return json({ error: "Trasig tilebunt." }, 400);
  }
  if (tiles.length > MAX_BATCH_TILES) return json({ error: `Högst ${MAX_BATCH_TILES} tiles per bunt.` }, 413);

  let stored = 0;
  let skipped = 0;
  for (let i = 0; i < tiles.length; i += 50) {
    await Promise.all(
      tiles.slice(i, i + 50).map(async (t) => {
        const type = imageType(t.data);
        if (!type || !validTile(t.z, t.x, t.y)) {
          skipped++;
          return;
        }
        await env.IMAGES.put(tileKey(t.z, t.x, t.y), t.data, { httpMetadata: { contentType: type } });
        stored++;
      })
    );
  }
  return json({ stored, skipped });
}
