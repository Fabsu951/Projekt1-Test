import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import PageLoading from "../components/PageLoading";
import { fetchAdminStats, type AdminStats } from "../services/adminService";
import { t, locale, plural } from "../i18n";
import { formatMegabytes } from "../services/offlineMap";

/** "1 okt" for the Monday a week starts on. */
function weekLabel(monday: string): string {
  const [y, m, d] = monday.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(locale(), { day: "numeric", month: "short", timeZone: "UTC" });
}

type Measure = "users" | "observations" | "tours";
const MEASURES: Array<{ key: Measure; title: string }> = [
  { key: "users", title: t("Nya konton") },
  { key: "observations", title: t("Observationer") },
  { key: "tours", title: t("Turer") },
];

/** One measure per week as thin columns; each column says its number on hover/focus and in the table below. */
function WeeklyBars({ weeks, measure, title }: { weeks: AdminStats["weeks"]; measure: Measure; title: string }) {
  const max = Math.max(1, ...weeks.map((w) => w[measure]));
  const total = weeks.reduce((n, w) => n + w[measure], 0);
  return (
    <figure className="admin-chart">
      <figcaption>
        <strong>{title}</strong> <span className="muted">{total}{" "}{t("senaste 12 veckorna")}</span>
      </figcaption>
      <div className="admin-chart__bars" role="img" aria-label={t("{title} per vecka: {weeks}", { title, weeks: weeks.map((w) => `${weekLabel(w.week)} ${w[measure]}`).join(", ") })}>
        {weeks.map((w) => (
          <span key={w.week} className="admin-chart__col" title={t("Veckan från {week}: {n}", { week: weekLabel(w.week), n: w[measure] })}>
            <span className="admin-chart__bar" style={{ height: `${(w[measure] / max) * 100}%` }} />
          </span>
        ))}
      </div>
      <div className="admin-chart__axis" aria-hidden="true">
        <span>{weekLabel(weeks[0].week)}</span>
        <span>{weekLabel(weeks[weeks.length - 1].week)}</span>
      </div>
    </figure>
  );
}

/** Admin only: how many use Snöläge and what they do (counts, no content). */
export default function AdminStatsPage() {
  const { user, token, loading } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !user?.isAdmin) return;
    fetchAdminStats(token)
      .then(setStats)
      .catch((err: Error) => setError(err.message));
  }, [token, user]);

  if (loading) return <PageLoading />;
  if (!user?.isAdmin) return <Navigate to="/" replace />;

  const totals = stats?.totals;
  const tiles: Array<[string, number | undefined, string?]> = [
    [t("Konton"), totals?.users, totals ? t("{n} med bekräftad e-post", { n: totals.verifiedUsers }) : undefined],
    [t("Aktiva senaste veckan"), totals?.activeLastWeek, t("har loggat in")],
    [t("Observationer"), totals?.observations, totals?.hiddenObservations ? plural(totals.hiddenObservations, "{n} dold", "{n} dolda") : undefined],
    [t("Turer"), totals?.tours, totals ? plural(totals.sharedTours, "{n} delad", "{n} delade") : undefined],
    [t("Planerade rutter"), totals?.routes],
    [t("Kommentarer"), totals?.comments],
    [t("Följningar"), totals?.follows],
    [t("Kommande turdagar"), totals?.tripPlans, t("Prognos inför din tur")],
    [t("Notiser i webbläsare"), totals?.webPush],
    [t("Telefoner med appen"), totals?.appDevices, t("registrerade för notiser")],
  ];

  return (
    <div className="page">
      <header className="page__header">
        <h1>{t("Översikt")}</h1>
        <p className="page__lead">
          {t("Hur många som använder Snöläge och vad de gör. Bara antal, inga namn eller inlägg.")}
        </p>
      </header>
      {error && <p className="error">{error}</p>}
      {!stats && !error && <PageLoading label={t("Laddar…")} />}
      {stats && (
        <>
          {stats.forecastHealth && (
            <div className={stats.forecastHealth.problems.length ? "notice notice--stale admin-health" : "admin-health"} role="status">
              {stats.forecastHealth.problems.length === 0 ? (
                <p>
                  <span aria-hidden="true">✓</span>{" "}{t("Prognoshämtningen fungerar.")}
                </p>
              ) : (
                <>
                  <p>
                    <strong>
                      <span aria-hidden="true">⚠</span>{" "}
                      {t("Problem med prognoshämtningen sedan {time}:", {
                        time: stats.forecastHealth.since
                          ? new Date(stats.forecastHealth.since).toLocaleString(locale(), {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "–",
                      })}
                    </strong>
                  </p>
                  <ul>
                    {stats.forecastHealth.problems.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                  <p className="muted">{t("Administratörer får mejl om det håller i sig.")}</p>
                </>
              )}
            </div>
          )}
          {stats.backup && (
            <p className="muted admin-backup">
              {stats.backup.latestAt
                ? t("Senaste säkerhetskopian: {time} ({size}, {n} sparade).", {
                    time: new Date(stats.backup.latestAt).toLocaleString(locale(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
                    size: formatMegabytes(stats.backup.bytes ?? 0),
                    n: stats.backup.count,
                  })
                : t("Ingen säkerhetskopia än – den första görs natten mot måndag.")}
            </p>
          )}
          {totals!.openReports > 0 && (
            <p className="notice">
              {totals!.openReports}{" "}{t("öppna anmälningar.")}{" "}<Link to="/admin">{t("Gå till anmälda inlägg")}</Link>.
            </p>
          )}
          <div className="admin-tiles">
            {tiles.map(([label, value, sub]) => (
              <div key={label} className="admin-tile">
                <span className="admin-tile__value">{value ?? "–"}</span>
                <span className="admin-tile__label">{label}</span>
                {sub && <span className="admin-tile__sub">{sub}</span>}
              </div>
            ))}
          </div>

          <section className="section">
            <h2>{t("Per vecka")}</h2>
            <div className="admin-charts">
              {MEASURES.map((m) => (
                <WeeklyBars key={m.key} weeks={stats.weeks} measure={m.key} title={m.title} />
              ))}
            </div>
            <details className="admin-table-toggle">
              <summary>{t("Visa som tabell")}</summary>
              <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">{t("Vecka från")}</th>
                    {MEASURES.map((m) => (
                      <th key={m.key} scope="col">{m.title}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.weeks.map((w) => (
                    <tr key={w.week}>
                      <th scope="row">{weekLabel(w.week)}</th>
                      <td>{w.users}</td>
                      <td>{w.observations}</td>
                      <td>{w.tours}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </details>
          </section>

          <section className="section">
            <h2>{t("Områden")}</h2>
            <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">{t("Område")}</th>
                  <th scope="col">{t("Stjärnor")}</th>
                  <th scope="col">{t("Obs.")}</th>
                  <th scope="col">{t("Turer")}</th>
                </tr>
              </thead>
              <tbody>
                {[...stats.regions]
                  .sort((a, b) => b.favorites - a.favorites)
                  .map((r) => (
                    <tr key={r.regionId}>
                      <th scope="row">{r.name}</th>
                      <td>{r.favorites}</td>
                      <td>{r.observations}</td>
                      <td>{r.tours}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            </div>
            <p className="muted">
              {t("Stjärnor räknar bara inloggade, eftersom stjärnor utan konto bara finns på telefonen. Obs. = observationer.")}
            </p>
          </section>
        </>
      )}
    </div>
  );
}
