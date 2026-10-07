import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { OFFICIAL_TERRAIN_ATTRIBUTION, officialTerrainUrl, type OfficialTerrain } from "../services/mapTiles";

/** Naturvårdsverket's slope-angle or slope-aspect map on top of the topographic map. */
export default function OfficialTerrainLayer({ layer }: { layer: OfficialTerrain | null }) {
  const map = useMap();
  useEffect(() => {
    if (!layer) return;
    const tiles = L.tileLayer(officialTerrainUrl(layer), {
      opacity: 0.6,
      minZoom: 6,
      maxNativeZoom: 15,
      maxZoom: 18,
      zIndex: 5,
      attribution: OFFICIAL_TERRAIN_ATTRIBUTION,
    });
    tiles.addTo(map);
    return () => {
      tiles.remove();
    };
  }, [map, layer]);
  return null;
}
