import { useEffect, useRef, useState } from "react";
import { REGIONS } from "../data/regions";
import { useFavorites } from "../favorites/useFavorites";
import { lang, setLang, t } from "../i18n";
import Icon, { type IconName } from "./Icon";
import { useRegionPush } from "../hooks/useRegionPush";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { markWelcomeDone as markDone } from "../services/welcome";

const POINTS: Array<[IconName, string, string]> = [
  ["mountain", t("Dagens lavinprognos"), t("Farograd och lavinproblem från Naturvårdsverket, för de områden du åker i.")],
  ["map", t("Planera turen"), t("Topografisk karta med lutning, dina rutter jämförda med prognosen och kartor som fungerar utan täckning.")],
  ["eye", t("Se vad andra ser"), t("Observationer och turer från andra åkare, och dela dina egna.")],
];

/**
 * Three short steps the first time someone opens the app: what it is (and
 * the language), which mountains they ski in, and notifications. Can be
 * skipped at any point and never comes back once done or skipped.
 */
export default function WelcomeGuide({ onClose }: { onClose: () => void }) {
  const { isFavorite, toggleFavorite, favorites } = useFavorites();
  const [step, setStep] = useState(0);
  const push = useRegionPush({ sync: false });
  // Ticked from the start; the browser only asks for permission when "Klar" is pressed.
  const [wantPush, setWantPush] = useState(true);
  const canPush = push.available && favorites.length > 0;
  const heading = useRef<HTMLHeadingElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  useFocusTrap(dialog);

  const close = () => {
    markDone();
    onClose();
  };

  // Turns notifications on (or off) as ticked; stays open if that failed, to show why.
  const finish = async () => {
    if (canPush && wantPush !== push.enabled && !(await push.set(wantPush))) return;
    close();
  };

  useEffect(() => {
    heading.current?.focus();
  }, [step]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        markDone();
        onClose();
      }
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const english = lang() === "en";

  return (
    <div className="welcome" role="dialog" aria-modal="true" aria-labelledby="welcome-title" ref={dialog}>
      <div className="welcome__panel">
        <div className="welcome__top">
          <ol className="welcome__steps" aria-label={t("Steg {n} av 3", { n: step + 1 })}>
            {[0, 1, 2].map((i) => (
              <li key={i} className={i <= step ? "welcome__dot welcome__dot--done" : "welcome__dot"} />
            ))}
          </ol>
          <button type="button" className="welcome__skip" onClick={close}>
            {t("Hoppa över")}
          </button>
        </div>

        {step === 0 && (
          <>
            <h2 id="welcome-title" ref={heading} tabIndex={-1}>
              {t("Välkommen till Snöläge")}
            </h2>
            <p className="welcome__lead">{t("Lavinläget i de svenska fjällen, samlat på ett ställe.")}</p>
            <ul className="welcome__points">
              {POINTS.map(([icon, title, text]) => (
                <li key={title}>
                  <span className="welcome__icon">
                    <Icon name={icon} size={22} />
                  </span>
                  <span>
                    <strong>{title}</strong>
                    {text}
                  </span>
                </li>
              ))}
            </ul>
            <div className="welcome__lang" role="group" aria-label="Språk / Language">
              <button type="button" aria-pressed={!english} lang="sv" onClick={() => english && setLang("sv")}>
                Svenska
              </button>
              <button type="button" aria-pressed={english} lang="en" onClick={() => !english && setLang("en")}>
                English
              </button>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h2 id="welcome-title" ref={heading} tabIndex={-1}>
              {t("Vilka fjäll åker du i?")}
            </h2>
            <p className="welcome__lead">
              {t("Välj ett eller flera områden. De hamnar överst på startsidan med dagens prognos. Du kan ändra dig när som helst med stjärnan.")}
            </p>
            <ul className="welcome__areas">
              {REGIONS.map((region) => {
                const on = isFavorite(region.id);
                return (
                  <li key={region.id}>
                    <button type="button" aria-pressed={on} onClick={() => toggleFavorite(region.id)}>
                      <span>
                        <strong>{region.name}</strong>
                        <small>{region.subAreas.slice(0, 3).join(", ")}</small>
                      </span>
                      <span className="welcome__check" aria-hidden="true">
                        {on && <Icon name="check" size={18} />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {step === 2 && (
          <>
            <h2 id="welcome-title" ref={heading} tabIndex={-1}>
              {t("Vill du få en notis?")}
            </h2>
            <p className="welcome__lead">
              {favorites.length > 0
                ? t("Snöläge kan säga till när farograden ändras i dina områden. Det går att stänga av när du vill.")
                : t("När du har valt områden kan Snöläge säga till när farograden ändras där.")}
            </p>
            {canPush && (
              <label className="push-toggle__label welcome__push">
                <input type="checkbox" checked={wantPush} disabled={push.busy} onChange={(e) => setWantPush(e.target.checked)} />
                {t("Notis när farograden ändras i mina områden")}
              </label>
            )}
            {push.checked && !push.available && (
              <p className="welcome__note">{t("Notiser går inte att slå på här just nu. Du kan göra det senare under Mina områden på startsidan.")}</p>
            )}
            {push.message && (
              <p className="push-toggle__message" role="alert">
                {push.message}
              </p>
            )}
            <p className="welcome__note">
              <Icon name="info" size={16} />
              {t("Notiserna ersätter aldrig prognosen. Läs alltid hela prognosen innan du ger dig ut.")}
            </p>
          </>
        )}

        <div className="welcome__actions">
          {step > 0 && (
            <button type="button" className="button button--ghost" onClick={() => setStep(step - 1)}>
              <Icon name="arrowLeft" size={18} />
              {t("Tillbaka")}
            </button>
          )}
          {step < 2 ? (
            <button type="button" className="button button--primary" onClick={() => setStep(step + 1)}>
              {step === 0 ? t("Kom igång") : t("Nästa")}
              <Icon name="arrowRight" size={18} />
            </button>
          ) : (
            <button type="button" className="button button--primary" disabled={push.busy} onClick={() => void finish()}>
              {t("Klar")}
              <Icon name="check" size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
