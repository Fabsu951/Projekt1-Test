import { useEffect } from "react";
import { useAuth } from "../auth/useAuth";
import { flushObservationQueue, queuedObservations } from "../services/observationQueue";

const RETRY_MS = 60_000;

/** Sends observations saved without coverage: at start, when back online, when the app is reopened, and every minute. */
export default function ObservationQueueBridge() {
  const { user, token } = useAuth();
  const userId = user?.id;

  useEffect(() => {
    if (!userId || !token) return;
    let stopped = false;
    const tryNow = () => {
      if (!stopped) void flushObservationQueue(token, userId).catch(() => {});
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") tryNow();
    };
    tryNow();
    window.addEventListener("online", tryNow);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(() => {
      void queuedObservations(userId).then((list) => {
        if (list.some((q) => !q.failed)) tryNow();
      });
    }, RETRY_MS);
    return () => {
      stopped = true;
      window.removeEventListener("online", tryNow);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [userId, token]);

  return null;
}
