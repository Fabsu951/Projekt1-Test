import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { activeShare, lingeringShare, SHARE_CHANGED_EVENT, type ActiveShare } from "../services/locationShare";
import { clockTime } from "../utils/shareTime";
import { t } from "../i18n";

/** A strip under the header for as long as you share your position, so it is never on by mistake. */
export default function LocationShareBanner() {
  const { user } = useAuth();
  const location = useLocation();
  const [active, setActive] = useState<ActiveShare | null>(null);
  const [left, setLeft] = useState<{ keptUntil: string } | null>(null);
  const userId = user?.id;

  useEffect(() => {
    let live = true;
    const refresh = () =>
      void Promise.all([activeShare(userId), lingeringShare(userId)]).then(([a, l]) => {
        if (!live) return;
        setActive(a);
        setLeft(a ? null : l);
      });
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

  const onPage = location.pathname === "/dela-position";
  if (!active && left) {
    // Ran out without a stop: friends still see the last point.
    return (
      <div className="share-banner" role="status">
        <span className="share-banner__dot share-banner__dot--left" aria-hidden="true" />
        <span>{t("Delningen tog slut utan att stoppas. Dina kompisar ser din senaste position till kl. {time}.", { time: clockTime(left.keptUntil) })}</span>
        {!onPage && (
          <Link to="/dela-position" className="share-banner__link">
            {t("Ta bort den")}
          </Link>
        )}
      </div>
    );
  }
  if (!active) return null;
  return (
    <div className="share-banner" role="status">
      <span className="share-banner__dot" aria-hidden="true" />
      <span>{t("Du delar din position till kl. {time}.", { time: clockTime(active.endsAt) })}</span>
      {!onPage && (
        <Link to="/dela-position" className="share-banner__link">
          {t("Ändra eller stoppa")}
        </Link>
      )}
    </div>
  );
}
