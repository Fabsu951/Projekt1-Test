import type { SectorWindLoad } from "../utils/windAnalysis";
import { mostLoadedSectors } from "../utils/windAnalysis";

// Validated (node scripts/validate_palette.js --ordinal --mode dark --surface
// "#132132") 5-step single-hue sequential ramp. On this dark surface the
// darkest steps of the full blue ramp recede into the background, so the
// mapping is inverted from the usual light-surface convention: the
// lightest/most saturated step marks the HIGHEST load (it should pop),
// the darkest-but-still-visible step marks the lowest.
const LOAD_RAMP = ["#184f95", "#256abf", "#3987e5", "#6da7ec", "#9ec5f4"];
const NEUTRAL = "#3a4a5c";

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
  sectors: SectorWindLoad[];
}

export default function WindRose({ sectors }: Props) {
  const maxLoad = Math.max(0, ...sectors.map((s) => s.loadIndex));
  const top = mostLoadedSectors(sectors, 1)[0];

  const summary =
    maxLoad === 0
      ? "Ingen betydande vindtransport i prognosen."
      : `Mest vindlastat: ${top.sector}-vända sluttningar.`;

  return (
    <div className="wind-rose">
      <svg
        viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
        role="img"
        aria-label={`Vindlastros per väderstreck. ${summary}`}
        className="wind-rose__svg"
      >
        {sectors.map((s) => {
          const radius = maxLoad > 0 ? HUB_RADIUS + (MAX_RADIUS - HUB_RADIUS) * (s.loadIndex / maxLoad) : HUB_RADIUS + 8;
          return (
            <path
              key={s.sector}
              d={wedgePath(s.centerDegrees, radius)}
              fill={colorFor(s.loadIndex, maxLoad)}
            />
          );
        })}
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

      <p className="wind-rose__summary">{summary}</p>

      <table className="wind-rose__table">
        <caption>Vindlast per väderstreck (senaste prognosen)</caption>
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
