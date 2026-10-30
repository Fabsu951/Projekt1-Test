import { useEffect, useRef, useState } from "react";
import type { AvalancheRegion } from "../types/avalanche";
import {
  downloadArea,
  estimateBytes,
  formatMegabytes,
  OFFLINE_LEVELS,
  offlineBounds,
  offlineSupported,
  removeArea,
  savedArea,
  tileCount,
  type DownloadProgress,
  type OfflineLevel,
  type SavedArea,
} from "../services/offlineMap";
import { offlineMapsAvailable, mapTileUrls } from "../services/mapTiles";
import { t, locale } from "../i18n";

const DATE = new Intl.DateTimeFormat(locale(), { day: "numeric", month: "short" });

interface Props {
  region: AvalancheRegion;
}

/** Save the map around a region for use without coverage. */
export default function OfflineMapCard({ region }: Props) {
  const [saved, setSaved] = useState<SavedArea | null | undefined>(undefined);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    savedArea(region.id).then((area) => !cancelled && setSaved(area));
    return () => {
      cancelled = true;
      abort.current?.abort();
    };
  }, [region.id]);

  if (!offlineMapsAvailable || !offlineSupported() || saved === undefined) return null;

  const sizes = (Object.keys(OFFLINE_LEVELS) as OfflineLevel[]).map((level) => {
    const tiles = tileCount(offlineBounds(region), OFFLINE_LEVELS[level].maxZoom);
    return { level, label: OFFLINE_LEVELS[level].label, size: formatMegabytes(estimateBytes(tiles)) };
  });

  async function download(level: OfflineLevel) {
    setError(null);
    abort.current = new AbortController();
    setProgress({ done: 0, total: 1 });
    try {
      setSaved(await downloadArea(region, level, mapTileUrls, setProgress, abort.current.signal));
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setError(err instanceof Error ? err.message : t("Kunde inte spara kartan."));
      }
    } finally {
      setProgress(null);
      abort.current = null;
    }
  }

  async function remove() {
    setError(null);
    try {
      await removeArea(region.id);
      setSaved(null);
    } catch {
      setError(t("Kunde inte ta bort den sparade kartan."));
    }
  }

  return (
    <div className="offline-map">
      {progress ? (
        <>
          <p>
            {t("Sparar kartan… {done} av {total} kartbitar", { done: progress.done.toLocaleString(locale()), total: progress.total.toLocaleString(locale()) })}
          </p>
          <progress max={progress.total} value={progress.done} aria-label={t("Nedladdning av offlinekarta")} />
          <button type="button" className="button" onClick={() => abort.current?.abort()}>
            {t("Avbryt")}
          </button>
        </>
      ) : saved ? (
        <>
          <p>
            <strong>{t("Sparad för offline")}</strong> ({OFFLINE_LEVELS[saved.level].label.toLowerCase()},{" "}
            {formatMegabytes(saved.bytes)}, {DATE.format(new Date(saved.savedAt))}{t("). Kartan runt")}{" "}{region.name}{" "}{t("fungerar utan täckning.")}
          </p>
          <div className="button-row">
            <button type="button" className="button" onClick={() => void download(saved.level)}>
              {t("Uppdatera")}
            </button>
            <button type="button" className="button" onClick={() => void remove()}>
              {t("Ta bort")}
            </button>
          </div>
        </>
      ) : (
        <>
          <p>
            {t("Spara kartan för ett område på ca 60 × 60 km runt")}{" "}{region.name}{" "}{t("så att den fungerar utan täckning. Gör det gärna på wifi.")}
          </p>
          <div className="button-row">
            {sizes.map((s) => (
              <button key={s.level} type="button" className="button" onClick={() => void download(s.level)}>
                {s.label}{" "}{t("(ca")}{" "}{s.size})
              </button>
            ))}
          </div>
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
