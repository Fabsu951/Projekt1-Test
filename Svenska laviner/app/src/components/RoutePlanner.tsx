import { useEffect, useRef } from "react";
import { CircleMarker, Marker, Polyline, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { SLOPE_BANDS, slopeRuns, type LatLon, type RouteSample } from "../utils/routePlan";

function pointIcon(kind: "start" | "middle" | "end") {
  return L.divIcon({
    className: `route-point route-point--${kind}`,
    html: "<span></span>",
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}
const ICONS = { start: pointIcon("start"), middle: pointIcon("middle"), end: pointIcon("end") };

/**
 * The route being planned, on the map: a click adds a point, points can be
 * dragged, and the line is coloured by how steep the ground under it is.
 */
export default function RoutePlanner({
  waypoints,
  onChange,
  samples,
  hovered,
  flagged,
}: {
  waypoints: LatLon[];
  onChange: (next: LatLon[]) => void;
  samples: RouteSample[] | null;
  hovered: RouteSample | null;
  /** Per sample: steep ground matching today's forecast problems, drawn marked. */
  flagged: boolean[] | null;
}) {
  const map = useMap();
  // Coming back to a saved route: show it once when planning opens.
  const framed = useRef(false);
  useEffect(() => {
    if (framed.current) return;
    framed.current = true;
    if (waypoints.length > 1) map.fitBounds(L.latLngBounds(waypoints), { padding: [40, 40], maxZoom: 14 });
    else if (waypoints.length === 1) map.setView(waypoints[0], Math.max(map.getZoom(), 12));
  }, [map, waypoints]);

  // Heights and slopes come from Mapterhorn's open elevation data.
  useEffect(() => {
    const credit = '&copy; <a href="https://mapterhorn.com/attribution/" target="_blank" rel="noreferrer">Mapterhorn</a> (höjddata)';
    map.attributionControl?.addAttribution(credit);
    return () => {
      map.attributionControl?.removeAttribution(credit);
    };
  }, [map]);

  useMapEvents({
    click: (e) => onChange([...waypoints, [e.latlng.lat, e.latlng.lng]]),
  });

  const runs = samples && samples.length > 1 ? slopeRuns(samples) : null;

  return (
    <>
      {runs ? (
        <>
          {runs.map((run, i) => (
            <Polyline key={`casing-${i}`} positions={run.positions} interactive={false} pathOptions={{ color: "#1b2530", weight: 8, opacity: 0.75 }} />
          ))}
          {runs.map((run, i) => (
            <Polyline
              key={`run-${i}`}
              positions={run.positions}
              interactive={false}
              pathOptions={{ color: run.band === null ? "#9aa7b4" : SLOPE_BANDS[run.band].color, weight: 5, opacity: 1 }}
            />
          ))}
        </>
      ) : (
        waypoints.length > 1 && (
          <Polyline positions={waypoints} interactive={false} pathOptions={{ color: "#1b2530", weight: 3, dashArray: "6 6" }} />
        )
      )}
      {samples &&
        flagged &&
        flaggedRuns(samples, flagged).map((positions, i) => (
          <Polyline
            key={`flag-${i}`}
            positions={positions}
            interactive={false}
            pathOptions={{ color: "#ffffff", weight: 3, dashArray: "2 7", lineCap: "round", opacity: 1 }}
          />
        ))}
      {waypoints.map((p, i) => (
        <Marker
          key={i}
          position={p}
          draggable
          zIndexOffset={1500}
          icon={i === 0 ? ICONS.start : i === waypoints.length - 1 ? ICONS.end : ICONS.middle}
          title={i === 0 ? "Start" : i === waypoints.length - 1 ? "Mål" : `Punkt ${i + 1}`}
          eventHandlers={{
            dragend: (e) => {
              const ll = (e.target as L.Marker).getLatLng();
              onChange(waypoints.map((w, j) => (j === i ? [ll.lat, ll.lng] : w)));
            },
          }}
        />
      ))}
      {hovered && (
        <CircleMarker center={[hovered.lat, hovered.lon]} radius={7} interactive={false} pathOptions={{ color: "#fff", weight: 3, fillColor: "#111", fillOpacity: 1 }} />
      )}
    </>
  );
}

/** Consecutive flagged samples as line pieces. */
function flaggedRuns(samples: RouteSample[], flagged: boolean[]): LatLon[][] {
  const runs: LatLon[][] = [];
  let current: LatLon[] | null = null;
  samples.forEach((s, i) => {
    if (i > 0 && flagged[i]) {
      if (!current) {
        current = [[samples[i - 1].lat, samples[i - 1].lon]];
        runs.push(current);
      }
      current.push([s.lat, s.lon]);
    } else current = null;
  });
  return runs;
}
