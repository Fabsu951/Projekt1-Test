import { useState } from "react";
import ElevationProfile from "./ElevationProfile";
import { formatDistance } from "../utils/tourFormat";
import { formatHours, SLOPE_BANDS, type RouteAnalysis } from "../utils/routePlan";

/** Stats, height profile and actions for the route being planned. */
export default function RoutePanel({
  pointCount,
  analysis,
  loading,
  hoverIndex,
  onHover,
  onUndo,
  onClear,
  onExport,
  onClose,
}: {
  pointCount: number;
  analysis: RouteAnalysis | null;
  loading: boolean;
  hoverIndex: number | null;
  onHover: (index: number | null) => void;
  onUndo: () => void;
  onClear: () => void;
  onExport: () => void;
  onClose: () => void;
}) {
  const [folded, setFolded] = useState(false);
  const steepBands = analysis
    ? SLOPE_BANDS.map((b, i) => ({ ...b, m: analysis.bandLengthsM[i] })).filter((b, i) => i > 0 && b.m >= 25)
    : [];

  return (
    <section className="route-panel" aria-label="Ruttplanering">
      <div className="route-panel__head">
        <h2>
          <button
            type="button"
            className="route-panel__fold"
            aria-expanded={!folded}
            onClick={() => setFolded((f) => !f)}
          >
            Planera rutt
            {folded && analysis && (
              <span className="route-panel__summary">
                {formatDistance(Math.round(analysis.distanceM))} · ↑ {analysis.ascentM} m · {formatHours(analysis.hours)}
              </span>
            )}
            <span className={folded ? "map-toolbar__chevron" : "map-toolbar__chevron map-toolbar__chevron--open"} aria-hidden="true" />
          </button>
        </h2>
        <div className="route-panel__actions">
          <button type="button" className="button" onClick={onUndo} disabled={pointCount === 0}>
            Ångra
          </button>
          <button type="button" className="button" onClick={onClear} disabled={pointCount === 0}>
            Rensa
          </button>
          <button type="button" className="button button--primary" onClick={onExport} disabled={!analysis}>
            Spara som GPX
          </button>
          <button type="button" className="button" onClick={onClose}>
            Klar
          </button>
        </div>
      </div>

      {folded ? null : pointCount < 2 ? (
        <p className="route-panel__hint">
          {pointCount === 0 ? "Klicka på kartan där turen börjar." : "Klicka vidare längs vägen du vill gå."} Dra en
          punkt för att flytta den.
        </p>
      ) : !analysis ? (
        <p className="route-panel__hint">{loading ? "Räknar på rutten…" : "Kunde inte läsa höjddata just nu."}</p>
      ) : (
        <>
          <dl className="route-stats">
            <div>
              <dt>Distans</dt>
              <dd>{formatDistance(Math.round(analysis.distanceM))}</dd>
            </div>
            <div>
              <dt>Upp</dt>
              <dd>{analysis.ascentM} m</dd>
            </div>
            <div>
              <dt>Ner</dt>
              <dd>{analysis.descentM} m</dd>
            </div>
            <div>
              <dt>Högsta punkt</dt>
              <dd>{analysis.maxElevationM === null ? "–" : `${analysis.maxElevationM} m`}</dd>
            </div>
            <div>
              <dt>Tid, ungefär</dt>
              <dd>{formatHours(analysis.hours)}</dd>
            </div>
            <div>
              <dt>Brantast</dt>
              <dd>{analysis.maxSlope === null ? "–" : `${Math.round(analysis.maxSlope)}°`}</dd>
            </div>
          </dl>

          <ElevationProfile samples={analysis.samples} hoverIndex={hoverIndex} onHover={onHover} />

          <p className="route-panel__steep">
            {steepBands.length === 0
              ? "Marken under rutten är flackare än 30° hela vägen (enligt höjddatan)."
              : "Brant mark under rutten: "}
            {steepBands.map((b) => (
              <span key={b.label} className="route-panel__band">
                <span className="route-panel__swatch" style={{ backgroundColor: b.color }} aria-hidden="true" />
                {formatDistance(Math.round(b.m / 10) * 10)} i {b.label}
              </span>
            ))}
          </p>
          {analysis.incomplete && (
            <p className="notice">Höjddata saknas för en del av rutten, så siffrorna gäller bara resten.</p>
          )}
        </>
      )}

      {!folded && (
        <p className="route-panel__note">
          Tiden är beräknad med Munter-metoden utan pauser. Lutningen kommer från höjddata med ungefär 30 m
          upplösning och visar bara marken precis under linjen – korta branta partier, hängdrivor och sluttningar
          ovanför rutten syns inte. Använd den för planering, inte som besked om att en sluttning är säker.
        </p>
      )}
    </section>
  );
}
