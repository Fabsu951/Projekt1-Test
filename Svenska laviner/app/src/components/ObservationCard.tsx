import { useState } from "react";
import { useAuth } from "../auth/useAuth";
import { observationTypeLabel } from "../data/observationTypes";
import { getRegionById } from "../data/regions";
import { imageUrl } from "../services/api";
import { deleteObservation, reportObservation, restoreObservation } from "../services/observationService";
import type { Observation } from "../types/observation";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("sv-SE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface Props {
  observation: Observation;
  /** Called after a delete/report/restore so the parent can refresh. */
  onChanged?: () => void;
  showAdminActions?: boolean;
}

export default function ObservationCard({ observation: o, onChanged, showAdminActions }: Props) {
  const { user, token } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const region = o.regionId ? getRegionById(o.regionId) : undefined;
  const isOwner = user?.id === o.userId;

  async function run(action: () => Promise<void>, done: string) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage(done);
      onChanged?.();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Något gick fel.");
    } finally {
      setBusy(false);
    }
  }

  function onReport() {
    if (!token) return;
    const reason = window.prompt("Varför är inlägget olämpligt? (valfritt)") ?? "";
    void run(() => reportObservation(token, o.id, reason), "Tack, inlägget är anmält.");
  }

  function onDelete() {
    if (!token || !window.confirm("Ta bort observationen? Det går inte att ångra.")) return;
    void run(() => deleteObservation(token, o.id), "Borttagen.");
  }

  return (
    <article className={o.hidden ? "observation-card observation-card--hidden" : "observation-card"}>
      <header className="observation-card__header">
        <span className={`observation-card__type observation-card__type--${o.type}`}>
          {observationTypeLabel(o.type)}
        </span>
        <span className="observation-card__meta">
          {formatWhen(o.observedAt)}
          {region ? ` · ${region.name}` : ""}
        </span>
      </header>
      <p className="observation-card__text">{o.description}</p>
      {o.imagePath && (
        <a href={imageUrl(o.imagePath)} target="_blank" rel="noreferrer">
          <img className="observation-card__image" src={imageUrl(o.imagePath)} alt="Bild från observationen" loading="lazy" />
        </a>
      )}
      <footer className="observation-card__footer">
        <span>
          av <strong>{o.author}</strong> ·{" "}
          <a href={`https://www.openstreetmap.org/?mlat=${o.lat}&mlon=${o.lon}#map=14/${o.lat}/${o.lon}`} target="_blank" rel="noreferrer">
            {o.lat.toFixed(4)}, {o.lon.toFixed(4)}
          </a>
        </span>
        <span className="observation-card__actions">
          {user?.canPost && !isOwner && !o.hidden && (
            <button type="button" className="link-button" onClick={onReport} disabled={busy}>
              Anmäl
            </button>
          )}
          {(isOwner || user?.isAdmin) && (
            <button type="button" className="link-button link-button--danger" onClick={onDelete} disabled={busy}>
              Ta bort
            </button>
          )}
          {showAdminActions && user?.isAdmin && o.reportCount > 0 && token && (
            <button
              type="button"
              className="link-button"
              onClick={() => void run(() => restoreObservation(token, o.id), "Återställd.")}
              disabled={busy}
            >
              Återställ
            </button>
          )}
        </span>
      </footer>
      {o.hidden && <p className="observation-card__flag">Dold efter anmälningar ({o.reportCount}).</p>}
      {message && <p className="observation-card__message">{message}</p>}
    </article>
  );
}
