import type { AvalancheForecast } from "../types/avalanche";
import { forecastLabel } from "../utils/forecastLabel";
import DangerBadge from "./DangerBadge";

interface Props {
  forecast: AvalancheForecast;
  size?: "small" | "large";
}

/** The danger level when there is one; otherwise a neutral pill saying why not — never a guessed level. */
export default function ForecastBadge({ forecast, size = "small" }: Props) {
  if (forecast.dangerLevel !== null) {
    return <DangerBadge level={forecast.dangerLevel} size={size} />;
  }
  return <span className={`danger-badge danger-badge--${size} danger-badge--none`}>{forecastLabel(forecast)}</span>;
}
