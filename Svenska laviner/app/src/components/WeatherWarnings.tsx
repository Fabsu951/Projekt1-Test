import { SMHI_WARNINGS_PAGE, type WarningLevel, type WeatherWarning } from "../services/warningService";
import { useWarnings } from "../hooks/useWarnings";
import { lang, locale, t } from "../i18n";

const LEVEL_LABEL: Record<WarningLevel, string> = {
  yellow: t("Gul varning"),
  orange: t("Orange varning"),
  red: t("Röd varning"),
  message: t("Meddelande"),
};

function when(w: WeatherWarning): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(locale(), { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  if (w.start && w.end) return `${fmt(w.start)} – ${fmt(w.end)}`;
  if (w.start) return t("från {time}", { time: fmt(w.start) });
  if (w.end) return t("till {time}", { time: fmt(w.end) });
  return "";
}

const pick = (p: { sv: string; en: string }) => (lang() === "en" ? p.en || p.sv : p.sv);

/** The level as a coloured chip with an icon and words (never colour alone). */
export function WarningChip({ level }: { level: WarningLevel }) {
  return (
    <span className={`warning-chip warning-chip--${level}`}>
      <span aria-hidden="true">{level === "message" ? "ℹ" : "⚠"}</span> {LEVEL_LABEL[level]}
    </span>
  );
}

/** One line per warning for the start page cards. */
export function WarningLines({ regionId }: { regionId: string }) {
  const list = useWarnings(regionId);
  if (!list?.length) return null;
  return (
    <ul className="warning-lines" aria-label={t("Vädervarningar från SMHI")}>
      {list.map((w) => (
        <li key={w.id}>
          <WarningChip level={w.level} /> {pick(w.event)}
        </li>
      ))}
    </ul>
  );
}

/** The full list on an area page; nothing at all when SMHI has no warning here. */
export default function WeatherWarnings({ regionId }: { regionId: string }) {
  const list = useWarnings(regionId);
  if (!list?.length) return null;
  return (
    <section className="section weather-warnings" aria-labelledby="weather-warnings-title">
      <h2 id="weather-warnings-title">{t("Vädervarningar")}</h2>
      <ul className="weather-warnings__list">
        {list.map((w) => (
          <li key={w.id} className={`weather-warning weather-warning--${w.level}`}>
            <p className="weather-warning__head">
              <WarningChip level={w.level} /> <strong>{pick(w.event)}</strong>
            </p>
            <p className="muted">
              {[pick(w.area), when(w)].filter(Boolean).join(", ")}
            </p>
            {pick(w.text) && (
              <details>
                <summary>{t("Mer från SMHI")}</summary>
                <p className="weather-warning__text" lang={lang() === "en" && w.text.en ? "en" : "sv"}>
                  {pick(w.text)}
                </p>
              </details>
            )}
          </li>
        ))}
      </ul>
      <p className="muted">
        {t("Källa:")}{" "}
        <a href={SMHI_WARNINGS_PAGE} target="_blank" rel="noreferrer">
          {t("SMHI:s varningar")}
        </a>
        {t(". Vädervarningar säger inget om lavinfaran – läs alltid lavinprognosen också.")}
      </p>
    </section>
  );
}
