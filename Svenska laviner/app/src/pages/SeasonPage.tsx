import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getRegionById } from "../data/regions";
import { getDangerInfo } from "../data/dangerScale";
import { SITE_PROBLEM_TYPES } from "../data/avalancheProblems";
import { currentSeason, fetchSeason, type Season, type SeasonDay } from "../services/avalancheService";
import type { DangerLevel } from "../types/avalanche";
import ProblemIcon from "../components/ProblemIcon";
import { usePageTitle } from "../components/pageTitle";
import NotFoundPage from "./NotFoundPage";
import { t, isEnglish, locale } from "../i18n";

// "Säsongen": one area's whole forecast season from Naturvårdsverket's open
// API — a calendar with every day's level, how many days each level had,
// and which avalanche problems came up most. Only published levels 1–5 get
// a colour; days without a level say what the forecast said instead.

const SEASONS_BACK = 5;
const MONTHS = isEnglish()
  ? ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  : ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
const LEVELS: DangerLevel[] = [1, 2, 3, 4, 5];

const seasonLabel = (y: number) => `${y}/${String(y + 1).slice(2)}`;

function dayText(d: SeasonDay): string {
  const [y, m, day] = d.date.split("-").map(Number);
  const when = new Date(Date.UTC(y, m - 1, day, 12)).toLocaleDateString(locale(), { weekday: "short", day: "numeric", month: "short" });
  const level = d.dangerLevel ? `${d.dangerLevel} ${getDangerInfo(d.dangerLevel).label}` : (d.label ?? t("Ingen farograd"));
  return `${when}: ${level}`;
}

/** "20 feb 2026" */
function shortDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/**
 * Month blocks (Mon–Sun weeks) for the months the season has daily forecasts
 * in. Months without any are left out: some areas (Kebnekaisefjällen) only
 * get daily forecasts from late winter, and empty months read as missing data.
 */
function months(days: SeasonDay[]) {
  if (days.length === 0) return [];
  const byDate = new Map(days.map((d) => [d.date, d]));
  const [fy, fm] = days[0].date.split("-").map(Number);
  const [ly, lm] = days[days.length - 1].date.split("-").map(Number);
  const out: Array<{ key: string; title: string; cells: Array<{ date: string; day: number; data: SeasonDay | null } | null> }> = [];
  for (let y = fy, m = fm; y < ly || (y === ly && m <= lm); m === 12 ? ((m = 1), y++) : m++) {
    const first = new Date(Date.UTC(y, m - 1, 1));
    const length = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const lead = (first.getUTCDay() + 6) % 7; // Monday first
    const cells: Array<{ date: string; day: number; data: SeasonDay | null } | null> = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= length; d++) {
      const date = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push({ date, day: d, data: byDate.get(date) ?? null });
    }
    if (cells.some((c) => c?.data)) out.push({ key: `${y}-${m}`, title: `${MONTHS[m - 1]} ${y}`, cells });
  }
  return out;
}

export default function SeasonPage() {
  const { id = "" } = useParams();
  const region = getRegionById(id);
  const latest = currentSeason();
  const [season, setSeason] = useState(latest);
  // What's loaded, tagged with what it's for, so a new choice shows "Hämtar…" without resetting state in the effect.
  const [loaded, setLoaded] = useState<{ key: string; data: Season | null; error: string | null } | null>(null);
  const [selected, setSelected] = useState<SeasonDay | null>(null);
  usePageTitle(region ? t("Säsongen {season} – {name}", { season: seasonLabel(season), name: region.name }) : null);

  useEffect(() => {
    if (!region) return;
    let live = true;
    const key = `${region.id}:${season}`;
    fetchSeason(region.id, season)
      .then((s) => live && setLoaded({ key, data: s, error: null }))
      .catch((err: Error) => live && setLoaded({ key, data: null, error: err.message }));
    return () => {
      live = false;
    };
  }, [region, season]);

  const current = region && loaded?.key === `${region.id}:${season}` ? loaded : null;
  const data = current?.data ?? null;
  const error = current?.error ?? null;
  const calendar = useMemo(() => (data ? months(data.days) : []), [data]);
  if (!region) return <NotFoundPage />;

  const withLevel = data ? data.days.filter((d) => d.dangerLevel !== null) : [];
  const maxLevelCount = data ? Math.max(1, ...LEVELS.map((l) => data.levels[l])) : 1;
  const mostCommon = data && withLevel.length ? LEVELS.reduce((a, b) => (data.levels[b] > data.levels[a] ? b : a)) : null;
  const atLeast3 = withLevel.filter((d) => (d.dangerLevel ?? 0) >= 3).length;
  const maxProblem = data?.problems[0]?.days ?? 1;

  return (
    <div className="page season">
      <Link to={`/omrade/${region.id}`} className="back-link">
        ← {region.name}
      </Link>
      <header className="page__header">
        <h1>{t("Säsongen i")}{" "}{region.name}</h1>
        <p className="page__lead">{t("Varje dags farograd enligt Naturvårdsverkets lavinprognoser.")}</p>
      </header>

      <div className="chip-row season__picker" role="group" aria-label={t("Välj säsong")}>
        {Array.from({ length: SEASONS_BACK }, (_, i) => latest - i).map((y) => (
          <button
            key={y}
            type="button"
            className={y === season ? "chip chip--on" : "chip"}
            aria-pressed={y === season}
            onClick={() => {
              setSeason(y);
              setSelected(null);
            }}
          >
            {seasonLabel(y)}
          </button>
        ))}
      </div>

      {error ? (
        <p className="notice">{error}</p>
      ) : !data ? (
        <p className="muted">{t("Hämtar säsongen…")}</p>
      ) : withLevel.length === 0 ? (
        <p className="notice notice--stale">{t("Inga publicerade farograder för")}{" "}{seasonLabel(season)}{" "}{t("i det här området.")}</p>
      ) : (
        <>
          <div className="season__tiles">
            <div className="season__tile">
              <strong>{withLevel.length}</strong>
              <span>{t("dagar med farograd")}</span>
            </div>
            {mostCommon && (
              <div className="season__tile">
                <strong>
                  {mostCommon} {getDangerInfo(mostCommon).label.replace(" fara", "")}
                </strong>
                <span>{t("vanligast ({n} dagar)", { n: data.levels[mostCommon] })}</span>
              </div>
            )}
            <div className="season__tile">
              <strong>{atLeast3}</strong>
              <span>{t("dagar med betydande eller högre")}</span>
            </div>
          </div>

          <section className="section" aria-labelledby="season-calendar">
            <h2 id="season-calendar">{t("Dag för dag")}</h2>
            <p className="muted season__span">
              {t("Dagliga prognoser")}{" "}{shortDate(withLevel[0].date)} – {shortDate(withLevel[withLevel.length - 1].date)}{t(". Övriga dagar publicerade Naturvårdsverket ingen daglig prognos för området (till exempel bara försäsongstips).")}
            </p>
            <div className="season__months">
              {calendar.map((m) => (
                <div key={m.key} className="season__month">
                  <h3>{m.title}</h3>
                  <div className="season__grid" role="group" aria-label={m.title}>
                    {["m", "t", "o", "t", "f", "l", "s"].map((w, i) => (
                      <span key={i} className="season__weekday" aria-hidden="true">
                        {w}
                      </span>
                    ))}
                    {m.cells.map((c, i) =>
                      c === null ? (
                        <span key={`e${i}`} />
                      ) : c.data ? (
                        <button
                          key={c.date}
                          type="button"
                          className={[
                            "season__day",
                            c.data.dangerLevel ? "" : "season__day--none",
                            selected?.date === c.date ? "season__day--selected" : "",
                          ].join(" ")}
                          style={
                            c.data.dangerLevel
                              ? {
                                  background: getDangerInfo(c.data.dangerLevel).color,
                                  color: c.data.dangerLevel >= 5 ? "#fff" : "#1a1a1a",
                                }
                              : undefined
                          }
                          title={dayText(c.data)}
                          aria-label={dayText(c.data)}
                          onClick={() => setSelected(c.data)}
                        >
                          {c.data.dangerLevel ?? "·"}
                        </button>
                      ) : (
                        <span key={c.date} className="season__day season__day--empty" aria-hidden="true" />
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
            {selected ? (
              <div className="season__selected" role="status">
                <strong>{dayText(selected)}</strong>
                {selected.problems.length > 0 && (
                  <span>
                    {" · "}
                    {selected.problems
                      .map((p) => data.problems.find((x) => x.type === p)?.name ?? p)
                      .join(", ")}
                  </span>
                )}
              </div>
            ) : (
              <p className="muted season__hint">{t("Tryck på en dag för att se lavinproblemen.")}</p>
            )}
            <ul className="season__legend" aria-label={t("Lavinskalan")}>
              {LEVELS.map((l) => (
                <li key={l}>
                  <b style={{ background: getDangerInfo(l).color }} />
                  {l} {getDangerInfo(l).label.replace(" fara", "")}
                </li>
              ))}
              <li>
                <b className="season__legend-none" />
                {t("Ingen farograd")}
              </li>
            </ul>
          </section>

          <section className="section" aria-labelledby="season-levels">
            <h2 id="season-levels">{t("Dagar per farograd")}</h2>
            <ul className="season__bars">
              {LEVELS.map((l) => (
                <li key={l}>
                  <span className="season__bar-label">
                    {l} {getDangerInfo(l).label.replace(" fara", "")}
                  </span>
                  <span className="season__bar-track">
                    <span
                      className="season__bar"
                      style={{ width: `${(data.levels[l] / maxLevelCount) * 100}%`, minWidth: data.levels[l] ? 2 : 0, background: getDangerInfo(l).color }}
                    />
                  </span>
                  <span className="season__bar-value">{data.levels[l]}</span>
                </li>
              ))}
            </ul>
          </section>

          {data.problems.length > 0 && (
            <section className="section" aria-labelledby="season-problems">
              <h2 id="season-problems">{t("Vanligaste lavinproblemen")}</h2>
              <ul className="season__problems">
                {data.problems.map((p) => {
                  const type = SITE_PROBLEM_TYPES[p.type];
                  return (
                    <li key={p.type}>
                      {type && <ProblemIcon problem={type} size={28} />}
                      <span className="season__problem-name">{p.name}</span>
                      <span className="season__bar-track">
                        <span className="season__bar season__bar--problem" style={{ width: `${(p.days / maxProblem) * 100}%` }} />
                      </span>
                      <span className="season__bar-value">{p.days} d</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <details className="season__table">
            <summary>{t("Visa som lista")}</summary>
            <ul>
              {data.days.map((d) => (
                <li key={d.date}>
                  {dayText(d)}
                  {d.problems.length > 0 && ` · ${d.problems.map((p) => data.problems.find((x) => x.type === p)?.name ?? p).join(", ")}`}
                </li>
              ))}
            </ul>
          </details>

          <p className="source-list">
            {t("Källa: Naturvårdsverkets lavinprognoser (öppna API:er), via")}{" "}
            <a href="https://www.lavinprognoser.se/" target="_blank" rel="noreferrer">
              {t("lavinprognoser.se")}
            </a>
            {t(". Ett dagsdatum är dagen prognosen gällde till kl 18. Visar senaste versionen när en prognos rättats.")}
          </p>
        </>
      )}
    </div>
  );
}
