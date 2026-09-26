import { TileLayer } from "react-leaflet";

// Lantmäteriet's topographic map, served by our Cloudflare Worker at
// /tiles/topowebb/{z}/{x}/{y}.png. The worker hosts the tiles in R2 (from
// the CC0 "Topografisk webbkarta Nedladdning, raster"), fills gaps from the
// old WMTS until it closes on 2026-12-31, and after that falls back to
// OpenStreetMap outside what we host. Without a configured worker (local
// dev) the map shows plain OpenStreetMap.
const PROXY_BASE = import.meta.env.VITE_MAP_PROXY_URL as string | undefined;

// Highest zoom we host tiles for; Leaflet enlarges them beyond that.
const TOPOWEBB_MAX_NATIVE_ZOOM = 15;

const TOPOWEBB_URL = PROXY_BASE
  ? `${PROXY_BASE.replace(/\/$/, "")}/tiles/topowebb/{z}/{x}/{y}.png`
  : "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-bidragsgivare';
const TOPOWEBB_ATTRIBUTION = PROXY_BASE
  ? `&copy; <a href="https://www.lantmateriet.se/">Lantmäteriet</a>, CC0 · utanför fjällen ${OSM_ATTRIBUTION}`
  : OSM_ATTRIBUTION;

export default function TopoLayer() {
  return (
    <TileLayer
      attribution={TOPOWEBB_ATTRIBUTION}
      url={TOPOWEBB_URL}
      maxZoom={19}
      maxNativeZoom={PROXY_BASE ? TOPOWEBB_MAX_NATIVE_ZOOM : undefined}
    />
  );
}
