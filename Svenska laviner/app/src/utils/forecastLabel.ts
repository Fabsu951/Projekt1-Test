import type { AvalancheForecast, ForecastStatus } from "../types/avalanche";
import { getDangerInfo } from "../data/dangerScale";

const NO_FORECAST_LABELS: Record<ForecastStatus, string> = {
  published: "Ingen prognos",
  "season-over": "Säsongen slut",
  "not-assessed": "Ej bedömd",
  unavailable: "Ingen prognos",
};

/** Short text for a forecast: the danger label, or why there is none. */
export function forecastLabel(forecast: AvalancheForecast): string {
  return forecast.dangerLevel !== null
    ? getDangerInfo(forecast.dangerLevel).label
    : NO_FORECAST_LABELS[forecast.status];
}
