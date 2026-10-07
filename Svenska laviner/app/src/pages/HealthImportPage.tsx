import { useCallback, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "../auth/useAuth";
import TrackSketch from "../components/TrackSketch";
import {
  autoImportEnabled,
  defaultTitle,
  disconnectHealth,
  findNewWorkouts,
  healthConnectAvailable,
  healthConnected,
  healthImportSupported,
  HEALTH_STORE_NAME,
  importWorkout,
  LOOKBACK_DAYS,
  openHealthConnectInstall,
  openHealthConnectSettings,
  rememberImported,
  requestHealthAccess,
  setAutoImport,
  type HealthWorkout,
} from "../services/healthImport";
import type { Tour } from "../types/tour";
import { formatDistance } from "../utils/tourFormat";

// "Hämta från Health Connect / Apple Hälsa": lists sessions with a GPS route
// that the watch's app has written to the phone's health store, and imports the chosen ones as
// private tours. Sharing is a separate, deliberate step on each tour.

type State =
  | { kind: "checking" }
  | { kind: "unsupported" }
  | { kind: "missing" }
  | { kind: "not-connected"; routesDenied?: boolean }
  | { kind: "loading" }
  | { kind: "list"; workouts: HealthWorkout[] }
  | { kind: "error"; message: string };

function when(iso: string): string {
  return new Date(iso).toLocaleString("sv-SE", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function duration(w: HealthWorkout): string {
  const minutes = Math.round((Date.parse(w.endDate) - Date.parse(w.startDate)) / 60_000);
  return minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`;
}

const ios = Capacitor.getPlatform() === "ios";

export default function HealthImportPage() {
  const { user, token, loading } = useAuth();
  const [state, setState] = useState<State>({ kind: "checking" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [imported, setImported] = useState<Tour[]>([]);
  const [failed, setFailed] = useState<string | null>(null);
  const [auto, setAuto] = useState(false);

  useEffect(() => {
    void autoImportEnabled().then(setAuto);
  }, []);

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const workouts = await findNewWorkouts(token);
      setSelected(new Set(workouts.filter((w) => w.suggested).map((w) => w.id)));
      setState({ kind: "list", workouts });
    } catch (err) {
      setState({ kind: "error", message: err instanceof Error ? err.message : `Kunde inte läsa från ${HEALTH_STORE_NAME}.` });
    }
  }, [token]);

  useEffect(() => {
    let live = true;
    (async () => {
      if (!healthImportSupported()) return live && setState({ kind: "unsupported" });
      if (!(await healthConnectAvailable())) return live && setState({ kind: "missing" });
      if (!(await healthConnected())) return live && setState({ kind: "not-connected" });
      if (live) await load();
    })();
    return () => {
      live = false;
    };
  }, [load]);

  if (loading) return null;
  if (!user || !token) return <Navigate to="/logga-in?next=/turer/halsa" replace />;

  async function connect() {
    setBusy(true);
    try {
      const access = await requestHealthAccess();
      if (access.workouts && access.routes) await load();
      else setState({ kind: "not-connected", routesDenied: true });
    } catch (err) {
      setState({ kind: "error", message: err instanceof Error ? err.message : "Kunde inte be om åtkomst." });
    } finally {
      setBusy(false);
    }
  }

  async function importSelected(workouts: HealthWorkout[]) {
    const chosen = workouts.filter((w) => selected.has(w.id));
    setBusy(true);
    setFailed(null);
    const done: Tour[] = [];
    for (const w of chosen) {
      try {
        done.push(await importWorkout(token!, w));
      } catch (err) {
        setFailed(`${defaultTitle(w)}: ${err instanceof Error ? err.message : "kunde inte sparas"}`);
        break;
      }
    }
    setImported((list) => [...done, ...list]);
    setBusy(false);
    await load();
  }

  async function skipSelected(workouts: HealthWorkout[]) {
    await rememberImported(workouts.filter((w) => selected.has(w.id)).map((w) => w.id));
    await load();
  }

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="page">
      <header className="page__header">
        <Link to="/turer" className="back-link">
          ← Turer
        </Link>
        <h1>Hämta från {HEALTH_STORE_NAME}</h1>
        <p className="page__lead">
          Pass med GPS-spår som klockans app sparat i {HEALTH_STORE_NAME} blir turer i din turdagbok. De sparas som{" "}
          <strong>privata</strong>, och du väljer själv om och hur varje tur ska delas.
        </p>
      </header>

      {imported.length > 0 && (
        <div className="notice notice--ok" role="status">
          <strong>{imported.length === 1 ? "1 tur importerad" : `${imported.length} turer importerade`}</strong> (privata).
          <ul className="health-imported">
            {imported.map((t) => (
              <li key={t.id}>
                <Link to={`/turer/${t.id}`}>{t.title}</Link> – öppna för att byta namn eller dela
              </li>
            ))}
          </ul>
        </div>
      )}
      {failed && <p className="error">{failed}</p>}

      {state.kind === "checking" || state.kind === "loading" ? (
        <p>{state.kind === "loading" ? `Läser pass från ${HEALTH_STORE_NAME}…` : `Kollar ${HEALTH_STORE_NAME}…`}</p>
      ) : state.kind === "unsupported" ? (
        <div className="notice">
          Klockans pass kan hämtas i Snöläges app för Android (Health Connect) och iPhone (Apple Hälsa). Här kan du i stället{" "}
          <Link to="/turer/ny">ladda upp en GPX- eller FIT-fil</Link> från klockan.
        </div>
      ) : state.kind === "missing" && ios ? (
        <div className="health-step">
          <p>Apple Hälsa finns inte på den här enheten (till exempel en iPad). Hämta passen från en iPhone i stället.</p>
        </div>
      ) : state.kind === "missing" ? (
        <div className="health-step">
          <p>Health Connect är inte installerat på telefonen. Det är Googles app som samlar träningsdata från klockor och appar.</p>
          <button type="button" className="button button--primary" onClick={() => void openHealthConnectInstall()}>
            Installera Health Connect
          </button>
        </div>
      ) : state.kind === "not-connected" ? (
        <div className="health-step">
          <p>Snöläge läser bara dina <strong>träningspass och deras GPS-rutter</strong>, aldrig puls, vikt eller annan hälsodata, och bara medan du har appen öppen.</p>
          <ol>
            {ios ? (
              <>
                <li>Kontrollera att klockans app (till exempel Garmin Connect, Suunto eller Polar) skriver pass till Apple Hälsa. Apple Watch gör det själv.</li>
                <li>Tryck nedan och slå på <strong>Träningspass</strong> och <strong>Träningsrutter</strong> i rutan som visas.</li>
              </>
            ) : (
              <>
                <li>Kontrollera att klockans app (till exempel Garmin Connect, Suunto, Polar eller Samsung Health) skickar pass till Health Connect.</li>
                <li>Tryck nedan och tillåt <strong>Träning</strong> och <strong>Träningsrutter</strong>. Välj gärna "Tillåt alltid" för rutterna.</li>
              </>
            )}
          </ol>
          {state.routesDenied && (
            <p className="notice">
              Utan åtkomst till träningsrutter finns inga spår att hämta.{" "}
              {ios
                ? "Du kan ändra det i Inställningar → Hälsa → Dataåtkomst och enheter → Snöläge."
                : "Du kan ändra det i Health Connect under Appbehörigheter → Snöläge."}{" "}
              <button type="button" className="link-button" onClick={() => void openHealthConnectSettings()}>
                Öppna {HEALTH_STORE_NAME}
              </button>
            </p>
          )}
          <button type="button" className="button button--primary" disabled={busy} onClick={() => void connect()}>
            Koppla {HEALTH_STORE_NAME}
          </button>
        </div>
      ) : state.kind === "error" ? (
        <div className="health-step">
          <p className="error">{state.message}</p>
          <button type="button" className="button" onClick={() => void load()}>
            Försök igen
          </button>
        </div>
      ) : state.workouts.length === 0 ? (
        <div className="health-step">
          <p>Inga nya pass med GPS-spår de senaste {LOOKBACK_DAYS} dagarna.</p>
          <p className="muted">
            Syns inte din tur? Alla klockappar skickar inte GPS-rutten till {HEALTH_STORE_NAME}
            {ios ? ", och har du nekat Träningsrutter visas inga pass" : ""}. Då kan du{" "}
            <Link to="/turer/ny">ladda upp filen</Link> i stället.
          </p>
        </div>
      ) : (
        <>
          <ul className="health-list">
            {state.workouts.map((w) => (
              <li key={w.id} className="health-list__item">
                <label>
                  <input type="checkbox" checked={selected.has(w.id)} onChange={() => toggle(w.id)} />
                  <span className="health-list__sketch">
                    <TrackSketch points={w.points.map((p) => [p[0], p[1]] as [number, number])} label={`Spår för ${defaultTitle(w)}`} />
                  </span>
                  <span className="health-list__text">
                    <strong>{w.label}</strong>
                    <span>
                      {when(w.startDate)} · {duration(w)} · {formatDistance(w.distanceM)}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="button-row">
            <button
              type="button"
              className="button button--primary"
              disabled={busy || selected.size === 0}
              onClick={() => void importSelected(state.workouts)}
            >
              {busy ? "Importerar…" : `Importera valda (${selected.size})`}
            </button>
            <button type="button" className="button" disabled={busy || selected.size === 0} onClick={() => void skipSelected(state.workouts)}>
              Hoppa över valda
            </button>
          </div>
          <p className="muted">Turerna sparas som privata. Start och slut döljs med 500 m om du senare delar dem.</p>
        </>
      )}

      {(state.kind === "list" || state.kind === "error") && (
        <label className="health-auto">
          <input
            type="checkbox"
            checked={auto}
            onChange={async (e) => {
              const on = e.target.checked;
              setAuto(on);
              await setAutoImport(on);
            }}
          />
          <span>
            <strong>Lägg till nya skidpass automatiskt</strong>
            <br />
            När du öppnar appen läggs nya skidturer, snöskopass och vandringar till som <strong>privata</strong> turer. Du
            väljer fortfarande själv vilka du delar. Andra pass, till exempel löprundor, väntar här.
          </span>
        </label>
      )}

      {(state.kind === "list" || state.kind === "error") && (
        <p className="muted health-disconnect">
          <button
            type="button"
            className="link-button"
            onClick={async () => {
              await disconnectHealth();
              setState({ kind: "not-connected" });
            }}
          >
            Sluta hämta från {HEALTH_STORE_NAME}
          </button>{" "}
          (ta även bort behörigheten i {HEALTH_STORE_NAME} om du vill).
        </p>
      )}
    </div>
  );
}
