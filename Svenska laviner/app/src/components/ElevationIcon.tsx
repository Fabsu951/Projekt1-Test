import { useId } from "react";
import type { Elevation } from "../types/avalanche";
import { ELEVATION_LABELS } from "../data/elevations";
import { t } from "../i18n";

// Top to bottom: the y-range of each band inside the mountain.
const BANDS: Array<[Elevation, number, number]> = [
  ["kalfjall", 6, 19],
  ["tradgrans", 19, 31],
  ["under_tradgrans", 31, 44],
];

interface Props {
  highlighted: Elevation[];
  size?: number;
}

/** A mountain split into the forecast's three elevation bands; affected bands are orange. */
export default function ElevationIcon({ highlighted, size = 52 }: Props) {
  const clipId = useId();
  const label = t("Utsatta höjder: {list}", { list: highlighted.map((e) => ELEVATION_LABELS[e]).join(", ") || t("inga") });
  return (
    <svg className="elevation-icon" viewBox="0 0 48 48" width={size} height={size} role="img" aria-label={label}>
      <clipPath id={clipId}>
        <path d="M3 44 L24 6 L45 44 Z" />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        {BANDS.map(([band, y1, y2]) => (
          <rect
            key={band}
            x={0}
            y={y1}
            width={48}
            height={y2 - y1}
            className={
              highlighted.includes(band) ? "elevation-icon__band elevation-icon__band--on" : "elevation-icon__band"
            }
          />
        ))}
        <line x1={0} y1={19} x2={48} y2={19} className="elevation-icon__divider" />
        <line x1={0} y1={31} x2={48} y2={31} className="elevation-icon__divider" />
      </g>
    </svg>
  );
}
