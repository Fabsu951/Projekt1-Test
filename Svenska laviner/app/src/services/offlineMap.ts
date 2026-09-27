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

export interface DownloadProgress {
  done: number;
  total: number;
}

/**
 * Downloads every tile for a region into its own cache. Tiles already
 * cached are kept. Throws if more than a few percent fail, e.g. offline.
 */
export async function downloadArea(
  region: Pick<AvalancheRegion, "id" | "lat" | "lon">,
  level: OfflineLevel,
  tileUrl: (z: number, x: number, y: number) => string,
  onProgress: (p: DownloadProgress) => void,
  signal?: AbortSignal
): Promise<SavedArea> {
  const tiles = tilesFor(offlineBounds(region), OFFLINE_LEVELS[level].maxZoom);
  const cache = await caches.open(cacheName(region.id));
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
  const area: SavedArea = { level, tiles: tiles.length - failed, bytes, savedAt: new Date().toISOString() };
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
