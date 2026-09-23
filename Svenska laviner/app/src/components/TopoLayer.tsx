import { TileLayer } from "react-leaflet";

// Lantmäteriet's free "Topografisk webbkarta Visning, översiktlig" (CC0),
// served through our Cloudflare Worker at /topowebb so the Basic Auth
// credentials for our Geotorget account stay server-side. Falls back to
// plain OpenStreetMap tiles when no proxy is configured (e.g. local dev
// without a deployed worker).
const PROXY_BASE = import.meta.env.VITE_MAP_PROXY_URL as string | undefined;

const TOPOWEBB_LAYER = "topowebb-ccby";
const TOPOWEBB_TILEMATRIXSET = "3857";

const TOPOWEBB_URL = PROXY_BASE
  ? `${PROXY_BASE.replace(/\/$/, "")}/topowebb?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${TOPOWEBB_LAYER}&STYLE=default&TILEMATRIXSET=${TOPOWEBB_TILEMATRIXSET}&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/png`
  : "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

const TOPOWEBB_ATTRIBUTION = PROXY_BASE
  ? '&copy; <a href="https://www.lantmateriet.se/">Lantmäteriet</a>, CC0'
  : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-bidragsgivare';

export default function TopoLayer() {
  return <TileLayer attribution={TOPOWEBB_ATTRIBUTION} url={TOPOWEBB_URL} maxZoom={17} />;
}
