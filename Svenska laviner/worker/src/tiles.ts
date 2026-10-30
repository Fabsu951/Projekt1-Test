import { corsHeaders } from "./http";
import { imageType, decodeTiles, validTile } from "./tileBatch";

// Lantmäteriet shuts its free WMTS ("Topografisk webbkarta Visning,
// översiktlig") on 2026-12-31. Its CC BY 4.0 replacement, "Topografisk webbkarta
// Nedladdning, raster", is a GeoPackage download, so we host the tiles
// ourselves in R2 (scripts/import-tiles.ts). Until then, tiles missing from
// R2 are fetched from the old service and kept, so everything users have
// looked at survives the shutdown; after it, missing tiles fall back to
// OpenStreetMap.
//
// The tiles live in their own bucket (TILES, "snolage-kartor"), which is
// public at https://kartor.snolage.se so the app can load them without going
// through the worker (worker requests are limited on the free plan; R2 reads
// through a custom domain are not). Earlier tiles sat in IMAGES under
// "maptiles/…"; they are read from there and copied over until
// POST /admin/tiles/migrate has moved them all. IMAGES itself must never be
// made public: it also holds backups and full GPS tracks.

export interface TilesEnv {
  IMAGES: R2Bucket;
  /** Map tiles only, public at kartor.snolage.se. Never put anything private here. */
  TILES?: R2Bucket;
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

export type TileLayer = "topowebb" | "slope";

/** Where tiles used to be kept, in IMAGES. */
export const tileKey = (z: number, x: number, y: number, layer: TileLayer = "topowebb") => `maptiles/${layer}/${z}/${x}/${y}`;

/** The key in the public bucket, which is also the path at kartor.snolage.se. */
export const publicTileKey = (z: number, x: number, y: number, layer: TileLayer = "topowebb") => `${layer}/${z}/${x}/${y}.png`;

/** Stored with each public tile, so the browser and Cloudflare's cache keep it. */
const tileMetadata = (contentType: string): R2HTTPMetadata => ({
  contentType,
  cacheControl: `public, max-age=${TILE_TTL_SECONDS}`,
});

/** A stored tile: the public bucket first, else the old place in IMAGES (copied over on the way). */
async function readTile(
  env: TilesEnv,
  ctx: ExecutionContext,
  layer: TileLayer,
  z: number,
  x: number,
  y: number
): Promise<{ data: BodyInit; type: string } | null> {
  if (env.TILES) {
    const hit = await env.TILES.get(publicTileKey(z, x, y, layer));
    if (hit) return { data: hit.body, type: hit.httpMetadata?.contentType ?? "image/png" };
  }
  const old = await env.IMAGES.get(tileKey(z, x, y, layer));
  if (!old) return null;
  const type = old.httpMetadata?.contentType ?? "image/png";
  if (!env.TILES) return { data: old.body, type };
  const data = new Uint8Array(await old.arrayBuffer());
  ctx.waitUntil(env.TILES.put(publicTileKey(z, x, y, layer), data, { httpMetadata: tileMetadata(type) }));
  return { data, type };
}

async function storeTile(env: TilesEnv, layer: TileLayer, z: number, x: number, y: number, data: Uint8Array, type: string) {
  if (env.TILES) await env.TILES.put(publicTileKey(z, x, y, layer), data, { httpMetadata: tileMetadata(type) });
  else await env.IMAGES.put(tileKey(z, x, y, layer), data, { httpMetadata: { contentType: type } });
}

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
      signal: AbortSignal.timeout(15_000),
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
  const stored = await readTile(env, ctx, "topowebb", z, x, y);
  if (stored) {
    response = tileResponse(stored.data, stored.type, origin);
  } else {
    const data = fetchable(z, x, y) ? await fromLantmateriet(env, z, x, y) : null;
    if (data) {
      const type = imageType(data)!;
      ctx.waitUntil(storeTile(env, "topowebb", z, x, y, data, type));
      response = tileResponse(data, type, origin);
    } else if (z > FETCH_MAX_ZOOM) {
      // Zoom 16 exists only where it was imported; the app enlarges zoom 15 elsewhere.
      return new Response("Not found", { status: 404, headers: corsHeaders(origin) });
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

/** Lantmäteriet's all-Sweden topo GeoPackage, readable with the worker's own Geotorget login. */
export const TOPOWEBB_GPKG = "https://dl1.lantmateriet.se/karta/topowebb/data/topowebb-3857.gpkg";
const MAX_PROXY_RANGE = 16 * 1024 * 1024;

/**
 * GET /admin/lantmateriet/topowebb-3857.gpkg: one HTTP Range of the
 * GeoPackage, fetched with the worker's Lantmäteriet login, for
 * scripts/import-tiles.ts run from GitHub Actions (upload token required,
 * so nobody else can use the login; ranges only, ≤ 16 MB each).
 */
export async function proxyTopowebbFile(request: Request, env: TilesEnv): Promise<Response> {
  const token = request.headers.get("Authorization")?.match(/^Bearer\s+(\S+)$/)?.[1] ?? "";
  if (!env.TILE_UPLOAD_TOKEN || !token || !(await sameSecret(token, env.TILE_UPLOAD_TOKEN))) {
    return new Response("Inte behörig.", { status: 401 });
  }
  if (!env.LANTMATERIET_USER || !env.LANTMATERIET_PASSWORD) return new Response("Ingen Lantmäteriet-inloggning.", { status: 503 });
  const range = request.headers.get("Range")?.match(/^bytes=(\d+)-(\d+)$/);
  if (!range || Number(range[2]) < Number(range[1]) || Number(range[2]) - Number(range[1]) + 1 > MAX_PROXY_RANGE) {
    return new Response("Ange ett Range-intervall på högst 16 MB.", { status: 400 });
  }
  const res = await fetch(TOPOWEBB_GPKG, {
    headers: {
      Range: `bytes=${range[1]}-${range[2]}`,
      Authorization: `Basic ${btoa(`${env.LANTMATERIET_USER}:${env.LANTMATERIET_PASSWORD}`)}`,
      "User-Agent": "Snolage/1.0 (https://snolage.se)",
    },
    signal: AbortSignal.timeout(55_000),
  });
  const headers: Record<string, string> = { "Content-Type": "application/octet-stream" };
  for (const name of ["Content-Range", "Content-Length"]) {
    const value = res.headers.get(name);
    if (value) headers[name] = value;
  }
  return new Response(res.body, { status: res.status, headers });
}

/** POST /admin/tiles/<layer>: stores a batch of tiles (see tileBatch.ts). */
export async function uploadTiles(request: Request, env: TilesEnv, origin: string, layer: TileLayer = "topowebb"): Promise<Response> {
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
        await storeTile(env, layer, t.z, t.x, t.y, t.data, type);
        stored++;
      })
    );
  }
  return json({ stored, skipped });
}

// The detailed slope map ("Lutning, detaljerad"), made from Lantmäteriet's
// height model by scripts/import-slope.ts. Only tiles with ground of 30° or
// more are stored; everything else is an empty (transparent) tile.

const SLOPE_MIN_ZOOM = 12;
const SLOPE_MAX_ZOOM = 15;
const SLOPE_META_KEY = "maptiles/slope/_meta.json";
const PUBLIC_SLOPE_META_KEY = "slope/meta.json";
/** A 1×1 transparent PNG, scaled up by the map. */
const EMPTY_PNG = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="),
  (c) => c.charCodeAt(0)
);

export function parseSlopePath(pathname: string): { z: number; x: number; y: number } | null {
  const m = pathname.match(/^\/tiles\/slope\/(\d{1,2})\/(\d{1,6})\/(\d{1,6})\.png$/);
  if (!m) return null;
  const [z, x, y] = m.slice(1).map(Number);
  return z >= SLOPE_MIN_ZOOM && z <= SLOPE_MAX_ZOOM && validTile(z, x, y) ? { z, x, y } : null;
}

export async function serveSlopeTile(
  request: Request,
  env: TilesEnv,
  ctx: ExecutionContext,
  origin: string,
  tile: { z: number; x: number; y: number }
): Promise<Response> {
  const { z, x, y } = tile;
  const cache = caches.default;
  const cacheKey = new Request(new URL(`/tiles/slope/${z}/${x}/${y}.png`, request.url).toString());
  const cached = await cache.match(cacheKey);
  if (cached) return cached;
  const stored = await readTile(env, ctx, "slope", z, x, y);
  const response = tileResponse(stored ? stored.data : EMPTY_PNG, "image/png", origin);
  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

/** GET /tiles/slope/meta: when the slope map was made, or 404 before it exists (the app then hides the layer). */
export async function slopeMeta(env: TilesEnv, origin: string): Promise<Response> {
  const stored = (await env.TILES?.get(PUBLIC_SLOPE_META_KEY)) ?? (await env.IMAGES.get(SLOPE_META_KEY));
  const headers = { ...corsHeaders(origin), "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" };
  if (!stored) return new Response(JSON.stringify({ error: "Ingen detaljerad lutningskarta än." }), { status: 404, headers });
  return new Response(stored.body, { headers });
}

/** POST /admin/tiles/slope/meta (upload token): marks the slope map as present. */
export async function saveSlopeMeta(request: Request, env: TilesEnv, origin: string): Promise<Response> {
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } });
  const token = request.headers.get("Authorization")?.match(/^Bearer\s+(\S+)$/)?.[1] ?? "";
  if (!env.TILE_UPLOAD_TOKEN || !token || !(await sameSecret(token, env.TILE_UPLOAD_TOKEN))) return json({ error: "Inte behörig." }, 401);
  let meta: unknown;
  try {
    meta = await request.json();
  } catch {
    return json({ error: "Ogiltig JSON." }, 400);
  }
  const httpMetadata = { contentType: "application/json", cacheControl: "public, max-age=3600" };
  if (env.TILES) await env.TILES.put(PUBLIC_SLOPE_META_KEY, JSON.stringify(meta), { httpMetadata });
  else await env.IMAGES.put(SLOPE_META_KEY, JSON.stringify(meta), { httpMetadata });
  return json({ ok: true });
}

/** The public key for something under the old "maptiles/" prefix in IMAGES. */
export function publicKeyFor(oldKey: string): string | null {
  if (oldKey === SLOPE_META_KEY) return PUBLIC_SLOPE_META_KEY;
  const m = oldKey.match(/^maptiles\/(topowebb|slope)\/(\d{1,2})\/(\d{1,6})\/(\d{1,6})$/);
  return m ? publicTileKey(Number(m[2]), Number(m[3]), Number(m[4]), m[1] as TileLayer) : null;
}

const MIGRATE_BATCH_MAX = 50;

/**
 * Streams an object into the bucket without reading it into memory, which
 * keeps each request well within the free plan's CPU time. (Outside the
 * Workers runtime, as in tests, it falls back to a plain copy.)
 */
async function copyBody(bucket: R2Bucket, key: string, from: R2ObjectBody, httpMetadata: R2HTTPMetadata) {
  if (typeof FixedLengthStream === "undefined") {
    await bucket.put(key, await from.arrayBuffer(), { httpMetadata });
    return;
  }
  const { readable, writable } = new FixedLengthStream(from.size);
  await Promise.all([bucket.put(key, readable, { httpMetadata }), from.body.pipeTo(writable)]);
}
const LIST_PAGE = 1000;

/**
 * POST /admin/tiles/migrate (upload token), used by scripts/migrate-tiles.ts
 * to move tiles from their old place in IMAGES to the public bucket:
 * - {list: "old" | "new", cursor?}: one page of keys ("maptiles/…" in IMAGES,
 *   or everything in TILES), so the script can work out what is missing;
 * - {keys: [...]}: copies up to 50 old keys, skipping any already there.
 * Each copied tile costs three R2 calls, well under the free plan's 1000 per
 * request, and the script runs several batches side by side.
 */
export async function migrateTiles(request: Request, env: TilesEnv, origin: string): Promise<Response> {
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } });
  const token = request.headers.get("Authorization")?.match(/^Bearer\s+(\S+)$/)?.[1] ?? "";
  if (!env.TILE_UPLOAD_TOKEN || !token || !(await sameSecret(token, env.TILE_UPLOAD_TOKEN))) return json({ error: "Inte behörig." }, 401);
  const tiles = env.TILES;
  if (!tiles) return json({ error: "Kartlagringen (TILES) saknas." }, 500);
  let body: { list?: unknown; cursor?: unknown; keys?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return json({ error: "Ogiltig JSON." }, 400);
  }

  if (body.list === "old" || body.list === "new") {
    const cursor = typeof body.cursor === "string" && body.cursor ? body.cursor : undefined;
    const listed =
      body.list === "old"
        ? await env.IMAGES.list({ prefix: "maptiles/", cursor, limit: LIST_PAGE })
        : await tiles.list({ cursor, limit: LIST_PAGE });
    return json({ keys: listed.objects.map((o) => o.key), cursor: listed.truncated ? listed.cursor : null });
  }

  const keys = Array.isArray(body.keys) ? body.keys.filter((k): k is string => typeof k === "string") : [];
  if (keys.length === 0 || keys.length > MIGRATE_BATCH_MAX) return json({ error: `Skicka 1–${MIGRATE_BATCH_MAX} nycklar.` }, 400);
  let copied = 0;
  let skipped = 0;
  await Promise.all(
    keys.map(async (key) => {
      const target = publicKeyFor(key);
      if (!target || (await tiles.head(target))) {
        skipped++;
        return;
      }
      const old = await env.IMAGES.get(key);
      if (!old) {
        skipped++;
        return;
      }
      const isMeta = target === PUBLIC_SLOPE_META_KEY;
      const type = old.httpMetadata?.contentType ?? (isMeta ? "application/json" : "image/png");
      const httpMetadata = isMeta ? { contentType: type, cacheControl: "public, max-age=3600" } : tileMetadata(type);
      await copyBody(tiles, target, old, httpMetadata);
      copied++;
    })
  );
  return json({ copied, skipped });
}

const OLD_TILE_KEY = /^maptiles\/(topowebb|slope)\/\d{1,2}\/\d{1,6}\/\d{1,6}$/;

/**
 * POST /admin/tiles/cleanup: removes the old copies of map tiles in IMAGES
 * (maptiles/<layer>/z/x/y), left from before they moved to the public bucket.
 * {list: "old" | "new", cursor?} lists keys with sizes (1000 a page) so the
 * caller can check that every old tile has a copy of the same size;
 * {delete: [keys]} (≤ 1000) then removes them – only old tile keys, never
 * photos, tracks, avatars or backups.
 */
export async function cleanupOldTiles(request: Request, env: TilesEnv, origin: string): Promise<Response> {
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } });
  const token = request.headers.get("Authorization")?.match(/^Bearer\s+(\S+)$/)?.[1] ?? "";
  if (!env.TILE_UPLOAD_TOKEN || !token || !(await sameSecret(token, env.TILE_UPLOAD_TOKEN))) return json({ error: "Inte behörig." }, 401);
  const tiles = env.TILES;
  if (!tiles) return json({ error: "Kartlagringen (TILES) saknas." }, 500);
  let body: { list?: unknown; cursor?: unknown; delete?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return json({ error: "Ogiltig JSON." }, 400);
  }
  if (body.list === "old" || body.list === "new") {
    const cursor = typeof body.cursor === "string" && body.cursor ? body.cursor : undefined;
    const listed =
      body.list === "old"
        ? await env.IMAGES.list({ prefix: "maptiles/", cursor, limit: LIST_PAGE })
        : await tiles.list({ cursor, limit: LIST_PAGE });
    return json({ objects: listed.objects.map((o) => [o.key, o.size]), cursor: listed.truncated ? listed.cursor : null });
  }
  const keys = Array.isArray(body.delete) ? body.delete : [];
  if (keys.length === 0 || keys.length > LIST_PAGE) return json({ error: `Skicka 1–${LIST_PAGE} nycklar.` }, 400);
  if (!keys.every((k): k is string => typeof k === "string" && OLD_TILE_KEY.test(k))) {
    return json({ error: "Bara gamla kartbitar (maptiles/…) kan tas bort här." }, 400);
  }
  await env.IMAGES.delete(keys);
  return json({ deleted: keys.length });
}
