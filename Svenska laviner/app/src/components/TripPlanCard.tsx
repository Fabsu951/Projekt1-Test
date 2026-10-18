import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { fetchTripsAndInvitations, planTrip, removeTrip, type TripInvitation, type TripPlan, type TripRoute } from "../services/tripService";
import { TripInviteBox, TripInvitations } from "./TripCompany";
import { fetchMyRoutes } from "../services/routeService";
import type { PlannedRoute } from "../types/route";
import { ElevationSampler } from "../utils/elevation";
import { analyseRoute, type RouteAnalysis } from "../utils/routePlan";
import { prepareTripOffline, setTripOfflineAuto, tripOfflineAuto, tripOfflineAvailable } from "../services/tripOffline";
import { formatMegabytes, type DownloadProgress } from "../services/offlineMap";
import { steepProfile } from "../utils/routeForecast";
import { t, locale } from "../i18n";

const DAYS_SHOWN = 8;

function stockholmToday(now: Date): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm" }).format(now);
}

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** "Idag", t("I morgon"), then "lör 14/2". */
function dayLabel(date: string, today: string): string {
  if (date === today) return t("Idag");
  if (date === addDays(today, 1)) return t("I morgon");
  const [y, m, d] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(locale(), { weekday: "short", timeZone: "UTC" });
  return `${weekday} ${d}/${m}`;
}

interface Props {
  regionId: string;
  regionName: string;
  now?: Date;
}

/**
 * "Prognos inför din tur" on area pages: pick the day(s) you plan to go and
 * get that day's forecast as a notification when Naturvårdsverket publishes
 * it (normally at 18 the evening before).
 */
export default function TripPlanCard({ regionId, regionName, now = new Date() }: Props) {
  const { user, token } = useAuth();
  const [trips, setTrips] = useState<TripPlan[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [routes, setRoutes] = useState<PlannedRoute[]>([]);
  const [invitations, setInvitations] = useState<TripInvitation[]>([]);
  const [reload, setReload] = useState(0);
  const [routeBusy, setRouteBusy] = useState(false);
  const [autoOffline, setAutoOffline] = useState(tripOfflineAuto);
  const [offline, setOffline] = useState<
    | { phase: "saving"; progress: DownloadProgress | null }
    | { phase: "done"; route: boolean }
    | { phase: "error"; message: string }
    | null
  >(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  const today = stockholmToday(now);

  useEffect(() => {
    if (!token) return;
    let live = true;
    fetchTripsAndInvitations(token)
      .then((r) => {
        if (!live) return;
        setTrips(r.trips);
        setInvitations(r.invitations);
      })
      .catch(() => live && setTrips([]));
    fetchMyRoutes(token)
      .then((list) => live && setRoutes(list))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [token, reload]);

  if (!user || !token) {
    return (
      <p className="trip-plan__intro">
        {t("Planerar du en tur hit?")}{" "}<Link to={`/logga-in?next=/omrade/${regionId}`}>{t("Logga in")}</Link>{" "}{t("så skickar Snöläge prognosen för din turdag så fort den publiceras.")}
      </p>
    );
  }

  const here = (trips ?? []).filter((trip) => trip.regionId === regionId);
  const planned = new Map(here.map((trip) => [trip.date, trip]));
  const routeId = here.find((trip) => trip.routeId)?.routeId ?? null;
  // This area's routes first.
  const routeChoices = [...routes].sort((a, b) => Number(b.regionId === regionId) - Number(a.regionId === regionId));

  /** The route, its analysis and steep ground, worked out from elevation data (needs a connection). */
  async function analysed(id: number | null): Promise<{ route: PlannedRoute; analysis: RouteAnalysis; trip: TripRoute } | null> {
    const route = id === null ? undefined : routes.find((r) => r.id === id);
    if (!route) return null;
    const analysis = await analyseRoute(route.waypoints, new ElevationSampler());
    return { route, analysis, trip: { routeId: route.id, steep: steepProfile(analysis.samples) } };
  }

  /** Saves the area's map (and the route's) on the device, if that is turned on. */
  async function saveOffline(route: { route: PlannedRoute; analysis: RouteAnalysis } | null) {
    if (!autoOffline || !tripOfflineAvailable()) return;
    abort.current?.abort();
    abort.current = new AbortController();
    setOffline({ phase: "saving", progress: null });
    try {
      const result = await prepareTripOffline(
        regionId,
        route,
        (progress) => setOffline({ phase: "saving", progress }),
        abort.current.signal
      );
      setOffline({ phase: "done", route: result.route });
    } catch (err) {
      if (abort.current?.signal.aborted) setOffline(null);
      else setOffline({ phase: "error", message: err instanceof Error ? err.message : t("Kunde inte spara kartan.") });
    }
  }

  async function chooseRoute(id: number | null) {
    setRouteBusy(true);
    setError(null);
    try {
      const route = await analysed(id);
      const updated = await Promise.all(here.map((trip) => planTrip(token!, regionId, trip.date, route?.trip ?? null)));
      setTrips((list) => (list ?? []).map((trip) => updated.find((u) => u.id === trip.id) ?? trip));
      if (route) void saveOffline(route);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Det gick inte att spara."));
    } finally {
      setRouteBusy(false);
    }
  }

  async function toggle(date: string) {
    setBusy(date);
    setError(null);
    try {
      const existing = planned.get(date);
      if (existing) {
        await removeTrip(token!, existing.id);
        setTrips((list) => (list ?? []).filter((trip) => trip.id !== existing.id));
      } else {
        const route = routeId === null ? null : await analysed(routeId);
        const trip = await planTrip(token!, regionId, date, route ? route.trip : undefined);
        setTrips((list) => [...(list ?? []), trip]);
        void saveOffline(route);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Det gick inte att spara."));
    } finally {
      setBusy(null);
    }
  }

  const days = Array.from({ length: DAYS_SHOWN }, (_, i) => addDays(today, i));

  return (
    <div className="trip-plan">
      <TripInvitations
        token={token}
        invitations={invitations.filter((inv) => inv.regionId === regionId)}
        dayLabel={(date) => (date <= addDays(today, 1) ? dayLabel(date, today).toLowerCase() : dayLabel(date, today))}
        onAnswered={() => setReload((n) => n + 1)}
      />
      <p className="trip-plan__intro">
        {t("Välj dagen för din tur i")}{" "}{regionName}{t(". Du får prognosen för den dagen som notis när Naturvårdsverket publicerar den, oftast kl 18 kvällen före. Finns ingen farograd på morgonen får du veta det också.")}
      </p>
      <div className="chip-row trip-plan__days" role="group" aria-label={t("Dag för turen")}>
        {days.map((date) => {
          const on = planned.has(date);
          return (
            <button
              key={date}
              type="button"
              className={on ? "chip chip--on" : "chip"}
              aria-pressed={on}
              disabled={busy !== null || trips === null}
              onClick={() => void toggle(date)}
            >
              {dayLabel(date, today)}
            </button>
          );
        })}
      </div>
      {here.length > 0 && routeChoices.length > 0 && (
        <label className="form__field trip-plan__route">
          {t("Jämför en sparad rutt med prognosen")}{" "}<span className="muted">{t("(valfritt)")}</span>
          <select
            value={routeId ?? ""}
            disabled={routeBusy || busy !== null}
            onChange={(e) => void chooseRoute(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">{t("Ingen rutt")}</option>
            {routeChoices.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
          <span className="muted">
            {routeBusy
              ? t("Räknar på rutten…")
              : t("Notisen säger då var rutten går över brant mark där prognosen anger lavinproblem. Ändrar du rutten senare, välj den igen här.")}
          </span>
        </label>
      )}
      {tripOfflineAvailable() && (
        <div className="trip-plan__offline">
          <label className="push-toggle__label">
            <input
              type="checkbox"
              checked={autoOffline}
              onChange={(e) => {
                setAutoOffline(e.target.checked);
                setTripOfflineAuto(e.target.checked);
              }}
            />
            {t("Spara kartan offline när jag planerar en dag")}
          </label>
          {offline?.phase === "saving" && (
            <p className="muted" role="status">
              {offline.progress
                ? t("Sparar kartan inför turen… {done} av {total} kartbitar", {
                    done: offline.progress.done.toLocaleString(locale()),
                    total: offline.progress.total.toLocaleString(locale()),
                  })
                : t("Sparar kartan inför turen…")}{" "}
              <button type="button" className="link-button" onClick={() => abort.current?.abort()}>
                {t("Avbryt")}
              </button>
            </p>
          )}
          {offline?.phase === "done" && (
            <p className="muted" role="status">
              {offline.route
                ? t("✓ Kartan över området och längs rutten finns nu på enheten, även utan täckning.")
                : t("✓ Kartan över området finns nu på enheten, även utan täckning.")}
            </p>
          )}
          {offline?.phase === "error" && <p className="error">{offline.message}</p>}
          {!offline && (
            <p className="muted">
              {t("Områdets översiktskarta, ca {size}, och din rutt. Gör det gärna på wifi.", { size: formatMegabytes(35e6) })}
            </p>
          )}
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {here.length > 0 && (
        <div className="trip-plan__status" role="status">
          <ul className="trip-plan__planned">
            {here.map((trip) => (
              <li key={trip.id}>
                <strong>{dayLabel(trip.date, today)}</strong>{": "}
                {trip.notified ? t("prognosen är skickad") : t("väntar på prognosen")}
                <TripInviteBox
                  token={token}
                  trip={trip}
                  onChange={(next) => setTrips((list) => (list ?? []).map((x) => (x.id === next.id ? next : x)))}
                />
                {trip.date === today && ((trip.company?.length ?? 0) > 0 || (trip.invites ?? []).some((i) => i.status === "accepted")) && (
                  <Link to="/dela-position" className="trip-plan__share">
                    {t("Dela din position med sällskapet")}
                  </Link>
                )}
              </li>
            ))}
          </ul>
          <p className="muted">
            {t("Notisen syns under klockan i menyn. Vill du få den i telefonen, slå på det under")}{" "}
            <Link to="/notiser">{t("Notiser")}</Link>.
          </p>
        </div>
      )}
    </div>
  );
}
