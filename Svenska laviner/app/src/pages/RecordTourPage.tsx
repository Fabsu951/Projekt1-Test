import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import PageLoading from "../components/PageLoading";
import RecordingMap from "../components/RecordingMap";
import { useRecording } from "../hooks/useRecording";
import {
  discardRecording,
  finishRecording,
  nativeRecording,
  pauseRecording,
  readRecording,
  resumeRecording,
  startRecording,
} from "../services/tourRecorder";
import { clockText, goodSegments, movingTimeMs, parseLines, summarize } from "../utils/recording";
import { formatDistance } from "../utils/tourFormat";
import { t, locale } from "../i18n";

/** The page to come back to; the notification and the banner link here. */
export const RECORD_PATH = "/turer/spela-in";
export const SAVE_RECORDING_PATH = "/turer/ny?inspelning=1";

/**
 * "Spela in tur": start recording on the phone instead of the watch. The
 * moving time is the one big thing on the page; distance and climb sit
 * quietly under it, the map follows below, and the two buttons are big
 * enough for gloves.
 */
export default function RecordTourPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { status, entries } = useRecording(true);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const recording = status?.state === "recording";

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  const summary = useMemo(() => summarize(entries), [entries]);
  const segments = useMemo(() => goodSegments(entries).map((s) => s.map((f) => [f.lat, f.lon] as [number, number])), [entries]);
  const at: [number, number] | null = summary.last ? [summary.last.lat, summary.last.lon] : null;

  if (!status) return <PageLoading />;

  async function act(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Något gick fel. Försök igen."));
    } finally {
      setBusy(false);
    }
  }

  async function start() {
    await act(async () => {
      const result = await startRecording();
      if (result.started) return;
      setError(
        result.reason === "location"
          ? t("Snöläge får inte använda din position. Tillåt platstjänster för Snöläge i telefonens inställningar och försök igen.")
          : result.reason === "unsupported"
            ? t("Den här webbläsaren kan inte ta fram din position.")
            : t("Inspelningen kunde inte starta. Försök igen."),
      );
    });
  }

  async function finish() {
    await act(async () => {
      await finishRecording();
      setConfirmFinish(false);
      // Read it all again: the page may not have caught the last few fixes yet.
      const { lines } = await readRecording(0);
      if (summarize(parseLines(lines)).fixes >= 2) navigate(SAVE_RECORDING_PATH);
    });
  }

  async function discard() {
    await act(async () => {
      await discardRecording();
      setConfirmDiscard(false);
    });
  }

  const discardBox = (
    <div className="recording__discard">
      {confirmDiscard ? (
        <>
          <p>{t("Vill du slänga inspelningen? Den går inte att få tillbaka.")}</p>
          <div className="button-row">
            <button type="button" className="button button--danger" disabled={busy} onClick={() => void discard()}>
              {t("Ja, släng den")}
            </button>
            <button type="button" className="button" onClick={() => setConfirmDiscard(false)}>
              {t("Behåll den")}
            </button>
          </div>
        </>
      ) : (
        <button type="button" className="link-button link-button--danger" onClick={() => setConfirmDiscard(true)}>
          {t("Släng inspelningen")}
        </button>
      )}
    </div>
  );

  if (status.state === "idle") {
    return (
      <div className="page recording">
        <header className="page__header">
          <h1>{t("Spela in tur")}</h1>
          <p className="page__lead">
            {t("Starta när du går ut, så spelar telefonen in spåret – utan klocka. Det behövs ingen täckning, och inget delas förrän du själv sparar turen.")}
          </p>
        </header>
        <button type="button" className="button button--primary recording__start" disabled={busy} onClick={() => void start()}>
          {busy ? t("Startar…") : t("Starta inspelningen")}
        </button>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <ul className="recording__notes">
          {nativeRecording() ? (
            <li>{t("Inspelningen fortsätter när skärmen är släckt eller du använder andra appar. Du ser den i notisfältet (Android) eller som den blå platsmarkeringen (iPhone).")}</li>
          ) : (
            <li>{t("I webbläsaren spelas turen bara in medan sidan är öppen och skärmen tänd. Med Snöläge-appen fortsätter inspelningen med skärmen släckt.")}</li>
          )}
          <li>{t("GPS drar batteri. Ladda telefonen innan och ta gärna med en powerbank – telefonen är också din kontakt om något händer.")}</li>
          {!user && (
            <li>
              <Link to="/logga-in?next=/turer/spela-in">{t("Logga in")}</Link>{" "}
              {t("för att kunna spara turen när du är klar. Du kan spela in ändå.")}
            </li>
          )}
        </ul>
        <p className="muted">
          {t("Har du redan turen i klockan?")}{" "}
          <Link to={user ? "/turer/ny" : "/logga-in?next=/turer/ny"}>{t("Ladda upp filen")}</Link>.
        </p>
      </div>
    );
  }

  if (status.state === "finished") {
    return (
      <div className="page recording">
        <header className="page__header">
          <h1>{t("Turen är inspelad")}</h1>
          <p className="page__lead">
            {summary.fixes >= 2
              ? t("{distance} på {time}. Spara den som en tur, så kan du se den och välja vem som får se den.", {
                  distance: formatDistance(summary.distanceM),
                  time: clockText(movingTimeMs(status.startedAt, status.pausedMs, summary.last?.time ?? status.startedAt)),
                })
              : t("Inspelningen har för få GPS-punkter för att bli en tur. Var telefonen inomhus eller utan GPS-signal?")}
          </p>
        </header>
        {summary.fixes >= 2 && (
          <Link to={user ? SAVE_RECORDING_PATH : `/logga-in?next=${encodeURIComponent(SAVE_RECORDING_PATH)}`} className="button button--primary recording__start">
            {t("Spara turen")}
          </Link>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {discardBox}
      </div>
    );
  }

  const paused = status.state === "paused";
  // While paused, pausedMs counts up to when it was read, so that moment gives the frozen clock.
  const elapsed = movingTimeMs(status.startedAt, status.pausedMs, paused ? status.checkedAt : Math.max(now, status.checkedAt));

  return (
    <div className="page recording">
      <header className="page__header recording__header">
        <h1 className="recording__title">{paused ? t("Pausad") : t("Spelar in")}</h1>
        <p className="recording__clock" aria-label={t("Tid i rörelse")}>{clockText(elapsed)}</p>
        <dl className="recording__stats">
          <div>
            <dt>{t("Distans")}</dt>
            <dd>{formatDistance(summary.distanceM)}</dd>
          </div>
          <div>
            <dt>{t("Stigning")}</dt>
            <dd>{t("ca {m} m", { m: summary.ascentM.toLocaleString(locale()) })}</dd>
          </div>
        </dl>
        <p className="recording__gps" role="status">
          {paused
            ? t("Ingen position spelas in medan turen är pausad.")
            : summary.last
              ? t("GPS ±{m} m", { m: Math.round(summary.last.accuracy ?? 0) })
              : t("Väntar på GPS – gå gärna ut i det fria.")}
        </p>
      </header>

      <RecordingMap segments={segments} at={at} />

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {confirmFinish ? (
        <div className="recording__confirm" role="group" aria-label={t("Avsluta turen?")}>
          <p>{t("Avsluta inspelningen? Sedan sparar du turen.")}</p>
          <div className="recording__buttons">
            <button type="button" className="button button--primary" disabled={busy} onClick={() => void finish()}>
              {t("Ja, avsluta")}
            </button>
            <button type="button" className="button" onClick={() => setConfirmFinish(false)}>
              {t("Fortsätt spela in")}
            </button>
          </div>
        </div>
      ) : (
        <div className="recording__buttons">
          <button type="button" className="button" disabled={busy} onClick={() => void act(paused ? resumeRecording : pauseRecording)}>
            {paused ? t("Fortsätt") : t("Pausa")}
          </button>
          <button type="button" className="button button--primary" disabled={busy} onClick={() => setConfirmFinish(true)}>
            {t("Avsluta")}
          </button>
        </div>
      )}
      {!nativeRecording() && !paused && (
        <p className="form__hint">{t("Håll sidan öppen och skärmen tänd – webbläsaren spelar inte in i bakgrunden.")}</p>
      )}
    </div>
  );
}
