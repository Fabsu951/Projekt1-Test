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
  tilesFor,
  type DownloadProgress,
  type OfflineLevel,
  type SavedArea,
} from "../services/offlineMap";
import { offlineMapsAvailable, topoTileUrl } from "../services/mapTiles";

const DATE = new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "short" });

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
    const tiles = tilesFor(offlineBounds(region), OFFLINE_LEVELS[level].maxZoom).length;
    return { level, label: OFFLINE_LEVELS[level].label, size: formatMegabytes(estimateBytes(tiles)) };
  });

  async function download(level: OfflineLevel) {
    setError(null);
    abort.current = new AbortController();
    setProgress({ done: 0, total: 1 });
    try {
      setSaved(await downloadArea(region, level, topoTileUrl, setProgress, abort.current.signal));
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setError(err instanceof Error ? err.message : "Kunde inte spara kartan.");
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
      setError("Kunde inte ta bort den sparade kartan.");
    }
  }

  return (
    <div className="offline-map">
      {progress ? (
        <>
          <p>
            Sparar kartan… {progress.done.toLocaleString("sv-SE")} av {progress.total.toLocaleString("sv-SE")} kartbitar
          </p>
          <progress max={progress.total} value={progress.done} aria-label="Nedladdning av offlinekarta" />
          <button type="button" className="button" onClick={() => abort.current?.abort()}>
            Avbryt
          </button>
        </>
      ) : saved ? (
        <>
          <p>
            <strong>Sparad för offline</strong> ({OFFLINE_LEVELS[saved.level].label.toLowerCase()},{" "}
            {formatMegabytes(saved.bytes)}, {DATE.format(new Date(saved.savedAt))}). Kartan runt {region.name} fungerar
            utan täckning.
          </p>
          <div className="button-row">
            <button type="button" className="button" onClick={() => void download(saved.level)}>
              Uppdatera
            </button>
            <button type="button" className="button" onClick={() => void remove()}>
              Ta bort
            </button>
          </div>
        </>
      ) : (
        <>
          <p>
            Spara kartan för ett område på ca 60 × 60 km runt {region.name} så att den fungerar utan täckning. Gör det
            gärna på wifi.
          </p>
          <div className="button-row">
            {sizes.map((s) => (
              <button key={s.level} type="button" className="button" onClick={() => void download(s.level)}>
                {s.label} (ca {s.size})
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
