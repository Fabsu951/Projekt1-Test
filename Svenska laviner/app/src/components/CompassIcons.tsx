import type { CompassSector } from "../utils/windAnalysis";
import { COMPASS_SECTORS } from "../utils/windAnalysis";
import { t, compass } from "../i18n";

interface WindArrowProps {
  /** Meteorological direction the wind blows FROM, in degrees. */
  fromDegrees: number;
  size?: number;
}

/** Arrow pointing where the wind blows TO (so a west wind points east). */
export function WindArrow({ fromDegrees, size = 16 }: WindArrowProps) {
  return (
    <svg className="wind-arrow" viewBox="0 0 16 16" width={size} height={size} aria-hidden="true">
      <g transform={`rotate(${fromDegrees + 180} 8 8)`}>
        <line x1={8} y1={14} x2={8} y2={4} strokeWidth={1.8} strokeLinecap="round" />
        <polygon points="8,1 4.2,6 11.8,6" />
      </g>
    </svg>
  );
}

const CX = 24;
const CY = 28;
const R_OUTER = 19;
const R_INNER = 6;

function sectorPath(index: number): string {
  const toXY = (deg: number, r: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return `${CX + r * Math.cos(rad)} ${CY + r * Math.sin(rad)}`;
  };
  const start = index * 45 - 22.5;
  const end = index * 45 + 22.5;
  return `M ${toXY(start, R_INNER)} L ${toXY(start, R_OUTER)} A ${R_OUTER} ${R_OUTER} 0 0 1 ${toXY(end, R_OUTER)} L ${toXY(end, R_INNER)} A ${R_INNER} ${R_INNER} 0 0 0 ${toXY(start, R_INNER)} Z`;
}

interface AspectRosetteProps {
  /** Aspects (the way slopes face) to highlight. */
  highlighted: CompassSector[];
  size?: number;
  label?: string;
}

/**
 * The 8-sector aspect rosette avalanche forecasts use to show which slope
 * aspects are affected; highlighted sectors are filled orange.
 */
export function AspectRosette({ highlighted, size = 52, label }: AspectRosetteProps) {
  return (
    <svg
      className="aspect-rosette"
      viewBox="0 0 48 48"
      width={size}
      height={size}
      role="img"
      aria-label={label ?? t("Utsatta väderstreck: {list}", { list: highlighted.map(compass).join(", ") || t("inga") })}
    >
      {COMPASS_SECTORS.map((sector, i) => (
        <path
          key={sector}
          d={sectorPath(i)}
          className={
            highlighted.includes(sector) ? "aspect-rosette__sector aspect-rosette__sector--on" : "aspect-rosette__sector"
          }
        />
      ))}
      <text x={CX} y={7} textAnchor="middle" className="aspect-rosette__north">
        N
      </text>
    </svg>
  );
}
