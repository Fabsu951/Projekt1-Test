// Lantmäteriet's topographic map, served by our Cloudflare Worker at
// /tiles/topowebb/{z}/{x}/{y}.png. The worker hosts the tiles in R2 (from
// the CC BY 4.0 "Topografisk webbkarta Nedladdning, raster"), fills gaps from the
// old WMTS until it closes on 2026-12-31, and after that falls back to
// OpenStreetMap outside what we host. Without a configured worker (local
// dev) the map shows plain OpenStreetMap.
const PROXY_BASE = import.meta.env.VITE_MAP_PROXY_URL as string | undefined;

/** Highest zoom we host tiles for; Leaflet enlarges them beyond that. */
export const TOPOWEBB_MAX_NATIVE_ZOOM = PROXY_BASE ? 15 : undefined;

export const TOPOWEBB_URL = PROXY_BASE
  ? `${PROXY_BASE.replace(/\/$/, "")}/tiles/topowebb/{z}/{x}/{y}.png`
  : "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

/** The URL of one tile, exactly as the map layer requests it (so offline copies match). */
export function topoTileUrl(z: number, x: number, y: number): string {
  return TOPOWEBB_URL.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y));
}

/** Offline areas are only offered for our own tiles, never for openstreetmap.org. */
export const offlineMapsAvailable = Boolean(PROXY_BASE);

const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-bidragsgivare';
export const TOPOWEBB_ATTRIBUTION = PROXY_BASE
  ? `&copy; Lantmäteriet, <a href="https://creativecommons.org/licenses/by/4.0/deed.sv">CC BY 4.0</a> · utanför fjällen ${OSM_ATTRIBUTION}`
  : OSM_ATTRIBUTION;
