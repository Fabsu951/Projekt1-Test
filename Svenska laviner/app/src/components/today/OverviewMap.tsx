import { useNavigate } from "react-router-dom";
import { getDangerInfo } from "../../data/dangerScale";
import { DANGER_SCALE } from "../../data/dangerScale";
import { REGIONS } from "../../data/regions";
import type { AvalancheForecast } from "../../types/avalanche";
import { t } from "../../i18n";

// A small schematic map of the six forecast areas, coloured by today's level.
// Positions are the areas' real centres; the dashed line roughly follows the
// border with Norway, just to give a sense of place.

const W = 300;
const H = 380;
const BOUNDS = { north: 69.25, south: 62.25, west: 11.4, east: 21.0 };
const R = 13;
const LON_SCALE = Math.cos((65.5 * Math.PI) / 180);

function project(lat: number, lon: number): [number, number] {
  const spanX = (BOUNDS.east - BOUNDS.west) * LON_SCALE;
  const spanY = BOUNDS.north - BOUNDS.south;
  const k = Math.min(W / spanX, H / spanY);
  const x = ((lon - BOUNDS.west) * LON_SCALE * k + (W - spanX * k) / 2);
  const y = (BOUNDS.north - lat) * k + (H - spanY * k) / 2;
  return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
}

/** Rough line of the Swedish–Norwegian border, north to south. */
const BORDER: Array<[number, number]> = [
  [69.06, 20.55], [68.7, 19.6], [68.43, 18.13], [68.1, 17.9], [67.75, 16.9], [67.3, 16.3], [66.9, 15.6],
  [66.4, 15.2], [65.95, 14.6], [65.5, 14.5], [65.0, 14.2], [64.5, 13.95], [64.1, 13.4], [63.8, 12.7],
  [63.3, 12.1], [62.6, 12.15], [62.1, 12.3],
];

/** Where each name goes, so the two northern areas don't collide. */
const LABEL_SIDE: Record<string, { dx: number; dy: number; anchor: "start" | "end" }> = {
  riksgransfjallen: { dx: -18, dy: -6, anchor: "end" },
  kebnekaisefjallen: { dx: 18, dy: 5, anchor: "start" },
};

const SHORT_NAMES: Record<string, string> = {
  kebnekaisefjallen: "Kebnekaise",
  riksgransfjallen: "Riksgränsen",
  "vastra-vindelfjallen": "V. Vindelfjällen",
  "sodra-lapplandsfjallen": "S. Lapplandsfjällen",
  "sodra-jamtlandsfjallen": "S. Jämtlandsfjällen",
  "vastra-harjedalsfjallen": "V. Härjedalen",
};

interface Props {
  forecasts: Record<string, AvalancheForecast>;
  favorites: string[];
}

export default function OverviewMap({ forecasts, favorites }: Props) {
  const navigate = useNavigate();
  const border = BORDER.map(([lat, lon]) => project(lat, lon).join(",")).join(" ");
  const [nx, ny] = project(66.2, 13.3);
  const [sx, sy] = project(66.6, 17.4);

  return (
    <div className="overview-map">
      <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={t("Översiktskarta över prognosområdena")}>
        <polyline points={border} fill="none" stroke="var(--accent)" strokeWidth="1.2" strokeDasharray="4 4" opacity="0.45" />
        <text x={nx} y={ny} className="overview-map__country" textAnchor="middle">{t("NORGE")}</text>
        <text x={sx} y={sy} className="overview-map__country" textAnchor="middle">{t("SVERIGE")}</text>
        {REGIONS.map((r) => {
          const [x, y] = project(r.lat, r.lon);
          const f = forecasts[r.id];
          const level = f?.dangerLevel ?? null;
          const info = level !== null ? getDangerInfo(level) : null;
          const side = LABEL_SIDE[r.id] ?? { dx: 18, dy: 5, anchor: "start" as const };
          const fav = favorites.includes(r.id);
          const name = SHORT_NAMES[r.id] ?? r.name;
          return (
            <a
              key={r.id}
              href={`/omrade/${r.id}`}
              onClick={(e) => {
                e.preventDefault();
                navigate(`/omrade/${r.id}`);
              }}
              aria-label={`${r.name}: ${info ? info.label : t("ingen farograd")}`}
              className="overview-map__area"
            >
              <circle cx={x} cy={y} r={R} fill={info?.color ?? "var(--bg-raised)"} stroke="var(--snow)" strokeWidth={2} />
              <text x={x} y={y + 5} textAnchor="middle" className="overview-map__level" fill={level === 5 ? "#fff" : info ? "#1a1a1a" : "var(--text-muted)"}>
                {level ?? "–"}
              </text>
              <text x={x + side.dx} y={y + side.dy} textAnchor={side.anchor} className="overview-map__name">
                {name}
                {fav ? " ★" : ""}
              </text>
            </a>
          );
        })}
      </svg>
      <ul className="overview-map__legend" aria-label={t("Lavinskalan")}>
        {DANGER_SCALE.map((d) => (
          <li key={d.level}>
            <b style={{ background: d.color }} />
            {d.level} {d.label.replace(" fara", "")}
          </li>
        ))}
      </ul>
    </div>
  );
}
