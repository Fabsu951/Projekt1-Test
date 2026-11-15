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
  officialTerrainUrl,
  type OfficialTerrain,
} from "../services/mapTiles";

/**
 * Naturvårdsverket's slope map on top of the topographic map (slope in Norway
 * from NVE). With `runout`, Norway gets NVE's map with possible runout zones
 * instead – it has the same slope classes from 30°, so the two never stack.
 */
export default function OfficialTerrainLayer({ layer, runout = false }: { layer: OfficialTerrain | null; runout?: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (!layer && !runout) return;
    const tiles = layer ? L.tileLayer(officialTerrainUrl(layer), {
      // Multiply: light parts (flat ground, which their map may draw light grey)
      // all but vanish and the colours tint the topographic map instead of covering it.
      className: "official-terrain-tiles",
      opacity: 0.85,
      minZoom: 6,
      maxNativeZoom: 15,
      maxZoom: 18,
      zIndex: 5,
      attribution: OFFICIAL_TERRAIN_ATTRIBUTION,
    }) : null;
    tiles?.addTo(map);
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
    return () => {
      tiles?.remove();
      norway?.remove();
    };
  }, [map, layer, runout]);
  return null;
}
