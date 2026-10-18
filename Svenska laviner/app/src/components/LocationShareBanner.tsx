import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { activeShare, SHARE_CHANGED_EVENT, type ActiveShare } from "../services/locationShare";
import { clockTime } from "../utils/shareTime";
import { t } from "../i18n";

/** A strip under the header for as long as you share your position, so it is never on by mistake. */
export default function LocationShareBanner() {
  const { user } = useAuth();
  const location = useLocation();
  const [active, setActive] = useState<ActiveShare | null>(null);
  const userId = user?.id;

  useEffect(() => {
    let live = true;
    const refresh = () => void activeShare(userId).then((a) => live && setActive(a));
    refresh();
    window.addEventListener(SHARE_CHANGED_EVENT, refresh);
    // The share ends by itself; check now and then so the strip goes away.
    const timer = window.setInterval(refresh, 60_000);
    return () => {
      live = false;
      window.removeEventListener(SHARE_CHANGED_EVENT, refresh);
      window.clearInterval(timer);
    };
  }, [userId]);

  if (!active) return null;
  return (
    <div className="share-banner" role="status">
      <span className="share-banner__dot" aria-hidden="true" />
      <span>{t("Du delar din position till kl. {time}.", { time: clockTime(active.endsAt) })}</span>
      {location.pathname !== "/dela-position" && (
        <Link to="/dela-position" className="share-banner__link">
          {t("Ändra eller stoppa")}
        </Link>
      )}
    </div>
  );
}
