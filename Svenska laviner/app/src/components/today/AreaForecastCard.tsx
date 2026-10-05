import { Link } from "react-router-dom";
import { getDangerInfo } from "../../data/dangerScale";
import type { HistoryDay } from "../../services/avalancheService";
import type { AvalancheForecast, AvalancheRegion } from "../../types/avalanche";
import { forecastLabel } from "../../utils/forecastLabel";
import { problemWhere, recentDays, trendSinceYesterday } from "../../utils/today";
import FavoriteButton from "../FavoriteButton";
import ProblemIcon from "../ProblemIcon";

interface Props {
  region: AvalancheRegion;
  forecast?: AvalancheForecast;
  history: HistoryDay[] | null;
  now: Date;
}

const NO_LEVEL = "#5b6876";

/** A starred area on the start page: today's level, what changed, the problems and the last week. */
export default function AreaForecastCard({ region, forecast, history, now }: Props) {
  const level = forecast?.dangerLevel ?? null;
  const info = level !== null ? getDangerInfo(level) : null;
  const trend = history ? trendSinceYesterday(history, level, now) : null;
  const days = history ? recentDays(history, now) : [];
  const message = forecast?.headline ?? forecast?.mainMessage ?? null;

  return (
    <article className="area-card" style={{ ["--lvl" as string]: info?.color ?? NO_LEVEL, ["--lvl-text" as string]: level === 5 ? "#fff" : "#1a1a1a" }}>
      <div className={info ? "area-card__level" : "area-card__level area-card__level--none"} aria-hidden={!!info}>
        {info ? info.level : "–"}
      </div>
      <div className="area-card__title">
        <h3>
          <Link to={`/omrade/${region.id}`}>{region.name}</Link>
        </h3>
        <FavoriteButton regionId={region.id} regionName={region.name} />
      </div>
      <p className="area-card__levelname">
        {forecast ? forecastLabel(forecast) : <span className="skeleton skeleton--text" aria-label="Laddar prognos" />}
        {trend && (
          <span className={`area-card__trend area-card__trend--${trend.kind}`}>
            {trend.kind === "same" ? "→ samma som igår" : `${trend.kind === "up" ? "↑" : "↓"} från ${trend.from} igår`}
          </span>
        )}
      </p>

      {message && <p className="area-card__message">{message}</p>}

      {forecast && forecast.problems.length > 0 && (
        <ul className="area-card__problems" aria-label="Lavinproblem">
          {forecast.problems.map((p, i) => (
            <li key={`${p.name}-${i}`} className="area-card__problem">
              {p.type && <ProblemIcon problem={p.type} size={20} />}
              <span>
                <strong>{p.name}</strong>
                {problemWhere(p) && ` · ${problemWhere(p)}`}
              </span>
            </li>
          ))}
        </ul>
      )}

      {forecast && forecast.status !== "published" && (
        <p className="area-card__message area-card__message--muted">
          {forecast.status === "season-over"
            ? "Ingen prognos just nu. Lavinprognoserna publiceras från mitten av december."
            : forecast.status === "not-assessed"
              ? "Området bedöms inte idag."
              : "Prognosen kunde inte hämtas. Läs den på lavinprognoser.se."}
        </p>
      )}

      <div className="area-card__foot">
        {days.some((d) => d.dangerLevel !== null) ? (
          <span className="area-card__spark" role="img" aria-label={`Farograd senaste dagarna: ${days.map((d) => d.dangerLevel ?? "ingen").join(", ")}`}>
            {days.map((d, i) => (
              <i
                key={d.date}
                className={i === days.length - 1 ? "is-last" : undefined}
                style={{
                  background: d.dangerLevel ? getDangerInfo(d.dangerLevel).color : "transparent",
                  height: d.dangerLevel ? 4 + d.dangerLevel * 4 : 3,
                }}
              />
            ))}
          </span>
        ) : (
          <span />
        )}
        <span className="area-card__links">
          <Link to={`/omrade/${region.id}`}>Väder och detaljer</Link>
          {forecast && (
            <a href={forecast.sourceUrl} target="_blank" rel="noreferrer">
              Hela prognosen ↗
            </a>
          )}
        </span>
      </div>
    </article>
  );
}
