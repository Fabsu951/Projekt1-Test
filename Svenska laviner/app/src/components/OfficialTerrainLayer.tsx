import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import {
  NORWAY_RUNOUT_ATTRIBUTION,
  NORWAY_RUNOUT_URL,
  NORWAY_SLOPE_ATTRIBUTION,
  NORWAY_SLOPE_MAX_NATIVE_ZOOM,
  NORWAY_SLOPE_URL,
  OFFICIAL_TERRAIN_ATTRIBUTION,
  SWEDEN_RUNOUT_ATTRIBUTION,
  SWEDEN_RUNOUT_MAX_NATIVE_ZOOM,
  SWEDEN_RUNOUT_MIN_ZOOM,
  SWEDEN_RUNOUT_URL,
  officialTerrainAvailable,
  officialTerrainUrl,
  type OfficialTerrain,
} from "../services/mapTiles";

/** A 1×1 transparent PNG for runout tiles that don't exist (no runout there). */
const EMPTY_TILE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

/**
 * Naturvårdsverket's slope map on top of the topographic map (slope in Norway
 * from NVE). With `runout`, Norway gets NVE's map with possible runout zones
 * instead – it has the same slope classes from 30°, so the two never stack –
 * and Sweden gets Snöläge's own runout zones (`swedenRunout`, once made) on
 * Naturvårdsverket's slope map, so both sides look alike.
 */
export default function OfficialTerrainLayer({
  layer,
  runout = false,
  swedenRunout = false,
}: {
  layer: OfficialTerrain | null;
  runout?: boolean;
  swedenRunout?: boolean;
}) {
  const map = useMap();
  useEffect(() => {
    if (!layer && !runout) return;
    const slopeLayer = layer ?? (runout && officialTerrainAvailable ? "lutning" : null);
    const tiles = slopeLayer
      ? L.tileLayer(officialTerrainUrl(slopeLayer), {
          // Multiply: light parts (flat ground, which their map may draw light grey)
          // all but vanish and the colours tint the topographic map instead of covering it.
          className: "official-terrain-tiles",
          opacity: 0.85,
          minZoom: 6,
          maxNativeZoom: 15,
          maxZoom: 18,
          zIndex: 5,
          attribution: OFFICIAL_TERRAIN_ATTRIBUTION,
        }).addTo(map)
      : null;
    // Naturvårdsverket's map stops at the border; NVE's covers Norway (and is empty over Sweden).
    const norway =
      runout || layer === "lutning"
        ? L.tileLayer(runout ? NORWAY_RUNOUT_URL : NORWAY_SLOPE_URL, {
            className: "official-terrain-tiles",
            opacity: 0.85,
            minZoom: 6,
            maxNativeZoom: NORWAY_SLOPE_MAX_NATIVE_ZOOM,
            maxZoom: 18,
            zIndex: 5,
            attribution: runout ? NORWAY_RUNOUT_ATTRIBUTION : NORWAY_SLOPE_ATTRIBUTION,
          }).addTo(map)
        : null;
    // Snöläge's own zones, drawn like NVE's so both sides of the border look alike.
    const sweden =
      runout && swedenRunout && SWEDEN_RUNOUT_URL
        ? L.tileLayer(SWEDEN_RUNOUT_URL, {
            className: "official-terrain-tiles",
            opacity: 0.85,
            minZoom: SWEDEN_RUNOUT_MIN_ZOOM,
            maxNativeZoom: SWEDEN_RUNOUT_MAX_NATIVE_ZOOM,
            maxZoom: 18,
            zIndex: 6,
            errorTileUrl: EMPTY_TILE,
            attribution: SWEDEN_RUNOUT_ATTRIBUTION,
          }).addTo(map)
        : null;
    return () => {
      tiles?.remove();
      norway?.remove();
      sweden?.remove();
    };
  }, [map, layer, runout, swedenRunout]);
  return null;
}
