import { Preferences } from "@capacitor/preferences";
import type { AvalancheRegion } from "../types/avalanche";

/**
 * Offline map areas. Tiles are stored with the Cache Storage API in one
 * cache per region, so a saved area can be removed on its own. Only map
 * tiles are cached this way; the app's own code and data never are.
 */

export type OfflineLevel = "oversikt" | "detaljerad";

export const OFFLINE_LEVELS: Record<OfflineLevel, { label: string; maxZoom: number }> = {
  oversikt: { label: "Översikt", maxZoom: 13 },
  detaljerad: { label: "Detaljerad", maxZoom: 14 },
};

const MIN_ZOOM = 8;
/** Half the side of the saved square around a region's centre. */
const HALF_SIDE_KM = 30;
/** Rough average size of a topo tile, for size estimates only. */
const AVERAGE_TILE_BYTES = 25_000;
const PARALLEL = 6;
const META_KEY = "fjallkoll:offline-maps";

export interface SavedArea {
  level: OfflineLevel;
  tiles: number;
  bytes: number;
  savedAt: string;
}

export interface Bounds {
  north: number;
  south: number;
  west: number;
  east: number;
}

export function offlineBounds(region: Pick<AvalancheRegion, "lat" | "lon">): Bounds {
  const dLat = HALF_SIDE_KM / 111.2;
  const dLon = HALF_SIDE_KM / (111.2 * Math.cos((region.lat * Math.PI) / 180));
  return { north: region.lat + dLat, south: region.lat - dLat, west: region.lon - dLon, east: region.lon + dLon };
}

function tileX(lon: number, z: number): number {
  return Math.floor(((lon + 180) / 360) * 2 ** z);
}

function tileY(lat: number, z: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z);
}

/** Every tile (z/x/y) covering the bounds from MIN_ZOOM up to maxZoom. */
export function tilesFor(bounds: Bounds, maxZoom: number): Array<[number, number, number]> {
  const tiles: Array<[number, number, number]> = [];
  for (let z = MIN_ZOOM; z <= maxZoom; z++) {
    for (let x = tileX(bounds.west, z); x <= tileX(bounds.east, z); x++) {
      for (let y = tileY(bounds.north, z); y <= tileY(bounds.south, z); y++) tiles.push([z, x, y]);
    }
  }
  return tiles;
}

export function estimateBytes(tileCount: number): number {
  return tileCount * AVERAGE_TILE_BYTES;
}

export function formatMegabytes(bytes: number): string {
  return `${Math.max(1, Math.round(bytes / 1_000_000))} MB`;
}

export function offlineSupported(): boolean {
  return typeof window !== "undefined" && "caches" in window;
}

const cacheName = (regionId: string) => `fjallkoll-tiles-${regionId}`;

async function readMeta(): Promise<Record<string, SavedArea>> {
  try {
    const { value } = await Preferences.get({ key: META_KEY });
    const parsed = value ? JSON.parse(value) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeMeta(meta: Record<string, SavedArea>): Promise<void> {
  await Preferences.set({ key: META_KEY, value: JSON.stringify(meta) });
}

export async function savedArea(regionId: string): Promise<SavedArea | null> {
  return (await readMeta())[regionId] ?? null;
}

/** Every saved region map, by region id. */
export async function listAreas(): Promise<Record<string, SavedArea>> {
  return readMeta();
}

export interface DownloadProgress {
  done: number;
  total: number;
}

/**
 * Tiles within `padKm` of a line (e.g. a planned route), from `minZoom` to
 * `maxZoom`. Much fewer than a rectangle around the whole route, so a route
 * can be saved in full detail.
 */
export function corridorTiles(
  points: Array<[number, number]>,
  padKm: number,
  minZoom: number,
  maxZoom: number
): Array<[number, number, number]> {
  const tiles: Array<[number, number, number]> = [];
  if (points.length === 0) return tiles;
  for (let z = minZoom; z <= maxZoom; z++) {
    const midLat = points[0][0];
    const tileKm = (40075 * Math.cos((midLat * Math.PI) / 180)) / 2 ** z;
    const pad = Math.ceil(padKm / tileKm);
    const seen = new Set<string>();
    const add = (lat: number, lon: number) => {
      const cx = tileX(lon, z);
      const cy = tileY(lat, z);
      for (let x = cx - pad; x <= cx + pad; x++) {
        for (let y = cy - pad; y <= cy + pad; y++) {
          const key = `${x}/${y}`;
          if (seen.has(key)) continue;
          seen.add(key);
          tiles.push([z, x, y]);
        }
      }
    };
    // Walk the line in steps of a third of a tile so no tile is skipped.
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[i + 1] ?? a;
      const km = Math.hypot((b[0] - a[0]) * 111.2, (b[1] - a[1]) * 111.2 * Math.cos((a[0] * Math.PI) / 180));
      const steps = Math.max(1, Math.ceil(km / (tileKm / 3)));
      for (let s = 0; s < steps; s++) add(a[0] + ((b[0] - a[0]) * s) / steps, a[1] + ((b[1] - a[1]) * s) / steps);
    }
  }
  return tiles;
}

/**
 * Downloads tiles into the named cache (tiles already cached are kept).
 * Throws if more than a few percent fail, e.g. without a connection.
 */
export async function downloadTiles(
  cacheKey: string,
  tiles: Array<[number, number, number]>,
  tileUrl: (z: number, x: number, y: number) => string,
  onProgress: (p: DownloadProgress) => void,
  signal?: AbortSignal
): Promise<{ tiles: number; bytes: number }> {
  const cache = await caches.open(cacheKey);
  let done = 0;
  let failed = 0;
  let bytes = 0;
  let next = 0;

  async function worker() {
    while (next < tiles.length) {
      if (signal?.aborted) throw new DOMException("Avbruten", "AbortError");
      const [z, x, y] = tiles[next++];
      const url = tileUrl(z, x, y);
      try {
        let response = await cache.match(url);
        if (!response) {
          const fresh = await fetch(url, { signal });
          if (!fresh.ok) throw new Error(String(fresh.status));
          await cache.put(url, fresh.clone());
          response = fresh;
        }
        // Await first: `bytes += await …` would read `bytes` before the await
        // and lose updates made by the other parallel workers meanwhile.
        const size = (await response.blob()).size;
        bytes += size;
      } catch (err) {
        if (signal?.aborted) throw err;
        failed++;
      }
      onProgress({ done: ++done, total: tiles.length });
    }
  }

  await Promise.all(Array.from({ length: PARALLEL }, worker));
  if (failed > tiles.length * 0.03) {
    throw new Error(`${failed} av ${tiles.length} kartbitar kunde inte hämtas. Kontrollera anslutningen och försök igen.`);
  }
  return { tiles: tiles.length - failed, bytes };
}

/** Downloads every tile for a region into its own cache. */
export async function downloadArea(
  region: Pick<AvalancheRegion, "id" | "lat" | "lon">,
  level: OfflineLevel,
  tileUrl: (z: number, x: number, y: number) => string,
  onProgress: (p: DownloadProgress) => void,
  signal?: AbortSignal
): Promise<SavedArea> {
  const tiles = tilesFor(offlineBounds(region), OFFLINE_LEVELS[level].maxZoom);
  const result = await downloadTiles(cacheName(region.id), tiles, tileUrl, onProgress, signal);
  const area: SavedArea = { level, tiles: result.tiles, bytes: result.bytes, savedAt: new Date().toISOString() };
  const meta = await readMeta();
  meta[region.id] = area;
  await writeMeta(meta);
  return area;
}

export async function removeArea(regionId: string): Promise<void> {
  await caches.delete(cacheName(regionId));
  const meta = await readMeta();
  delete meta[regionId];
  await writeMeta(meta);
}

/** A saved tile for this URL from any region's cache, if there is one. */
export async function cachedTile(url: string): Promise<Response | undefined> {
  if (!offlineSupported()) return undefined;
  try {
    return await caches.match(url);
  } catch {
    return undefined;
  }
}

// Areas saved straight from the map ("spara det jag ser"), besides the fixed
// squares around each forecast region.
const VIEWS_KEY = "fjallkoll:offline-views";
/** Keeps a saved view to a sensible size; zoom is lowered until it fits. */
const MAX_VIEW_TILES = 4000;
const MAX_VIEW_ZOOM = 15;

export interface SavedView {
  key: string;
  name: string;
  bounds: Bounds;
  maxZoom: number;
  tiles: number;
  bytes: number;
  savedAt: string;
}

/** The most detailed zoom (≤ 15) at which the area stays within the size limit, or null if even zoom 10 is too much. */
export function viewPlan(bounds: Bounds): { maxZoom: number; tiles: number } | null {
  for (let z = MAX_VIEW_ZOOM; z >= 10; z--) {
    const count = tilesFor(bounds, z).length;
    if (count <= MAX_VIEW_TILES) return { maxZoom: z, tiles: count };
  }
  return null;
}

async function readViews(): Promise<SavedView[]> {
  try {
    const { value } = await Preferences.get({ key: VIEWS_KEY });
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function listViews(): Promise<SavedView[]> {
  return readViews();
}

export async function saveView(
  bounds: Bounds,
  name: string,
  tileUrl: (z: number, x: number, y: number) => string,
  onProgress: (p: DownloadProgress) => void,
  signal?: AbortSignal
): Promise<SavedView> {
  const plan = viewPlan(bounds);
  if (!plan) throw new Error("Området är för stort. Zooma in lite och försök igen.");
  const key = `view-${Date.now()}`;
  const result = await downloadTiles(cacheName(key), tilesFor(bounds, plan.maxZoom), tileUrl, onProgress, signal);
  const view: SavedView = { key, name, bounds, maxZoom: plan.maxZoom, tiles: result.tiles, bytes: result.bytes, savedAt: new Date().toISOString() };
  await Preferences.set({ key: VIEWS_KEY, value: JSON.stringify([view, ...(await readViews())]) });
  return view;
}

export async function removeView(key: string): Promise<void> {
  await caches.delete(cacheName(key));
  await Preferences.set({ key: VIEWS_KEY, value: JSON.stringify((await readViews()).filter((v) => v.key !== key)) });
}
