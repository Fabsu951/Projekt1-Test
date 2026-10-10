import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { QUEUE_CHANGED_EVENT, queuedObservations } from "../services/observationQueue";
import { t, plural } from "../i18n";

const SENT_SHOWN_MS = 6000;

/** A strip under the header while observations wait for coverage, and briefly when they have been sent. */
export default function ObservationQueueBanner() {
  const { user } = useAuth();
  const location = useLocation();
  const [waiting, setWaiting] = useState(0);
  const [failed, setFailed] = useState(0);
  const [sent, setSent] = useState(0);
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    let live = true;
    let hide: number | undefined;
    const refresh = async (justSent = 0) => {
      const list = await queuedObservations(userId);
      if (!live) return;
      setWaiting(list.filter((q) => !q.failed).length);
      setFailed(list.filter((q) => q.failed).length);
      if (justSent > 0) {
        setSent(justSent);
        window.clearTimeout(hide);
        hide = window.setTimeout(() => setSent(0), SENT_SHOWN_MS);
      }
    };
    const changed = (e: Event) => void refresh((e as CustomEvent<{ sent?: number }>).detail?.sent ?? 0);
    void refresh();
    window.addEventListener(QUEUE_CHANGED_EVENT, changed);
    return () => {
      live = false;
      window.clearTimeout(hide);
      window.removeEventListener(QUEUE_CHANGED_EVENT, changed);
    };
  }, [userId]);

  // Signed out: nothing waits for this person (the counts may be someone else's).
  if (!userId || (!waiting && !failed && !sent)) return null;
  const onList = location.pathname === "/observationer";

  return (
    <div className={waiting || failed ? "queue-banner" : "queue-banner queue-banner--done"} role="status">
      {waiting > 0 && <span>{plural(waiting, "1 observation väntar på täckning och skickas automatiskt.", "{n} observationer väntar på täckning och skickas automatiskt.")}</span>}
      {failed > 0 && <span>{plural(failed, "1 observation kunde inte skickas.", "{n} observationer kunde inte skickas.")}</span>}
      {!waiting && !failed && sent > 0 && <span>{plural(sent, "Din observation är skickad.", "{n} observationer är skickade.")}</span>}
      {(waiting > 0 || failed > 0) && !onList && (
        <Link to="/observationer#vantar" className="queue-banner__link">
          {t("Visa")}
        </Link>
      )}
    </div>
  );
}
