import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { DETAILED_SLOPE_ATTRIBUTION, DETAILED_SLOPE_URL } from "../services/mapTiles";

/** "Lutning, detaljerad": slope bands from Lantmäteriet's 1 m height model; under 30° is transparent. */
export default function DetailedSlopeLayer({ enabled }: { enabled: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (!enabled) return;
    const tiles = L.tileLayer(DETAILED_SLOPE_URL, {
      opacity: 0.7,
      minZoom: 12,
      maxNativeZoom: 15,
      maxZoom: 18,
      zIndex: 6,
      attribution: DETAILED_SLOPE_ATTRIBUTION,
    });
    tiles.addTo(map);
    return () => {
      tiles.remove();
    };
  }, [map, enabled]);
  return null;
}
