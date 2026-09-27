import { useEffect } from "react";
import { MapContainer, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import TopoLayer from "./TopoLayer";
import type { TrackPoint } from "../utils/trackImport";

function FitTrack({ positions }: { positions: Array<[number, number]> }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 1) map.fitBounds(L.latLngBounds(positions), { padding: [24, 24], maxZoom: 15 });
  }, [map, positions]);
  return null;
}

/** A GPS track on the topo map, framed to fit. */
export default function TrackMap({ track }: { track: TrackPoint[] }) {
  const positions = track.map((p) => [p[0], p[1]] as [number, number]);
  return (
    <div className="track-map">
      <MapContainer center={positions[0] ?? [65.6, 15.2]} zoom={positions.length ? 12 : 5} scrollWheelZoom>
        <TopoLayer />
        {positions.length > 1 && (
          <Polyline positions={positions} pathOptions={{ className: "track-map__line", weight: 4 }} />
        )}
        <FitTrack positions={positions} />
      </MapContainer>
    </div>
  );
}
