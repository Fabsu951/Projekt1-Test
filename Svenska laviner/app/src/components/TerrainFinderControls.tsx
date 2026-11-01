import type { KeyboardEvent } from "react";
import { COMPASS_SECTORS } from "../utils/windAnalysis";
import {
  SLOPE_LIMIT,
  SLOPE_STEP,
  allSectors,
  sectorSummary,
  withRange,
  type TerrainFilter,
} from "../utils/terrainFinder";
import { compass, t } from "../i18n";

const SECTOR_NAMES = [
  t("norr"),
  t("nordost"),
  t("öster"),
  t("sydost"),
  t("söder"),
  t("sydväst"),
  t("väster"),
  t("nordväst"),
];

const SIZE = 132;
const C = SIZE / 2;
const R_OUTER = 52;
const R_INNER = 14;
const R_LABEL = 61;

function point(deg: number, r: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [C + r * Math.cos(rad), C + r * Math.sin(rad)];
}

function wedge(index: number): string {
  const [a, b] = [index * 45 - 22.5, index * 45 + 22.5];
  const p = (deg: number, r: number) => point(deg, r).join(" ");
  return `M ${p(a, R_INNER)} L ${p(a, R_OUTER)} A ${R_OUTER} ${R_OUTER} 0 0 1 ${p(b, R_OUTER)} L ${p(b, R_INNER)} A ${R_INNER} ${R_INNER} 0 0 0 ${p(a, R_INNER)} Z`;
}

const OPTIONS = Array.from({ length: SLOPE_LIMIT / SLOPE_STEP + 1 }, (_, i) => i * SLOPE_STEP);

interface Props {
  filter: TerrainFilter;
  onChange: (filter: TerrainFilter) => void;
  /** Today's problems in the area in the middle of the map, when a forecast is published there. */
  fromForecast?: { area: string; filter: TerrainFilter } | null;
}

const sameFilter = (a: TerrainFilter, b: TerrainFilter) =>
  a.min === b.min && a.max === b.max && a.sectors.every((on, i) => on === b.sectors[i]);

/** Steepness range + an aspect rose to tap; the rose is also the layer's legend. */
export default function TerrainFinderControls({ filter, onChange, fromForecast }: Props) {
  const toggle = (index: number) => {
    // From "every direction", the first tap picks just that one.
    const sectors = allSectors(filter)
      ? COMPASS_SECTORS.map((_, i) => i === index)
      : filter.sectors.map((on, i) => (i === index ? !on : on));
    onChange({ ...filter, sectors });
  };
  const onKey = (e: KeyboardEvent, index: number) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      toggle(index);
    }
  };

  return (
    <div className="terrain-finder">
      {fromForecast && (
        <div className="terrain-finder__forecast">
          <button
            type="button"
            className="button"
            aria-pressed={sameFilter(filter, fromForecast.filter)}
            onClick={() => onChange(fromForecast.filter)}
          >
            {t("Använd dagens prognos för {area}", { area: fromForecast.area })}
          </button>
          <p className="map-layers__sub">
            {t("Väljer väderstrecken i dagens lavinproblem och 30° eller brantare. Prognosens höjder ingår inte – läs dem i prognosen.")}
          </p>
        </div>
      )}
      <div className="terrain-finder__slope">
        <label className="terrain-finder__field">
          {t("Lutning från")}
          <select value={filter.min} onChange={(e) => onChange(withRange(filter, "min", Number(e.target.value)))}>
            {OPTIONS.slice(0, -1).map((deg) => (
              <option key={deg} value={deg}>
                {deg}°
              </option>
            ))}
          </select>
        </label>
        <label className="terrain-finder__field">
          {t("till")}
          <select value={filter.max} onChange={(e) => onChange(withRange(filter, "max", Number(e.target.value)))}>
            {OPTIONS.slice(1).map((deg) => (
              <option key={deg} value={deg}>
                {deg}°
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="terrain-finder__aspect">
        <svg
          className="terrain-finder__rose"
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          width={SIZE}
          height={SIZE}
          role="group"
          aria-label={t("Väderstreck som sluttningen vetter mot")}
        >
          {COMPASS_SECTORS.map((sector, i) => (
            <path
              key={sector}
              d={wedge(i)}
              role="checkbox"
              tabIndex={0}
              aria-checked={filter.sectors[i]}
              aria-label={SECTOR_NAMES[i]}
              className={filter.sectors[i] ? "terrain-finder__wedge terrain-finder__wedge--on" : "terrain-finder__wedge"}
              onClick={() => toggle(i)}
              onKeyDown={(e) => onKey(e, i)}
            />
          ))}
          {COMPASS_SECTORS.map((sector, i) =>
            i % 2 === 0 ? (
              <text
                key={sector}
                x={point(i * 45, R_LABEL)[0]}
                y={point(i * 45, R_LABEL)[1]}
                className="terrain-finder__compass"
                textAnchor="middle"
                dominantBaseline="central"
                aria-hidden="true"
              >
                {compass(sector)}
              </text>
            ) : null
          )}
        </svg>
        <div className="terrain-finder__aspect-text">
          <p className="terrain-finder__summary" aria-live="polite">
            {filter.max >= SLOPE_LIMIT
              ? t("Visar {min}° och brantare, {directions}.", { min: filter.min, directions: sectorSummary(filter.sectors) })
              : t("Visar {min}–{max}°, {directions}.", {
                  min: filter.min,
                  max: filter.max,
                  directions: sectorSummary(filter.sectors),
                })}
          </p>
          <p className="map-layers__sub">{t("Tryck på väderstrecken du vill se.")}</p>
          {!allSectors(filter) && (
            <button
              type="button"
              className="link-button"
              onClick={() => onChange({ ...filter, sectors: COMPASS_SECTORS.map(() => true) })}
            >
              {t("Alla väderstreck")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
