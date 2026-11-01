import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { REGIONS } from "../data/regions";
import { savedAt } from "../services/cache";
import { isNativeApp } from "../services/native";
import { formatMegabytes, listAreas, listViews, OFFLINE_LEVELS, offlineSupported } from "../services/offlineMap";
import { listOfflineRoutes } from "../services/offlineRoutes";
import { offlineMapsAvailable } from "../services/mapTiles";
import { useAuth } from "../auth/useAuth";
import { t, locale } from "../i18n";

// "Utan täckning": what Snöläge can do without a connection, and what this
// particular device has saved right now.

const WORKS: Array<[string, string]> = [
  [t("Hela appen öppnas"), t("Alla sidor och menyer. På webben efter att du besökt sidan en gång med uppkoppling.")],
  [t("Lavinprognosen"), t("Den senast hämtade, med tid för när den hämtades. Kolla att den fortfarande gäller.")],
  [t("Väder och vind"), t("För de områden du har öppnat med uppkoppling.")],
  [t("Säkerhetsguiden och lavinskalan"), t("Alltid, de är inbyggda.")],
  [t("Sparade kartor"), t("Områdeskartor, sparade kartvyer och kartan längs rutter du sparat offline.")],
  [t("Rutter sparade offline"), t("Karta, höjdprofil, lutning och jämförelsen med prognosen du hade när du sparade.")],
  [t("Min position"), t("GPS fungerar utan mobilnät. Den blå pricken syns på sparade kartor.")],
  [t("Observationer, turer, flöde, notiser"), t("Det du senast tittade på visas igen, med tid.")],
  [t("Inloggningen"), t("Du är fortfarande inloggad och ser dina egna listor.")],
];

const NEEDS: Array<[string, string]> = [
  [t("Ny prognos och nytt väder"), t("Hämtas automatiskt så fort du har täckning igen.")],
  [t("Lägga upp något"), t("Observationer, turer, kommentarer, gilla, följa och spara rutter i kontot.")],
  [t("Rita en ny rutt"), t("Höjder och lutning hämtas från internet. Planera hemma och spara rutten offline.")],
  [t("Karta utanför det du sparat"), t("Även lutningskartan, ”Hitta åk” och värmekartan över turer.")],
  [t("Logga in, skapa konto"), t("Och byta lösenord eller profilbild.")],
  [t("Notiser"), t("Kommer när telefonen har täckning igen.")],
];

function when(iso: string | null): string {
  if (!iso) return t("inte sparad");
  return new Date(iso).toLocaleString(locale(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

interface DeviceStatus {
  appSaved: boolean | null;
  forecast: string | null;
  weather: Array<{ name: string; at: string }>;
  areas: Array<{ name: string; detail: string }>;
  views: Array<{ name: string; detail: string }>;
  routes: Array<{ name: string; detail: string }>;
}

async function readStatus(): Promise<DeviceStatus> {
  const native = isNativeApp();
  let appSaved: boolean | null = native ? true : null;
  if (!native && typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    try {
      appSaved = !!(await navigator.serviceWorker.getRegistration())?.active;
    } catch {
      appSaved = false;
    }
  }
  const mapsOk = offlineMapsAvailable && offlineSupported();
  const [forecast, weather, areas, views, routes] = await Promise.all([
    savedAt("forecasts:official"),
    Promise.all(REGIONS.map(async (r) => ({ name: r.name, at: await savedAt(`weather:${r.id}`) }))),
    mapsOk ? listAreas() : Promise.resolve({} as Awaited<ReturnType<typeof listAreas>>),
    mapsOk ? listViews() : Promise.resolve([] as Awaited<ReturnType<typeof listViews>>),
    mapsOk ? listOfflineRoutes() : Promise.resolve([] as Awaited<ReturnType<typeof listOfflineRoutes>>),
  ]);
  return {
    appSaved,
    forecast,
    weather: weather.filter((w): w is { name: string; at: string } => !!w.at),
    areas: Object.entries(areas).map(([id, a]) => ({
      name: REGIONS.find((r) => r.id === id)?.name ?? id,
      detail: `${OFFLINE_LEVELS[a.level]?.label ?? ""}, ${formatMegabytes(a.bytes)}, ${when(a.savedAt)}`,
    })),
    views: views.map((v) => ({ name: v.name, detail: `${formatMegabytes(v.bytes)}, ${when(v.savedAt)}` })),
    routes: routes.map((r) => ({ name: r.title || t("Rutt utan namn"), detail: `${formatMegabytes(r.bytes)}, ${when(r.savedAt)}` })),
  };
}

function Status({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <li className={ok ? "offline-status offline-status--ok" : "offline-status"}>
      <span className="offline-status__mark" aria-hidden="true">
        {ok ? "✓" : "–"}
      </span>
      <span>{children}</span>
    </li>
  );
}

export default function OfflinePage() {
  const { user } = useAuth();
  const [status, setStatus] = useState<DeviceStatus | null>(null);

  useEffect(() => {
    let live = true;
    readStatus().then((s) => live && setStatus(s));
    return () => {
      live = false;
    };
  }, []);

  const mapCount = status ? status.areas.length + status.views.length + status.routes.length : 0;

  return (
    <div className="page">
      <header className="page__header">
        <h1>{t("Utan täckning")}</h1>
        <p className="page__lead">
          {t("Snöläge fungerar till stor del utan mobilnät, men bara med det som redan finns sparat på telefonen. Förbered dig medan du har täckning.")}
        </p>
      </header>

      <section className="section" aria-labelledby="offline-device">
        <h2 id="offline-device">{t("Sparat på den här enheten")}</h2>
        {!status ? (
          <p>{t("Kollar…")}</p>
        ) : (
          <ul className="offline-status-list">
            <Status ok={status.appSaved === true}>
              <strong>{t("Appen själv:")}</strong>{" "}
              {isNativeApp()
                ? t("inbyggd, öppnas alltid.")
                : status.appSaved
                  ? t("sparad i webbläsaren, öppnas utan nät.")
                  : t("inte sparad än. Ladda om sidan en gång med uppkoppling.")}
            </Status>
            <Status ok={!!status.forecast}>
              <strong>{t("Lavinprognos:")}</strong> {status.forecast ? t("hämtad {time}", { time: when(status.forecast) }) : t("inte hämtad än. Öppna startsidan.")}
            </Status>
            <Status ok={status.weather.length > 0}>
              <strong>{t("Väder:")}</strong>{" "}
              {status.weather.length > 0
                ? status.weather.map((w) => `${w.name} (${when(w.at)})`).join(", ")
                : t("inget område öppnat än.")}
            </Status>
            <Status ok={mapCount > 0}>
              <strong>{t("Kartor:")}</strong>{" "}
              {mapCount > 0 ? t("{n} sparade", { n: mapCount }) : t("inga sparade. Se nedan hur du sparar.")}
            </Status>
            {status.areas.length + status.views.length + status.routes.length > 0 && (
              <li className="offline-status offline-status--nested">
                <ul>
                  {status.areas.map((a) => (
                    <li key={`a-${a.name}`}>
                      {t("Område")}{" "}{a.name} <span className="muted">– {a.detail}</span>
                    </li>
                  ))}
                  {status.views.map((v, i) => (
                    <li key={`v-${i}`}>
                      {t("Kartvy")}{" "}{v.name} <span className="muted">– {v.detail}</span>
                    </li>
                  ))}
                  {status.routes.map((r, i) => (
                    <li key={`r-${i}`}>
                      {t("Rutt")}{" "}{r.name} <span className="muted">– {r.detail}</span>
                    </li>
                  ))}
                </ul>
              </li>
            )}
            <Status ok={!!user}>
              <strong>{t("Konto:")}</strong> {user ? t("inloggad som {name}", { name: user.displayName }) : t("inte inloggad (behövs bara för dina egna turer och rutter).")}
            </Status>
          </ul>
        )}
      </section>

      <section className="section" aria-labelledby="offline-works">
        <h2 id="offline-works">{t("Fungerar utan täckning")}</h2>
        <ul className="offline-list offline-list--works">
          {WORKS.map(([title, text]) => (
            <li key={title}>
              <strong>{title}</strong>
              <span>{text}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="section" aria-labelledby="offline-needs">
        <h2 id="offline-needs">{t("Kräver uppkoppling")}</h2>
        <ul className="offline-list offline-list--needs">
          {NEEDS.map(([title, text]) => (
            <li key={title}>
              <strong>{title}</strong>
              <span>{text}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="section" aria-labelledby="offline-before">
        <h2 id="offline-before">{t("Inför turen, med täckning")}</h2>
        <ol className="offline-steps">
          <li>
            {t("Öppna")}{" "}<Link to="/">{t("ditt område")}</Link>{" "}{t("så sparas dagens prognos och väder.")}
          </li>
          <li>{t("Spara områdets karta under \"Karta offline\" på områdessidan.")}</li>
          <li>
            {t("Planera rutten på")}{" "}<Link to="/karta">{t("kartan")}</Link>{" "}{t("och tryck \"Spara offline\" i ruttpanelen. Eller zooma till ditt område och tryck \"Spara det som syns offline\" under Kartlager.")}
          </li>
          <li>{t("Läs hela prognosen på lavinprognoser.se och ta gärna en skärmbild av den.")}</li>
          <li>{t("Ladda telefonen och ta med powerbank. Kyla tömmer batteriet fort.")}</li>
        </ol>
        <p className="muted">
          {t("Det sparade uppdateras inte av sig självt utan täckning. Läs alltid tiden för när prognosen hämtades. Snöläge ersätter inte den officiella prognosen eller ditt eget omdöme i fält.")}
        </p>
      </section>
    </div>
  );
}
