import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Polyline, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import type { TourLine } from "../types/tour";
import { buildHeatGrid, cellSizeM, HEAT_BANDS, heatRuns, toursNear } from "../utils/heatGrid";
import { t, locale, plural } from "../i18n";

const LISTED = 5;

/**
 * Shared tours coloured by how many have gone the same way: each stretch
 * gets the band of the number of different tours passing there (see the
 * legend). Tapping a line lists those tours. Drawn on one canvas so
 * hundreds of lines stay fast.
 */
export default function TourHeatmap({ lines }: { lines: TourLine[] }) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  const [picked, setPicked] = useState<{ at: L.LatLng; ids: number[] } | null>(null);
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });

  const renderer = useMemo(() => L.canvas({ padding: 0.5, tolerance: 6 }), []);
  const grid = useMemo(() => buildHeatGrid(lines, cellSizeM(zoom)), [lines, zoom]);
  const runs = useMemo(() => heatRuns(lines, grid), [lines, grid]);
  const byId = useMemo(() => new Map(lines.map((l) => [l.id, l])), [lines]);

  const pickedTours = picked?.ids.map((id) => byId.get(id)).filter((l): l is TourLine => Boolean(l)) ?? [];

  return (
    <>
      {runs.map((run, i) => {
        const band = HEAT_BANDS[run.band];
        return (
          <Polyline
            key={`heat-${run.lineId}-${i}-${zoom}`}
            positions={run.positions}
            pathOptions={{ renderer, color: band.color, weight: band.weight, opacity: 0.9, lineCap: "round", lineJoin: "round" }}
            eventHandlers={{
              click: (e) => setPicked({ at: e.latlng, ids: toursNear(grid, [e.latlng.lat, e.latlng.lng], run.lineId) }),
            }}
          />
        );
      })}
      {picked && pickedTours.length > 0 && (
        <Popup position={picked.at} eventHandlers={{ remove: () => setPicked(null) }}>
          <strong>
            {plural(pickedTours.length, "1 delad tur har gått här", "{n} delade turer har gått här")}
          </strong>
          <ul className="heat-popup__list">
            {pickedTours.slice(0, LISTED).map((tour) => (
              <li key={tour.id}>
                <Link to={`/turer/${tour.id}`}>{tour.title ?? t("Tur")}</Link>
                {tour.startedAt && (
                  <span className="heat-popup__date">
                    {" "}
                    · {new Date(tour.startedAt).toLocaleDateString(locale(), { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {pickedTours.length > LISTED && <span>{t("… och {n} till", { n: pickedTours.length - LISTED })}</span>}
        </Popup>
      )}
    </>
  );
}

/** What the colours mean; shown over the map while the heatmap is on. */
export function HeatLegend() {
  return (
    <div className="heat-legend-box" role="note" aria-label={t("Färgförklaring för värmekartan")}>
      <span className="heat-legend-box__title">{t("Antal turer här")}</span>
      {HEAT_BANDS.map((b) => (
        <span key={b.label} className="heat-legend-box__item">
          <span className="heat-legend-box__swatch" style={{ backgroundColor: b.color, height: b.weight }} />
          {b.label}
        </span>
      ))}
    </div>
  );
}
