import { useEffect, useState } from "react";
import { useAuth } from "../auth/useAuth";
import { observationTypeLabel } from "../data/observationTypes";
import { flushObservationQueue, QUEUE_CHANGED_EVENT, queuedObservations, removeQueued, type QueuedObservation } from "../services/observationQueue";

function when(iso: string): string {
  return new Date(iso).toLocaleString("sv-SE", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** On /observationer: your observations still on the phone, with "Skicka nu" and "Ta bort". */
export default function QueuedObservationList() {
  const { user, token } = useAuth();
  const [list, setList] = useState<QueuedObservation[]>([]);
  const [busy, setBusy] = useState(false);
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    let live = true;
    const refresh = () => void queuedObservations(userId).then((l) => live && setList(l));
    refresh();
    window.addEventListener(QUEUE_CHANGED_EVENT, refresh);
    return () => {
      live = false;
      window.removeEventListener(QUEUE_CHANGED_EVENT, refresh);
    };
  }, [userId]);

  if (!userId || !token || list.length === 0) return null;

  async function sendNow() {
    setBusy(true);
    try {
      await flushObservationQueue(token!, userId!);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="section queued-obs" id="vantar">
      <h2>Väntar på att skickas</h2>
      <p className="section__intro">
        Sparade på den här telefonen när det saknades täckning. De skickas automatiskt, med tiden och platsen då du
        gjorde dem.
      </p>
      <ul className="queued-obs__list">
        {list.map((q) => (
          <li key={q.clientId} className="queued-obs__item">
            <span>
              <strong>{observationTypeLabel(q.observation.type)}</strong> · {when(q.observation.observedAt)}
              <span className="muted queued-obs__text">{q.observation.description}</span>
              {q.failed && <span className="error queued-obs__failed">Kunde inte skickas: {q.failed}</span>}
            </span>
            <button
              type="button"
              className="link-button"
              onClick={() => {
                if (window.confirm("Ta bort observationen från telefonen? Den skickas då aldrig.")) void removeQueued(q.clientId);
              }}
            >
              Ta bort
            </button>
          </li>
        ))}
      </ul>
      {list.some((q) => !q.failed) && (
        <button type="button" className="button" disabled={busy} onClick={() => void sendNow()}>
          {busy ? "Försöker…" : "Försök skicka nu"}
        </button>
      )}
    </section>
  );
}
