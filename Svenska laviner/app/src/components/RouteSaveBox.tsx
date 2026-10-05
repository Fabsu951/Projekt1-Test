import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { createRoute, routeLink, updateRoute } from "../services/routeService";
import type { PlannedRoute } from "../types/route";
import type { RouteDraft } from "../hooks/useRouteDraft";
import type { RouteAnalysis } from "../utils/routePlan";

/** Name, save and share-by-link controls for the route being planned. */
export default function RouteSaveBox({
  draft,
  dirty,
  analysis,
  onTitle,
  onSaved,
  onNew,
}: {
  draft: RouteDraft;
  dirty: boolean;
  analysis: RouteAnalysis | null;
  onTitle: (title: string) => void;
  onSaved: (route: PlannedRoute) => void;
  onNew: () => void;
}) {
  const { user, token } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!user || !token) {
    return (
      <p className="route-save__login">
        <Link to="/logga-in?next=/karta">Logga in</Link> för att spara rutten i ditt konto.
      </p>
    );
  }

  const title = draft.title.trim() || defaultTitle();

  async function save() {
    if (!token || !analysis) return;
    setBusy(true);
    setError(null);
    try {
      const input = {
        title,
        waypoints: draft.points,
        ascentM: analysis.incomplete ? null : analysis.ascentM,
        descentM: analysis.incomplete ? null : analysis.descentM,
      };
      onSaved(draft.id === null ? await createRoute(token, input) : await updateRoute(token, draft.id, input));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte spara rutten.");
    } finally {
      setBusy(false);
    }
  }

  async function setShared(shared: boolean) {
    if (!token || draft.id === null) return;
    setBusy(true);
    setError(null);
    try {
      onSaved(await updateRoute(token, draft.id, { shared }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte ändra delningen.");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (draft.id === null) return;
    try {
      await navigator.clipboard.writeText(routeLink(draft.id));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Kopiera länken:", routeLink(draft.id));
    }
  }

  const saved = draft.id !== null;

  return (
    <div className="route-save">
      <div className="route-save__row">
        <label className="route-save__name">
          <input
            value={draft.title}
            placeholder={defaultTitle()}
            maxLength={100}
            onChange={(e) => onTitle(e.target.value)}
            aria-label="Ruttens namn"
          />
        </label>
        <button
          type="button"
          className="button button--primary"
          onClick={save}
          disabled={busy || !analysis || (saved && !dirty)}
        >
          {saved ? (dirty ? "Spara ändringar" : "Sparad ✓") : "Spara i mitt konto"}
        </button>
        {saved && (
          <button type="button" className="button" onClick={onNew} disabled={busy}>
            Ny rutt
          </button>
        )}
      </div>
      {saved && (
        <div className="route-save__row">
          <label className="route-save__share">
            <input type="checkbox" checked={draft.shared} disabled={busy} onChange={(e) => setShared(e.target.checked)} />
            Dela
          </label>
          {draft.shared && (
            <button type="button" className="button" onClick={copyLink}>
              {copied ? "Länken kopierad ✓" : "Kopiera länk"}
            </button>
          )}
          <span className="route-save__help">
            {draft.shared
              ? "Dina följare ser rutten i sitt flöde, och den som har länken kan öppna den och spara en egen kopia."
              : "Rutten är privat – bara du ser den."}
          </span>
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}

function defaultTitle(): string {
  return `Rutt ${new Date().toLocaleDateString("sv-SE", { day: "numeric", month: "short" })}`;
}
