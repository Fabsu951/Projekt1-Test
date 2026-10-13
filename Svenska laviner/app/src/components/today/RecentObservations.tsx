import { Link } from "react-router-dom";
import { dangerSignLabel } from "../../data/dangerSigns";
import { observationTypeLabel } from "../../data/observationTypes";
import { getRegionById } from "../../data/regions";
import type { Observation } from "../../types/observation";
import AdminBadge from "../AdminBadge";
import { t, locale, plural } from "../../i18n";

function ago(iso: string, now: Date): string {
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60_000));
  if (minutes < 60) return t("för {n} min sedan", { n: Math.max(1, minutes) });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return plural(hours, "för {n} timme sedan", "för {n} timmar sedan");
  return new Date(iso).toLocaleString(locale(), { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

interface Props {
  observations: Observation[] | null;
  now: Date;
  emptyText: string;
}

/** The newest few observations as compact rows. */
export default function RecentObservations({ observations, now, emptyText }: Props) {
  if (observations === null) return <p className="today-panel today-panel--muted">{t("Hämtar observationer…")}</p>;
  if (observations.length === 0) return <p className="today-panel today-panel--muted">{emptyText}</p>;
  return (
    <ul className="today-panel today-obs">
      {observations.map((o) => (
        <li key={o.id} className="today-obs__item">
          <p className="today-obs__text">
            <strong>{observationTypeLabel(o.type)}</strong>
            {o.snowDepthCm != null && t(", snödjup {cm} cm", { cm: o.snowDepthCm })}
            {o.description && ` – ${o.description.length > 120 ? `${o.description.slice(0, 120)}…` : o.description}`}
          </p>
          {(o.dangerSigns?.length ?? 0) > 0 && (
            <p className="today-obs__signs">
              {o.dangerSigns!.map((s) => (
                <span key={s} className="today-obs__sign">
                  {dangerSignLabel(s) ?? s}
                </span>
              ))}
            </p>
          )}
          <p className="today-obs__meta">
            <Link to={`/person/${o.userId}`}>{o.author}</Link>
            <AdminBadge show={o.authorIsAdmin} />
            {o.regionId && `, ${getRegionById(o.regionId)?.name ?? ""}`}, {ago(o.observedAt, now)}
          </p>
        </li>
      ))}
    </ul>
  );
}
