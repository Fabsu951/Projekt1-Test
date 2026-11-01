import { t } from "../i18n";
import { timedFetch } from "../utils/timedFetch";
// Lantmäteriet's topographic map, served by our Cloudflare Worker at
// /tiles/topowebb/{z}/{x}/{y}.png. The worker hosts the tiles in R2 (from
// the CC BY 4.0 "Topografisk webbkarta Nedladdning, raster"), fills gaps from the
// old WMTS until it closes on 2026-12-31, and after that falls back to
// OpenStreetMap outside what we host. Without a configured worker (local
// dev) the map shows plain OpenStreetMap.
const PROXY_BASE = import.meta.env.VITE_MAP_PROXY_URL as string | undefined;

/**
 * Zoom 16 is in the map bucket for the mountain boxes (workflow "Kartbitar
 * zoom 16", imported 1 Nov 2026: 833 348 tiles); elsewhere, and for tiles not
 * saved offline, the map shows zoom 15 enlarged (OfflineTileLayer's
 * enlargeParentAbove).
 */
export const TOPOWEBB_Z16 = true;
/** Highest zoom we host tiles for; Leaflet enlarges them beyond that. */
export const TOPOWEBB_MAX_NATIVE_ZOOM = PROXY_BASE ? (TOPOWEBB_Z16 ? 16 : 15) : undefined;
/** Above this, a missing tile shows its parent enlarged. */
export const TOPOWEBB_FULL_ZOOM = 15;

export const TOPOWEBB_URL = PROXY_BASE
  ? `${PROXY_BASE.replace(/\/$/, "")}/tiles/topowebb/{z}/{x}/{y}.png`
  : "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

/** The URL of one tile, exactly as the map layer requests it (so offline copies match). */
export function topoTileUrl(z: number, x: number, y: number): string {
  return TOPOWEBB_URL.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y));
}

// Lantmäteriet's map stops at the border (Norway is plain white), but tours
// often cross it. Kartverket's topographic map (CC BY 4.0, open, no key) is
// drawn on top: its tiles are transparent over Sweden from about zoom 7, so
// only Norway shows from it. Not needed with plain OpenStreetMap.
export const NORWAY_TOPO_URL = PROXY_BASE
  ? "https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png"
  : null;
/** Below this Kartverket's tiles still cover parts of Sweden. */
export const NORWAY_MIN_ZOOM = 7;
/** Kartverket has zoom 16 everywhere; offline copies stop at 15, which is then enlarged. */
export const NORWAY_MAX_NATIVE_ZOOM = 16;

/** One Kartverket tile's URL, exactly as the map layer requests it. */
export function norwayTileUrl(z: number, x: number, y: number): string | null {
  if (!NORWAY_TOPO_URL || z < NORWAY_MIN_ZOOM) return null;
  return NORWAY_TOPO_URL.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y));
}

/** Every tile the map shows at one place (Lantmäteriet's and, near Norway, Kartverket's): what offline saves store. */
export function mapTileUrls(z: number, x: number, y: number): string[] {
  const norway = norwayTileUrl(z, x, y);
  return norway ? [topoTileUrl(z, x, y), norway] : [topoTileUrl(z, x, y)];
}

// The same tiles are public in the map bucket at kartor.snolage.se (R2 custom
// domain), which the app uses instead of the worker whenever it answers:
// worker requests are capped per day on Cloudflare's free plan, R2 reads
// through the domain are not. The worker URL stays the tile's identity (offline
// copies are stored under it) and the fallback when the bucket lacks a tile.
const DIRECT_BASE = ((import.meta.env.VITE_TILE_DIRECT_URL as string | undefined) ?? "").replace(/\/$/, "");

/**
 * The areas whose tiles are in the bucket at every zoom (worker/src/gpkgTiles.ts
 * MOUNTAIN_BOXES, [west, south, east, north]); up to zoom 7 it has all of Sweden.
 */
const HOSTED_BOXES: Array<[number, number, number, number]> = [
  [16.85, 67.43, 20.51, 68.72],
  [13.77, 64.7, 16.43, 66.35],
  [11.65, 62.11, 14.2, 63.94],
];
const HOSTED_OVERVIEW_MAX_ZOOM = 7;
const HOSTED_MAX_ZOOM = TOPOWEBB_Z16 ? 16 : 15;

/** Whether the map bucket should have this tile (outside, the worker decides where it comes from). */
export function hostedTile(z: number, x: number, y: number): boolean {
  if (z > HOSTED_MAX_ZOOM) return false;
  if (z <= HOSTED_OVERVIEW_MAX_ZOOM) return true;
  const n = 2 ** z;
  const tileX = (lon: number) => Math.floor(((lon + 180) / 360) * n);
  const tileY = (lat: number) => {
    const r = (lat * Math.PI) / 180;
    return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n);
  };
  return HOSTED_BOXES.some(([west, south, east, north]) => x >= tileX(west) && x <= tileX(east) && y >= tileY(north) && y <= tileY(south));
}

/** The map bucket's address for a worker tile URL, or null when it isn't one we host there. */
export function directTileFor(url: string): string | null {
  if (!DIRECT_BASE) return null;
  const m = url.match(/\/tiles\/(topowebb|slope)\/(\d{1,2})\/(\d{1,6})\/(\d{1,6})\.png$/);
  if (!m) return null;
  const [layer, z, x, y] = [m[1], Number(m[2]), Number(m[3]), Number(m[4])];
  if (layer === "topowebb" && !hostedTile(z, x, y)) return null;
  return `${DIRECT_BASE}/${layer}/${z}/${x}/${y}.png`;
}

let directCheck: Promise<boolean> | null = null;
/** Set once the probe has found the bucket unreachable (until it is asked again). */
let directDown = false;

/**
 * Whether kartor.snolage.se answers with a tile, asked once per visit (and
 * again after 5 minutes if it didn't, e.g. after being offline).
 */
export function directTilesReady(): Promise<boolean> {
  if (!DIRECT_BASE || !PROXY_BASE) return Promise.resolve(false);
  directCheck ??= (async () => {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 4000);
    try {
      const res = await fetch(`${DIRECT_BASE}/topowebb/0/0/0.png`, { signal: abort.signal });
      return res.ok && (res.headers.get("Content-Type") ?? "").startsWith("image/");
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  })().then((ok) => {
    directDown = !ok;
    if (!ok) setTimeout(() => (directCheck = null), 5 * 60_000);
    return ok;
  });
  return directCheck;
}

/**
 * Where to show a map tile from without waiting: the bucket unless it is
 * known to be down (the caller falls back to the worker URL if it fails).
 */
export function quickTileUrl(url: string): string {
  const direct = directTileFor(url);
  if (!direct) return url;
  void directTilesReady();
  return directDown ? url : direct;
}

/** Where to load a tile from: the map bucket when it works and has the tile, else the worker URL itself. */
export async function networkTileUrl(url: string): Promise<string> {
  const direct = directTileFor(url);
  return direct && (await directTilesReady()) ? direct : url;
}

/** Offline areas are only offered for our own tiles, never for openstreetmap.org. */
export const offlineMapsAvailable = Boolean(PROXY_BASE);

const OSM_ATTRIBUTION = t('&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-bidragsgivare');
export const TOPOWEBB_ATTRIBUTION = PROXY_BASE
  ? t('&copy; Lantmäteriet, <a href="https://creativecommons.org/licenses/by/4.0/deed.sv">CC BY 4.0</a> · utanför fjällen {osm}', { osm: OSM_ATTRIBUTION })
  : OSM_ATTRIBUTION;
export const NORWAY_TOPO_ATTRIBUTION = t('Norge: &copy; <a href="https://www.kartverket.no/">Kartverket</a>, <a href="https://creativecommons.org/licenses/by/4.0/deed.sv">CC BY 4.0</a>');

/**
 * Naturvårdsverket's official terrain maps (slope angle and aspect), through
 * the worker so their servers are asked once per tile, not once per user.
 */
export type OfficialTerrain = "lutning" | "riktning";
export const officialTerrainAvailable = Boolean(PROXY_BASE);
const workerBase = () => (PROXY_BASE ?? "").replace(/\/$/, "");
export const officialTerrainUrl = (layer: OfficialTerrain) => `${workerBase()}/terrain/${layer}/{z}/{x}/{y}.png`;
export const officialTerrainLegendUrl = (layer: OfficialTerrain) => `${workerBase()}/terrain/${layer}/legend.png`;
export const OFFICIAL_TERRAIN_ATTRIBUTION =
  t('Terrängkarta: <a href="https://www.lavinprognoser.se/">Naturvårdsverket</a>');

/**
 * NVE's slope map for Norway ("Bratthet", the one Varsom shows): a public
 * Web Mercator tile cache, transparent outside Norway, tiles up to zoom 16.
 * Shown with Naturvårdsverket's slope map, which stops at the border.
 */
export const NORWAY_SLOPE_URL = "https://gis3.nve.no/arcgis/rest/services/wmts/Bratthet_2024/MapServer/tile/{z}/{y}/{x}";
export const NORWAY_SLOPE_MAX_NATIVE_ZOOM = 16;
export const NORWAY_SLOPE_ATTRIBUTION = t('Bratthet i Norge: &copy; <a href="https://www.nve.no/">NVE</a>');
/** NVE's classes and colours, from their legend. */
export const NORWAY_SLOPE_LEGEND: Array<[string, string]> = [
  ["27–30°", "#38a800"],
  ["30–35°", "#ffff00"],
  ["35–40°", "#ffaa00"],
  ["40–45°", "#ff5500"],
  ["45–50°", "#ff0000"],
  ["> 50°", "#730000"],
];

/**
 * The detailed slope map, made from Lantmäteriet's 1 m height model by
 * worker/scripts/import-slope.ts and hosted by the worker. Only offered once
 * the worker says it exists (GET /tiles/slope/meta).
 */
export const DETAILED_SLOPE_URL = `${workerBase()}/tiles/slope/{z}/{x}/{y}.png`;
/** The same slope tiles in the map bucket (a missing tile there is simply ground under 30°). */
export const DIRECT_SLOPE_URL = DIRECT_BASE ? `${DIRECT_BASE}/slope/{z}/{x}/{y}.png` : DETAILED_SLOPE_URL;
export const DETAILED_SLOPE_ATTRIBUTION =
  t('Lutning beräknad från &copy; Lantmäteriet Markhöjdmodell, <a href="https://creativecommons.org/licenses/by/4.0/deed.sv">CC BY 4.0</a>');

let slopeMetaCheck: Promise<boolean> | null = null;

export function detailedSlopeAvailable(): Promise<boolean> {
  if (!PROXY_BASE) return Promise.resolve(false);
  slopeMetaCheck ??= timedFetch(`${workerBase()}/tiles/slope/meta`, {}, 10_000)
    .then((res) => res.ok)
    .catch(() => {
      slopeMetaCheck = null; // try again next time, e.g. when back online
      return false;
    });
  return slopeMetaCheck;
}
