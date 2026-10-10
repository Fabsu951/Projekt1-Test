import type { AvalancheForecast, ForecastStatus } from "../types/avalanche";
import { getDangerInfo } from "../data/dangerScale";
import { t } from "../i18n";

const NO_FORECAST_LABELS: Record<ForecastStatus, string> = {
  published: t("Ingen prognos"),
  "season-over": t("Utanför säsong"),
  spring: t("Vårförhållanden"),
  "no-danger": t("Ingen lavinfara"),
  "not-assessed": t("Ej bedömd"),
  unavailable: t("Ingen prognos"),
};

/** Short text for a forecast: the danger label, or why there is none. */
export function forecastLabel(forecast: AvalancheForecast): string {
  return forecast.dangerLevel !== null
    ? getDangerInfo(forecast.dangerLevel).label
    : NO_FORECAST_LABELS[forecast.status];
}
