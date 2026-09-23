import { useMemo } from "react";
import { AspectRosette } from "./CompassIcons";
import type { WindReading } from "../utils/windAnalysis";
import {
  computeWindLoading,
  mostLoadedSectors,
  NEAR_THRESHOLD_MS,
  oppositeSector,
  rawWindSummary,
  TRANSPORT_THRESHOLD_MS,
  windFromDistribution,
} from "../utils/windAnalysis";
import { windCompass } from "../utils/weatherFormat";

// Validated (node scripts/validate_palette.js --ordinal --mode dark --surface
// "#132132") 5-step single-hue sequential ramp. On this dark surface the
// darkest steps of the full blue ramp recede into the background, so the
// mapping is inverted from the usual light-surface convention: the
// lightest/most saturated step marks the HIGHEST load (it should pop),
// the darkest-but-still-visible step marks the lowest.
const LOAD_RAMP = ["#184f95", "#256abf", "#3987e5", "#6da7ec", "#9ec5f4"];
const NEUTRAL = "#3a4a5c";
// Direction-only (no transport) wedges: visibly lighter than NEUTRAL but
// grey, so they don't read as a step of the loading ramp.
const CALM_FILL = "#6b7c90";

const CENTER = 130;
const HUB_RADIUS = 26;
const MAX_RADIUS = 104;
const GAP_DEGREES = 3;
const VIEWBOX_SIZE = CENTER * 2;

function toXY(angleDeg: number, radius: number): [number, number] {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return [CENTER + radius * Math.cos(rad), CENTER + radius * Math.sin(rad)];
}

function wedgePath(centerDeg: number, radius: number): string {
  const start = centerDeg - 22.5 + GAP_DEGREES / 2;
  const end = centerDeg + 22.5 - GAP_DEGREES / 2;
  const [x1, y1] = toXY(start, radius);
  const [x2, y2] = toXY(end, radius);
  const [hx1, hy1] = toXY(start, HUB_RADIUS);
  const [hx2, hy2] = toXY(end, HUB_RADIUS);
  return `M ${hx1} ${hy1} L ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2} L ${hx2} ${hy2} A ${HUB_RADIUS} ${HUB_RADIUS} 0 0 0 ${hx1} ${hy1} Z`;
}

function colorFor(loadIndex: number, maxLoad: number): string {
  if (loadIndex <= 0 || maxLoad <= 0) return NEUTRAL;
  const step = Math.min(LOAD_RAMP.length - 1, Math.floor((loadIndex / maxLoad) * LOAD_RAMP.length));
  return LOAD_RAMP[step];
}

interface Props {
  /** Hourly wind readings (forecast or observed). */
  readings: WindReading[];
  /** Describes the data source in running Swedish text, e.g. "prognosen" or "mätningen". */
  sourceLabel: string;
  /** Table caption, e.g. "Vindlast per väderstreck (senaste prognosen)". */
  tableCaption: string;
}

export default function WindRose({ readings, sourceLabel, tableCaption }: Props) {
  const sectors = useMemo(() => computeWindLoading(readings), [readings]);
  const raw = useMemo(() => rawWindSummary(readings), [readings]);
  const fromDistribution = useMemo(() => windFromDistribution(readings), [readings]);

  const maxLoad = Math.max(0, ...sectors.map((s) => s.loadIndex));
  const top = mostLoadedSectors(sectors, 1)[0];
  const windFrom = top ? oppositeSector(top.sector) : null;

  // When nothing crosses the transport threshold, show where the wind came
  // FROM instead (in neutral grey), so a calm period doesn't look like
  // missing data.
  const calm = maxLoad === 0;
  const maxFromHours = Math.max(0, ...fromDistribution.map((d) => d.hours));
  const showCalmDirections = calm && maxFromHours > 0;
  const nearThreshold = calm && raw !== null && raw.maxSpeed >= NEAR_THRESHOLD_MS;

  const summary = !calm
    ? `Vind från ${windFrom} → mest vindlastat: ${top.sector}-vända sluttningar.`
    : raw
      ? `Ingen betydande vindtransport i ${sourceLabel} — högsta vinden var ${raw.maxSpeed.toFixed(1)} m/s (${windCompass(raw.maxSpeedDirection)}), under transportgränsen på ${TRANSPORT_THRESHOLD_MS} m/s.`
      : `Ingen betydande vindtransport i ${sourceLabel}.`;

  return (
    <div className="wind-rose">
      <svg
        viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
        role="img"
        aria-label={`Vindlastros per väderstreck. ${summary}`}
        className="wind-rose__svg"
      >
        {showCalmDirections
          ? fromDistribution.map((d) => {
              const radius = HUB_RADIUS + (MAX_RADIUS - HUB_RADIUS) * (d.hours / maxFromHours);
              return (
                <path
                  key={d.sector}
                  d={wedgePath(d.centerDegrees, d.hours > 0 ? radius : HUB_RADIUS + 8)}
                  fill={d.hours > 0 ? CALM_FILL : NEUTRAL}
                />
              );
            })
          : sectors.map((s) => {
              const radius = maxLoad > 0 ? HUB_RADIUS + (MAX_RADIUS - HUB_RADIUS) * (s.loadIndex / maxLoad) : HUB_RADIUS + 8;
              return (
                <path
                  key={s.sector}
                  d={wedgePath(s.centerDegrees, radius)}
                  fill={colorFor(s.loadIndex, maxLoad)}
                />
              );
            })}
        {top && (
          // Arrow across the hub: from the windward side toward the loaded lee side.
          <g className="wind-rose__arrow" transform={`rotate(${top.centerDegrees} ${CENTER} ${CENTER})`}>
            <line x1={CENTER} y1={CENTER + 18} x2={CENTER} y2={CENTER - 10} strokeWidth={3} />
            <polygon points={`${CENTER},${CENTER - 20} ${CENTER - 7},${CENTER - 8} ${CENTER + 7},${CENTER - 8}`} />
          </g>
        )}
        {calm && raw && (
          <text x={CENTER} y={CENTER} textAnchor="middle" className="wind-rose__hub-text">
            <tspan x={CENTER} dy="-0.2em">Ingen</tspan>
            <tspan x={CENTER} dy="1.1em">transport</tspan>
          </text>
        )}
        {sectors.map((s) => {
          const [lx, ly] = toXY(s.centerDegrees, MAX_RADIUS + 16);
          const isTop = top && s.sector === top.sector;
          return (
            <text
              key={s.sector}
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="middle"
              className={isTop ? "wind-rose__label wind-rose__label--top" : "wind-rose__label"}
            >
              {s.sector}
            </text>
          );
        })}
      </svg>

      <div className="wind-rose__summary-row">
        {!calm && (
          <AspectRosette
            highlighted={mostLoadedSectors(sectors, 2).map((s) => s.sector)}
            label={`Mest vindlastade väderstreck: ${mostLoadedSectors(sectors, 2)
              .map((s) => s.sector)
              .join(", ")}`}
          />
        )}
        <p className="wind-rose__summary">{summary}</p>
      </div>
      {showCalmDirections && (
        <p className="wind-rose__hint">De grå fälten visar varifrån vinden blåser, inte vindlast.</p>
      )}
      {!calm && (
        <p className="wind-rose__hint">Pilen visar vindens riktning; fälten visar var snön läggs (läsidan).</p>
      )}
      {nearThreshold && (
        <p className="wind-rose__near">
          Nära transportgränsen — lös snö kan ändå börja driva, särskilt i byar och på krön.
        </p>
      )}

      <table className="wind-rose__table">
        <caption>{tableCaption}</caption>
        <thead>
          <tr>
            <th scope="col">Väderstreck</th>
            <th scope="col">Timmar med vindtransport</th>
            <th scope="col">Relativt lastindex</th>
          </tr>
        </thead>
        <tbody>
          {sectors.map((s) => (
            <tr key={s.sector}>
              <th scope="row">{s.sector}</th>
              <td>{s.hoursWithTransport}</td>
              <td>{s.loadIndex}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
