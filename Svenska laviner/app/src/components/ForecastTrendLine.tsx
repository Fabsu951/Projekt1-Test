import type { DangerLevel, ForecastTrend } from "../types/avalanche";
import DangerBadge from "./DangerBadge";

/** "lör 21 feb", the day the expected development is for. */
function trendDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("sv-SE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Europe/Stockholm",
  });
}

interface Props {
  trend: ForecastTrend;
  /** Today's level, for the arrow; none without one. */
  today: DangerLevel | null;
  /** Just the line, without the forecaster's comment. */
  compact?: boolean;
}

/**
 * The forecasters' "Förväntad utveckling": the level they expect for the
 * next day, as they wrote it. It's their expectation, not tomorrow's
 * forecast, and is labelled so.
 */
export default function ForecastTrendLine({ trend, today, compact = false }: Props) {
  const change =
    trend.dangerLevel !== null && today !== null
      ? trend.dangerLevel > today
        ? { mark: "↑", word: "ökar", kind: "up" }
        : trend.dangerLevel < today
          ? { mark: "↓", word: "minskar", kind: "down" }
          : { mark: "→", word: "oförändrad", kind: "same" }
      : null;
  return (
    <div className={compact ? "forecast-trend forecast-trend--compact" : "forecast-trend"}>
      <p className="forecast-trend__line">
        <span className="forecast-trend__label">Förväntad utveckling {trendDay(trend.date)}:</span>{" "}
        {trend.dangerLevel !== null ? <DangerBadge level={trend.dangerLevel} /> : <span>{trend.label ?? "Ingen bedömning"}</span>}
        {change && (
          <span className={`forecast-trend__change forecast-trend__change--${change.kind}`} aria-label={`Lavinfaran ${change.word}`}>
            {change.mark}
          </span>
        )}
      </p>
      {!compact && trend.text && <p className="forecast-trend__text">{trend.text}</p>}
    </div>
  );
}
