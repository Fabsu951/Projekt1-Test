import { useEffect, useState } from "react";
import { CircleMarker, MapContainer, Polyline, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import TopoLayer from "./TopoLayer";
import { t } from "../i18n";

const FOLLOW_ZOOM = 14;

/** Keeps the latest position in view until the map is dragged. */
function Follow({ at, following, onDrag }: { at: [number, number] | null; following: boolean; onDrag: () => void }) {
  const map = useMap();
  useMapEvents({ dragstart: onDrag });
  useEffect(() => {
    if (at && following) map.setView(at, Math.max(map.getZoom(), FOLLOW_ZOOM), { animate: false });
  }, [map, at, following]);
  return null;
}

/** The track recorded so far on the topo map, with where you are now. */
export default function RecordingMap({ segments, at }: { segments: Array<Array<[number, number]>>; at: [number, number] | null }) {
  const [following, setFollowing] = useState(true);
  return (
    <div className="track-map recording-map">
      <MapContainer center={at ?? [65.6, 15.2]} zoom={at ? FOLLOW_ZOOM : 5} scrollWheelZoom>
        <TopoLayer />
        {segments.map((s, i) => s.length > 1 && <Polyline key={i} positions={s} pathOptions={{ className: "track-map__line", weight: 4 }} />)}
        {at && <CircleMarker center={at} radius={8} pathOptions={{ className: "recording-map__here" }} />}
        <Follow at={at} following={following} onDrag={() => setFollowing(false)} />
      </MapContainer>
      {!following && at && (
        <button type="button" className="button recording-map__follow" onClick={() => setFollowing(true)}>
          {t("Följ min position")}
        </button>
      )}
    </div>
  );
}
