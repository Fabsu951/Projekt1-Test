import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Geolocation } from "@capacitor/geolocation";
import { coordinateText, formatDecimal, formatDegreesMinutes, formatSweref } from "../utils/coordinates";
import { isNativeApp } from "../services/native";
import Icon from "../components/Icon";
import { t, locale } from "../i18n";

/** Path of the page; the map and "Utan täckning" link here. */
export const WHERE_AM_I_PATH = "/var-ar-jag";

/** Above this the fix is too vague to read out to anyone. */
const VAGUE_M = 100;

interface Fix {
  lat: number;
  lon: number;
  accuracy: number;
  altitude: number | null;
  at: number;
}

type CopyState = "idle" | "copied" | "failed";

/**
 * "Var är jag?": the phone's position in the forms rescue services and maps
 * use, big enough to read aloud, with Ring 112, copy and share. Needs only
 * GPS – no mobile coverage – once the app is on the phone.
 */
export default function WhereAmIPage() {
  const [fix, setFix] = useState<Fix | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [copy, setCopy] = useState<CopyState>("idle");

  useEffect(() => {
    let watchId: string | null = null;
    let cancelled = false;
    Geolocation.watchPosition({ enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }, (pos, err) => {
      if (cancelled) return;
      if (err || !pos) {
        setProblem(t("Kunde inte hämta din position. Kontrollera att platstjänster är påslagna och tillåtna för Snöläge."));
        return;
      }
      setProblem(null);
      setFix({
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        altitude: typeof pos.coords.altitude === "number" ? pos.coords.altitude : null,
        at: pos.timestamp || Date.now(),
      });
    })
      .then((id) => {
        if (cancelled) void Geolocation.clearWatch({ id });
        else watchId = id;
      })
      .catch(() => {
        if (!cancelled) setProblem(t("Platstjänster är inte tillgängliga på den här enheten."));
      });
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      if (watchId) void Geolocation.clearWatch({ id: watchId });
    };
  }, []);

  async function copyCoordinates() {
    if (!fix) return;
    try {
      await navigator.clipboard.writeText(coordinateText(fix.lat, fix.lon));
      setCopy("copied");
    } catch {
      setCopy("failed");
    }
    window.setTimeout(() => setCopy("idle"), 4000);
  }

  async function share() {
    if (!fix) return;
    const text = `${t("Min position")} (±${Math.round(fix.accuracy)} m, ${t("kl.")} ${clock(fix.at)}):\n${coordinateText(fix.lat, fix.lon)}`;
    try {
      if (isNativeApp()) {
        const { Share } = await import("@capacitor/share");
        await Share.share({ title: t("Min position"), text, dialogTitle: t("Dela") });
      } else if (typeof navigator.share === "function") {
        await navigator.share({ title: t("Min position"), text });
      } else {
        await copyCoordinates();
      }
    } catch {
      // Closing the share sheet throws; nothing to do.
    }
  }

  const ageS = fix ? Math.max(0, Math.round((now - fix.at) / 1000)) : 0;
  const vague = !!fix && fix.accuracy > VAGUE_M;

  return (
    <div className="page where">
      <header className="page__header">
        <h1>{t("Var är jag?")}</h1>
        <p className="page__lead">
          {t("Din position som koordinater att läsa upp eller skicka. GPS fungerar utan mobiltäckning.")}
        </p>
      </header>

      <a href="tel:112" className="button button--danger where__call">
        <Icon name="phone" size={22} />
        {t("Ring 112")}
      </a>

      {problem && (
        <p className="notice notice--danger" role="alert">
          {problem}
        </p>
      )}

      {!fix && !problem && (
        <p className="where__waiting" role="status">
          {t("Hämtar din position… Står du inomhus eller i en dal kan det ta en stund.")}
        </p>
      )}

      {fix && (
        <section className="where__fix" aria-live="polite">
          <dl className="where__forms">
            <div>
              <dt>{t("WGS 84, grader")}</dt>
              <dd>{formatDecimal(fix.lat, fix.lon)}</dd>
            </div>
            <div>
              <dt>{t("WGS 84, grader och minuter")}</dt>
              <dd>{formatDegreesMinutes(fix.lat, fix.lon)}</dd>
            </div>
            <div>
              <dt>{t("SWEREF 99 TM (svenska kartor)")}</dt>
              <dd>{formatSweref(fix.lat, fix.lon)}</dd>
            </div>
          </dl>
          <p className={vague ? "where__quality where__quality--vague" : "where__quality"}>
            {t("Noggrannhet ±{m} m", { m: Math.round(fix.accuracy).toLocaleString(locale()) })}
            {fix.altitude !== null && <>, {t("höjd ca {m} m enligt GPS", { m: Math.round(fix.altitude).toLocaleString(locale()) })}</>}
            {", "}
            {ageS < 5 ? t("uppdaterad nyss") : t("uppdaterad för {s} s sedan", { s: ageS })}
          </p>
          {vague && (
            <p className="notice" role="status">
              {t("Positionen är osäker. Gå ut i det fria om du kan och vänta en stund, så blir den bättre.")}
            </p>
          )}
          <div className="button-row where__actions">
            <button type="button" className="button" onClick={() => void copyCoordinates()}>
              <Icon name="copy" size={18} />
              {copy === "copied" ? t("Kopierat") : copy === "failed" ? t("Gick inte att kopiera") : t("Kopiera koordinaterna")}
            </button>
            <button type="button" className="button" onClick={() => void share()}>
              <Icon name="share" size={18} />
              {t("Dela")}
            </button>
            <Link to={`/karta?position=1`} className="button">
              <Icon name="map" size={18} />
              {t("Visa på kartan")}
            </Link>
          </div>
        </section>
      )}

      <section className="section where__help">
        <h2>{t("Vid en olycka")}</h2>
        <ul>
          <li>{t("Ring 112. Det går även via andra operatörers nät om ditt eget saknar täckning.")}</li>
          <li>{t("Säg att du har koordinater i WGS 84 och läs upp den första raden, eller SWEREF 99 TM om de frågar efter det.")}</li>
          <li>{t("Är någon begravd i en lavin: börja söka direkt. Är ni flera larmar en av er 112 samtidigt.")}</li>
        </ul>
        <p className="muted">
          {t("Snöläge ersätter inte en nödsändare, lavinsändare eller att någon vet var du är.")}
        </p>
      </section>
    </div>
  );
}

function clock(ms: number): string {
  return new Date(ms).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" });
}
