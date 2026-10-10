import { t } from "../i18n";
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

const OSM_ATTRIBUTION = t('&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-bidragsgivare');
export const TOPOWEBB_ATTRIBUTION = PROXY_BASE
  ? t('&copy; Lantmäteriet, <a href="https://creativecommons.org/licenses/by/4.0/deed.sv">CC BY 4.0</a> · utanför fjällen {osm}', { osm: OSM_ATTRIBUTION })
  : OSM_ATTRIBUTION;

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
 * The detailed slope map, made from Lantmäteriet's 1 m height model by
 * worker/scripts/import-slope.ts and hosted by the worker. Only offered once
 * the worker says it exists (GET /tiles/slope/meta).
 */
export const DETAILED_SLOPE_URL = `${workerBase()}/tiles/slope/{z}/{x}/{y}.png`;
export const DETAILED_SLOPE_ATTRIBUTION =
  t('Lutning beräknad från &copy; Lantmäteriet Markhöjdmodell, <a href="https://creativecommons.org/licenses/by/4.0/deed.sv">CC BY 4.0</a>');

let slopeMetaCheck: Promise<boolean> | null = null;

export function detailedSlopeAvailable(): Promise<boolean> {
  if (!PROXY_BASE) return Promise.resolve(false);
  slopeMetaCheck ??= fetch(`${workerBase()}/tiles/slope/meta`)
    .then((res) => res.ok)
    .catch(() => {
      slopeMetaCheck = null; // try again next time, e.g. when back online
      return false;
    });
  return slopeMetaCheck;
}
