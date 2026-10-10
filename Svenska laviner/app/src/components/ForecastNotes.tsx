import type { AvalancheForecast, ForecastNote } from "../types/avalanche";
import { t } from "../i18n";

function Note({ note, fallback }: { note: ForecastNote; fallback: string }) {
  return (
    <details className="forecast-note">
      <summary>{note.title ?? fallback}</summary>
      <p className="forecast-note__text">{note.text}</p>
      {note.link && (
        <a href={note.link} target="_blank" rel="noreferrer">
          {note.linkText ?? t("Mer information")} ↗
        </a>
      )}
    </details>
  );
}

/** The forecasters' field report and mountain weather, folded so the forecast itself stays on top. */
export default function ForecastNotes({ forecast }: { forecast: AvalancheForecast }) {
  if (!forecast.snow && !forecast.weather) return null;
  return (
    <div className="forecast-notes">
      {forecast.snow && <Note note={forecast.snow} fallback={t("Rapport från området")} />}
      {forecast.weather && <Note note={forecast.weather} fallback={t("Fjällväderprognos")} />}
    </div>
  );
}
