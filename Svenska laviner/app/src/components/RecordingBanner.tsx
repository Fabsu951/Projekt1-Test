import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useRecording } from "../hooks/useRecording";
import { keepRecordingAlive } from "../services/tourRecorder";
import { movingTimeMs } from "../utils/recording";
import { formatDuration } from "../utils/tourFormat";
import { t } from "../i18n";

const RECORD_PATH = "/turer/spela-in";

/**
 * A strip under the header while a tour is being recorded (or waits to be
 * saved), so you can use the rest of the app and find your way back. Also
 * carries a recording on after the app or page was reopened.
 */
export default function RecordingBanner() {
  const location = useLocation();
  const { status } = useRecording(false, 30_000);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    void keepRecordingAlive();
  }, []);

  useEffect(() => {
    if (status?.state !== "recording") return;
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [status?.state]);

  if (!status || status.state === "idle") return null;
  if (location.pathname === RECORD_PATH || (location.pathname === "/turer/ny" && location.search.includes("inspelning"))) return null;

  if (status.state === "finished") {
    return (
      <div className="share-banner" role="status">
        <span className="share-banner__dot share-banner__dot--left" aria-hidden="true" />
        <span>{t("Du har en inspelad tur som inte är sparad.")}</span>
        <Link to={RECORD_PATH} className="share-banner__link">
          {t("Visa")}
        </Link>
      </div>
    );
  }
  const paused = status.state === "paused";
  const minutes = formatDuration(Math.floor(movingTimeMs(status.startedAt, status.pausedMs, paused ? status.checkedAt : Math.max(now, status.checkedAt)) / 1000)) ?? "";
  return (
    <div className="share-banner" role="status">
      <span className={paused ? "share-banner__dot share-banner__dot--left" : "share-banner__dot"} aria-hidden="true" />
      <span>{paused ? t("Turen är pausad ({time}).", { time: minutes }) : t("Spelar in tur, {time}.", { time: minutes })}</span>
      <Link to={RECORD_PATH} className="share-banner__link">
        {paused ? t("Fortsätt eller avsluta") : t("Visa")}
      </Link>
    </div>
  );
}
