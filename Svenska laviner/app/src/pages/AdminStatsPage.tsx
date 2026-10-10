import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import PageLoading from "../components/PageLoading";
import { fetchAdminStats, type AdminStats } from "../services/adminService";

/** "1 okt" for the Monday a week starts on. */
function weekLabel(monday: string): string {
  const [y, m, d] = monday.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("sv-SE", { day: "numeric", month: "short", timeZone: "UTC" });
}

type Measure = "users" | "observations" | "tours";
const MEASURES: Array<{ key: Measure; title: string }> = [
  { key: "users", title: "Nya konton" },
  { key: "observations", title: "Observationer" },
  { key: "tours", title: "Turer" },
];

/** One measure per week as thin columns; each column says its number on hover/focus and in the table below. */
function WeeklyBars({ weeks, measure, title }: { weeks: AdminStats["weeks"]; measure: Measure; title: string }) {
  const max = Math.max(1, ...weeks.map((w) => w[measure]));
  const total = weeks.reduce((n, w) => n + w[measure], 0);
  return (
    <figure className="admin-chart">
      <figcaption>
        <strong>{title}</strong> <span className="muted">{total} senaste 12 veckorna</span>
      </figcaption>
      <div className="admin-chart__bars" role="img" aria-label={`${title} per vecka: ${weeks.map((w) => `${weekLabel(w.week)} ${w[measure]}`).join(", ")}`}>
        {weeks.map((w) => (
          <span key={w.week} className="admin-chart__col" title={`Veckan från ${weekLabel(w.week)}: ${w[measure]}`}>
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

  const t = stats?.totals;
  const tiles: Array<[string, number | undefined, string?]> = [
    ["Konton", t?.users, t ? `${t.verifiedUsers} med bekräftad e-post` : undefined],
    ["Aktiva senaste veckan", t?.activeLastWeek, "har loggat in"],
    ["Observationer", t?.observations, t?.hiddenObservations ? `${t.hiddenObservations} ${t.hiddenObservations === 1 ? "dold" : "dolda"}` : undefined],
    ["Turer", t?.tours, t ? `${t.sharedTours} ${t.sharedTours === 1 ? "delad" : "delade"}` : undefined],
    ["Planerade rutter", t?.routes],
    ["Kommentarer", t?.comments],
    ["Följningar", t?.follows],
    ["Kommande turdagar", t?.tripPlans, "Prognos inför din tur"],
    ["Notiser i webbläsare", t?.webPush],
    ["Telefoner med appen", t?.appDevices, "registrerade för notiser"],
  ];

  return (
    <div className="page">
      <header className="page__header">
        <h1>Översikt</h1>
        <p className="page__lead">
          Hur många som använder Snöläge och vad de gör. Bara antal, inga namn eller inlägg.
        </p>
      </header>
      {error && <p className="error">{error}</p>}
      {!stats && !error && <PageLoading label="Laddar…" />}
      {stats && (
        <>
          {t!.openReports > 0 && (
            <p className="notice">
              {t!.openReports} öppna anmälningar. <Link to="/admin">Gå till anmälda inlägg</Link>.
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
            <h2>Per vecka</h2>
            <div className="admin-charts">
              {MEASURES.map((m) => (
                <WeeklyBars key={m.key} weeks={stats.weeks} measure={m.key} title={m.title} />
              ))}
            </div>
            <details className="admin-table-toggle">
              <summary>Visa som tabell</summary>
              <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">Vecka från</th>
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
            <h2>Områden</h2>
            <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Område</th>
                  <th scope="col">Stjärnor</th>
                  <th scope="col">Obs.</th>
                  <th scope="col">Turer</th>
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
              Stjärnor räknar bara inloggade, eftersom stjärnor utan konto bara finns på telefonen. Obs. = observationer.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
