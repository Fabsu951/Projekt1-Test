import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  formatMegabytes,
  estimateBytes,
  listViews,
  offlineSupported,
  removeView,
  saveView,
  viewPlan,
  type Bounds,
  type SavedView,
} from "../services/offlineMap";
import { offlineMapsAvailable, topoTileUrl } from "../services/mapTiles";
import { t, locale } from "../i18n";
import Icon from "./Icon";

/** "Spara kartan offline": keeps what's on screen for use without coverage. */
export default function OfflineViewBox({ bounds, onShow }: { bounds: Bounds | null; onShow: (b: Bounds) => void }) {
  const [views, setViews] = useState<SavedView[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    void listViews().then(setViews);
    return () => abort.current?.abort();
  }, []);

  if (!offlineSupported() || !offlineMapsAvailable) return null;
  const plan = bounds ? viewPlan(bounds) : null;

  async function save() {
    if (!bounds) return;
    setError(null);
    abort.current = new AbortController();
    setProgress({ done: 0, total: plan?.tiles ?? 0 });
    try {
      const name = t("Kartområde {date}", { date: new Date().toLocaleDateString(locale(), { day: "numeric", month: "short" }) });
      const view = await saveView(bounds, name, topoTileUrl, setProgress, abort.current.signal);
      setViews((list) => [view, ...list]);
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setError(err instanceof Error ? err.message : t("Kunde inte spara kartan."));
      }
    } finally {
      setProgress(null);
    }
  }

  return (
    <section className="offline-box map-layers__group" aria-labelledby="offline-box-title">
      <p id="offline-box-title" className="map-layers__title">
        {t("Karta utan täckning")}
      </p>
      {progress ? (
        <div className="offline-box__row">
          <progress max={progress.total} value={progress.done} aria-label={t("Sparar kartan")} />
          <span>
            {progress.done} / {progress.total}
          </span>
          <button type="button" className="button" onClick={() => abort.current?.abort()}>
            {t("Avbryt")}
          </button>
        </div>
      ) : (
        <div className="offline-box__row">
          <button type="button" className="button" disabled={!plan} onClick={() => void save()}>
            {t("Spara det som syns offline")}
          </button>
          <span className="offline-box__hint">
            {plan
              ? (plan.maxZoom < 15 ? t("ca {size}, zooma in för mer detaljer", { size: formatMegabytes(estimateBytes(plan.tiles)) }) : t("ca {size}", { size: formatMegabytes(estimateBytes(plan.tiles)) }))
              : t("Zooma in för att spara")}
          </span>
        </div>
      )}
      {error && <p className="error">{error}</p>}
      <Link to="/offline" className="offline-box__link">
        {t("Vad fungerar utan täckning?")}<Icon name="arrowRight" size={16} className="icon--link" />
      </Link>
      {views.length > 0 && (
        <ul className="offline-box__list">
          {views.map((v) => (
            <li key={v.key}>
              <span>
                {v.name}, {formatMegabytes(v.bytes)}
              </span>
              <span className="offline-box__actions">
                <button type="button" className="link-button" onClick={() => onShow(v.bounds)}>
                  {t("Visa")}
                </button>
                <button
                  type="button"
                  className="link-button"
                  onClick={async () => {
                    await removeView(v.key);
                    setViews((list) => list.filter((x) => x.key !== v.key));
                  }}
                >
                  {t("Ta bort")}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
