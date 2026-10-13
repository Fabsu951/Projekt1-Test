import { useEffect, useRef, useState } from "react";
import { formatMegabytes, offlineSupported } from "../services/offlineMap";
import { offlineMapsAvailable, topoTileUrl } from "../services/mapTiles";
import {
  estimateRouteBytes,
  listOfflineRoutes,
  removeOfflineRoute,
  saveRouteOffline,
  type OfflineRoute,
} from "../services/offlineRoutes";
import type { RouteDraft } from "../hooks/useRouteDraft";
import type { RouteAnalysis } from "../utils/routePlan";
import { t } from "../i18n";

/** Keeps the route being planned — map along it, profile and numbers — on this device. */
export default function RouteOfflineBox({
  draft,
  analysis,
  onSaved,
}: {
  draft: RouteDraft;
  analysis: RouteAnalysis | null;
  onSaved?: () => void;
}) {
  const [saved, setSaved] = useState<OfflineRoute | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  // The offline copy of this route: by account id, else by identical points.
  useEffect(() => {
    let cancelled = false;
    void listOfflineRoutes().then((all) => {
      if (cancelled) return;
      const points = JSON.stringify(draft.points);
      setSaved(
        all.find((r) => (draft.id !== null && r.routeId === draft.id) || JSON.stringify(r.waypoints) === points) ?? null
      );
    });
    return () => {
      cancelled = true;
    };
  }, [draft.id, draft.points]);

  useEffect(() => () => abort.current?.abort(), []);

  if (!offlineSupported() || !offlineMapsAvailable || draft.points.length < 2) return null;
  const outdated = saved !== null && JSON.stringify(saved.waypoints) !== JSON.stringify(draft.points);

  async function save() {
    if (!analysis || analysis.incomplete) return;
    setError(null);
    abort.current = new AbortController();
    setProgress({ done: 0, total: 0 });
    try {
      const result = await saveRouteOffline(
        {
          routeId: draft.id,
          key: saved?.key,
          title: draft.title.trim() || t("Rutt utan namn"),
          waypoints: draft.points,
        },
        analysis,
        topoTileUrl,
        setProgress,
        abort.current.signal
      );
      setSaved(result);
      onSaved?.();
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setError(err instanceof Error ? err.message : t("Kunde inte spara rutten offline."));
      }
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="offline-box">
      {progress ? (
        <div className="offline-box__row">
          <progress max={progress.total || 1} value={progress.done} aria-label={t("Sparar kartan längs rutten")} />
          <span>{progress.total ? `${progress.done} / ${progress.total}` : t("Förbereder…")}</span>
          <button type="button" className="button" onClick={() => abort.current?.abort()}>
            {t("Avbryt")}
          </button>
        </div>
      ) : saved && !outdated ? (
        <div className="offline-box__row">
          <span>{t("✓ Sparad offline:")}{" "}{formatMegabytes(saved.bytes)}{" "}{t("karta längs rutten")}</span>
          <button
            type="button"
            className="link-button"
            onClick={async () => {
              await removeOfflineRoute(saved.key);
              setSaved(null);
              onSaved?.();
            }}
          >
            {t("Ta bort")}
          </button>
        </div>
      ) : (
        <div className="offline-box__row">
          <button
            type="button"
            className="button"
            disabled={!analysis || analysis.incomplete}
            onClick={() => void save()}
          >
            {outdated ? t("Uppdatera offline-kopian") : t("Spara offline")}
          </button>
          <span className="offline-box__hint">
            {t("Karta längs rutten, höjdprofil och siffror utan täckning, ca")}{" "}{formatMegabytes(estimateRouteBytes(draft.points))}
          </span>
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}

/** Routes saved on this device, to open without coverage. */
export function OfflineRouteList({ onOpen, refreshKey }: { onOpen: (r: OfflineRoute) => void; refreshKey: number }) {
  const [routes, setRoutes] = useState<OfflineRoute[]>([]);
  useEffect(() => {
    void listOfflineRoutes().then(setRoutes);
  }, [refreshKey]);
  if (routes.length === 0) return null;
  return (
    <details className="offline-routes">
      <summary>{t("Rutter sparade offline (")}{routes.length})</summary>
      <ul className="offline-box__list">
        {routes.map((r) => (
          <li key={r.key}>
            <span>
              {r.title}, {formatMegabytes(r.bytes)}
            </span>
            <button type="button" className="link-button" onClick={() => onOpen(r)}>
              {t("Öppna")}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
