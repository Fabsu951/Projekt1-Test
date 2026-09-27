import { useMemo } from "react";
import { Polyline } from "react-leaflet";
import L from "leaflet";
import type { TourLine } from "../types/tour";

const HEAT_COLOR = "#ff5a1f";

/**
 * Every shared tour as a thin, see-through line: where many people have
 * skied, the lines stack up into a bright band, like Strava's heatmap.
 * Drawn on one canvas so hundreds of lines stay fast.
 */
export default function TourHeatmap({ lines }: { lines: TourLine[] }) {
  const renderer = useMemo(() => L.canvas({ padding: 0.5 }), []);
  return (
    <>
      {lines.map((line) => (
        <Polyline
          key={`heat-${line.id}`}
          positions={line.points}
          interactive={false}
          pathOptions={{ renderer, color: HEAT_COLOR, weight: 3, opacity: 0.35, lineCap: "round", lineJoin: "round" }}
        />
      ))}
    </>
  );
}
