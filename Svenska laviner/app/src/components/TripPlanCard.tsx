import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { fetchTrips, planTrip, removeTrip, type TripPlan } from "../services/tripService";

const DAYS_SHOWN = 8;

function stockholmToday(now: Date): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm" }).format(now);
}

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** "Idag", "I morgon", then "lör 14/2". */
function dayLabel(date: string, today: string): string {
  if (date === today) return "Idag";
  if (date === addDays(today, 1)) return "I morgon";
  const [y, m, d] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("sv-SE", { weekday: "short", timeZone: "UTC" });
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
  const today = stockholmToday(now);

  useEffect(() => {
    if (!token) return;
    let live = true;
    fetchTrips(token)
      .then((list) => live && setTrips(list))
      .catch(() => live && setTrips([]));
    return () => {
      live = false;
    };
  }, [token]);

  if (!user || !token) {
    return (
      <p className="trip-plan__intro">
        Planerar du en tur hit? <Link to={`/logga-in?next=/omrade/${regionId}`}>Logga in</Link> så skickar Snöläge
        prognosen för din turdag så fort den publiceras.
      </p>
    );
  }

  const here = (trips ?? []).filter((t) => t.regionId === regionId);
  const planned = new Map(here.map((t) => [t.date, t]));

  async function toggle(date: string) {
    setBusy(date);
    setError(null);
    try {
      const existing = planned.get(date);
      if (existing) {
        await removeTrip(token!, existing.id);
        setTrips((list) => (list ?? []).filter((t) => t.id !== existing.id));
      } else {
        const trip = await planTrip(token!, regionId, date);
        setTrips((list) => [...(list ?? []), trip]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Det gick inte att spara.");
    } finally {
      setBusy(null);
    }
  }

  const days = Array.from({ length: DAYS_SHOWN }, (_, i) => addDays(today, i));

  return (
    <div className="trip-plan">
      <p className="trip-plan__intro">
        Välj dagen för din tur i {regionName}. Du får prognosen för den dagen som notis när Naturvårdsverket publicerar
        den, oftast kl 18 kvällen före. Finns ingen farograd på morgonen får du veta det också.
      </p>
      <div className="chip-row trip-plan__days" role="group" aria-label="Dag för turen">
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
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {here.length > 0 && (
        <p className="muted trip-plan__status" role="status">
          {here
            .map((t) => `${dayLabel(t.date, today)}: ${t.notified ? "prognosen är skickad" : "väntar på prognosen"}`)
            .join(" · ")}
          . Notisen syns under klockan i menyn. Vill du få den i telefonen, slå på det under{" "}
          <Link to="/notiser">Notiser</Link>.
        </p>
      )}
    </div>
  );
}
