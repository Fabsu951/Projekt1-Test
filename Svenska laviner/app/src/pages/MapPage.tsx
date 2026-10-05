import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { saveTextFile } from "../services/native";
import { MapContainer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { REGIONS } from "../data/regions";
import { loadForecasts } from "../services/avalancheService";
import { forecastLabel } from "../utils/forecastLabel";
import { getDangerInfo } from "../data/dangerScale";
import type { AvalancheForecast } from "../types/avalanche";
import SlopeLayer from "../components/SlopeLayer";
import TopoLayer from "../components/TopoLayer";
import MyPosition from "../components/MyPosition";
import { fetchObservations } from "../services/observationService";
import { observationTypeLabel } from "../data/observationTypes";
import type { Observation } from "../types/observation";
import SeasonFilter from "../components/SeasonFilter";
import TourHeatmap, { HeatLegend } from "../components/TourHeatmap";
import { seasonMonths } from "../data/tourSeasons";
import { fetchTourLines, fetchTours } from "../services/tourService";
import type { Tour, TourLine } from "../types/tour";
import { formatDistance } from "../utils/tourFormat";
import RoutePlanner from "../components/RoutePlanner";
import RoutePanel from "../components/RoutePanel";
import RouteSaveBox from "../components/RouteSaveBox";
import RouteForecastCheck from "../components/RouteForecastCheck";
import { checkRouteAgainstForecast, regionForRoute } from "../utils/routeForecast";
import { useRouteDraft } from "../hooks/useRouteDraft";
import { fetchRoute } from "../services/routeService";
import { ElevationSampler } from "../utils/elevation";
import { analyseRoute, routeToGpx, type RouteAnalysis } from "../utils/routePlan";

const TOUR_ICON = L.divIcon({
  className: "tour-pin",
  html: "<span></span>",
  iconSize: [16, 16],
  iconAnchor: [8, 8],
  popupAnchor: [0, -8],
});

const OBSERVATION_ICON = L.divIcon({
  className: "observation-pin",
  html: "<span></span>",
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  popupAnchor: [0, -9],
});

const SLOPE_LEGEND: Array<[string, string]> = [
  ["< 28°", "#325a82"],
  ["30–35°", "#ffeb3b"],
  ["35–40°", "#ff9800"],
  ["40–45°", "#f44336"],
  ["> 45°", "#8c145a"],
];

// Roughly centers and frames the Swedish fjällen (Kebnekaise in the north to
// Härjedalen in the south) without needing a tile provider account.
const SWEDEN_FJALL_CENTER: [number, number] = [65.6, 15.2];
const DEFAULT_ZOOM = 5;

function dangerIcon(dangerLevel: number | null | undefined): L.DivIcon {
  const color = dangerLevel ? getDangerInfo(dangerLevel).color : "#5c6b7a";
  const isDark = !!dangerLevel && dangerLevel >= 5;
  return L.divIcon({
    className: "region-marker",
    html: `<span style="background:${color}; color:${isDark ? "#fff" : "#1a1a1a"}">${
      dangerLevel ?? "?"
    }</span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15],
  });
}

/** Leaflet only measures its box once; tell it when full screen changes the size. */
function FitToContainer({ fullscreen }: { fullscreen: boolean }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
  }, [map, fullscreen]);
  return null;
}

function downloadGpx(analysis: RouteAnalysis, title: string) {
  const date = new Date().toISOString().slice(0, 10);
  const name = title.trim() || `Fjällkoll-rutt ${date}`;
  const file = `${name.replace(/[^\p{L}\p{N} _-]+/gu, "").trim().replace(/\s+/g, "-") || "fjallkoll-rutt"}.gpx`;
  void saveTextFile(file, routeToGpx(name, analysis.samples), "application/gpx+xml");
}

const LAYERS_OPEN_KEY = "fjallkoll:map-layers-open";

/** Whether the layer menu was left open last time (open on first visit). */
function readLayersOpen(): boolean {
  try {
    return localStorage.getItem(LAYERS_OPEN_KEY) !== "0";
  } catch {
    return true;
  }
}

function saveLayersOpen(open: boolean) {
  try {
    localStorage.setItem(LAYERS_OPEN_KEY, open ? "1" : "0");
  } catch {
    // Not remembered, e.g. in a private window; the menu still works.
  }
}

export default function MapPage() {
  const [forecasts, setForecasts] = useState<Record<string, AvalancheForecast>>({});
  const [showSlope, setShowSlope] = useState(false);
  const [showObservations, setShowObservations] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const { token, loading: authLoading } = useAuth();
  const [showTours, setShowTours] = useState(false);
  const [tours, setTours] = useState<Tour[]>([]);
  const [showHeatmap, setShowHeatmap] = useState(searchParams.get("turer") === "varmekarta");
  const [heatSeasons, setHeatSeasons] = useState<string[]>([]);
  const [heatLines, setHeatLines] = useState<TourLine[]>([]);

  useEffect(() => {
    if (!showHeatmap) return;
    let cancelled = false;
    fetchTourLines({ months: seasonMonths(heatSeasons) })
      .then((lines) => !cancelled && setHeatLines(lines))
      .catch(() => !cancelled && setHeatLines([]));
    return () => {
      cancelled = true;
    };
  }, [showHeatmap, heatSeasons]);

  useEffect(() => {
    if (!showTours) return;
    fetchTours({ limit: 200, token })
      .then(setTours)
      .catch(() => setTours([]));
  }, [showTours, token]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [showPosition, setShowPosition] = useState(false);
  const [layersOpen, setLayersOpen] = useState(readLayersOpen);
  const toggleLayers = () =>
    setLayersOpen((open) => {
      saveLayersOpen(!open);
      return !open;
    });
  const [fullscreen, setFullscreen] = useState(false);
  const [planning, setPlanning] = useState(false);
  const route = useRouteDraft();
  const waypoints = route.draft.points;
  const [routeError, setRouteError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<RouteAnalysis | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const sampler = useRef<ElevationSampler | null>(null);

  const changeRoute = route.setPoints;

  // Today's forecast for the area the route lies in, and where they meet.
  const routeRegionId = useMemo(() => (analysis ? regionForRoute(analysis.samples, REGIONS) : null), [analysis]);
  const routeForecast = routeRegionId ? (forecasts[routeRegionId] ?? null) : null;
  const forecastCheck = useMemo(
    () =>
      analysis && routeForecast?.status === "published" ? checkRouteAgainstForecast(analysis.samples, routeForecast) : null,
    [analysis, routeForecast]
  );

  // A link to a saved route (/karta?rutt=12) opens it in the planner.
  const openRouteId = Number(searchParams.get("rutt")) || null;
  const openRoute = route.open;
  useEffect(() => {
    if (!openRouteId || authLoading) return;
    let cancelled = false;
    fetchRoute(openRouteId, token)
      .then((r) => {
        if (cancelled) return;
        openRoute(r);
        setRouteError(null);
        setPlanning(true);
      })
      .catch((err: Error) => !cancelled && setRouteError(err.message))
      .finally(() => {
        if (cancelled) return;
        setSearchParams(
          (params) => {
            params.delete("rutt");
            return params;
          },
          { replace: true }
        );
      });
    return () => {
      cancelled = true;
    };
  }, [openRouteId, authLoading, token, openRoute, setSearchParams]);

  useEffect(() => {
    if (waypoints.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setAnalysing(true);
      sampler.current ??= new ElevationSampler();
      analyseRoute(waypoints, sampler.current)
        .then((result) => !cancelled && setAnalysis(result))
        .catch(() => !cancelled && setAnalysis(null))
        .finally(() => !cancelled && setAnalysing(false));
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      setAnalysis(null);
      setHoverIndex(null);
    };
  }, [waypoints]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFullscreen(false);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [fullscreen]);
  const activeLayers = [showObservations, showTours, showHeatmap, showSlope].filter(Boolean).length;
  const [positionStatus, setPositionStatus] = useState<string | null>(null);
  const onPositionStatus = useCallback((message: string | null) => setPositionStatus(message), []);

  useEffect(() => {
    if (!showObservations) return;
    fetchObservations({ limit: 200 })
      .then(setObservations)
      .catch(() => setObservations([]));
  }, [showObservations]);

  useEffect(() => {
    loadForecasts().then((result) => setForecasts(result.byId));
  }, []);

  return (
    <div className={["page page--map", fullscreen && "page--map-full", planning && "page--planning"].filter(Boolean).join(" ")}>
      {!fullscreen && (
        <header className="page__header">
          <h1>Karta</h1>
          <p className="page__lead">
            Lavinprognosområdenas ungefärliga läge, färgkodade efter farograd.
          </p>
        </header>
      )}

      <div className="map-controls">
        <div className="map-toolbar">
          <button
            type="button"
            className={showPosition ? "button map-toolbar__locate map-toolbar__locate--on" : "button map-toolbar__locate"}
            aria-pressed={showPosition}
            aria-label={showPosition ? "Dölj min position" : "Visa min position"}
            onClick={() => {
              setShowPosition((on) => !on);
              setPositionStatus(null);
            }}
          >
            <span className="my-position__legend" aria-hidden="true" />
            <span className="map-toolbar__label">{showPosition ? "Dölj min position" : "Visa min position"}</span>
          </button>
          <button
            type="button"
            className="button map-toolbar__layers"
            aria-expanded={layersOpen}
            aria-controls="map-layers"
            onClick={toggleLayers}
          >
            Kartlager{activeLayers > 0 && ` (${activeLayers} på)`}
            <span className={layersOpen ? "map-toolbar__chevron map-toolbar__chevron--open" : "map-toolbar__chevron"} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={planning ? "button map-toolbar__plan map-toolbar__plan--on" : "button map-toolbar__plan"}
            aria-pressed={planning}
            aria-label="Planera rutt"
            onClick={() => setPlanning((on) => !on)}
          >
            <span className="route-icon" aria-hidden="true" />
            <span className="map-toolbar__label">Planera rutt</span>
          </button>
          <button
            type="button"
            className="button map-toolbar__fullscreen"
            aria-pressed={fullscreen}
            aria-label={fullscreen ? "Stäng helskärm" : "Helskärm"}
            onClick={() => setFullscreen((on) => !on)}
          >
            <span className={fullscreen ? "fullscreen-icon fullscreen-icon--exit" : "fullscreen-icon"} aria-hidden="true" />
            <span className="map-toolbar__label">{fullscreen ? "Stäng helskärm" : "Helskärm"}</span>
          </button>
        </div>

        <div id="map-layers" className="map-toolbar map-layers" hidden={!layersOpen}>
          <label className="map-toolbar__toggle">
            <input
              type="checkbox"
              checked={showObservations}
              onChange={(e) => setShowObservations(e.target.checked)}
            />
            <span className="observation-pin observation-pin--legend"><span /></span>
            Observationer
          </label>
          <label className="map-toolbar__toggle">
            <input type="checkbox" checked={showTours} onChange={(e) => setShowTours(e.target.checked)} />
            <span className="tour-pin tour-pin--legend">
              <span />
            </span>
            Turer
          </label>
          <label className="map-toolbar__toggle">
            <input type="checkbox" checked={showHeatmap} onChange={(e) => setShowHeatmap(e.target.checked)} />
            <span className="heat-legend" aria-hidden="true" />
            Värmekarta över turer
          </label>
          {showHeatmap && <SeasonFilter selected={heatSeasons} onChange={setHeatSeasons} />}
          <label className="map-toolbar__toggle">
            <input
              type="checkbox"
              checked={showSlope}
              onChange={(e) => setShowSlope(e.target.checked)}
            />
            Terränglutning (zooma in för att se den)
          </label>
          {showSlope && (
            <div className="slope-legend">
              {SLOPE_LEGEND.map(([label, color]) => (
                <span key={label} className="slope-legend__item">
                  <span className="slope-legend__swatch" style={{ backgroundColor: color }} />
                  {label}
                </span>
              ))}
            </div>
          )}
          {showHeatmap && (
            <p className="notice map-layers__note">
              Värmekartan visar turer som användare delat. Färgen och tjockleken visar hur många olika turer som gått
              samma väg – tryck på en linje för att se vilka. Början och slutet av
              turerna är dolda. Den säger inget om förhållandena i dag – kolla alltid lavinprognosen.
              {heatLines.length === 0 && " Inga delade turer för det valda urvalet än."}
            </p>
          )}
        </div>

        {routeError && (
          <p className="notice notice--danger" role="alert">
            {routeError}
          </p>
        )}

        {positionStatus && (
          <p className="notice" role="status">
            {positionStatus}
          </p>
        )}

        {showSlope && (
          <p className="notice notice--stale">
            Terränglutningen är beräknad från öppen höjddata med ~30 m upplösning
            (SRTM/NASADEM) och är en grov approximation — inte tillräckligt exakt
            för att ensam avgöra om en specifik sluttning är säker.
          </p>
        )}
      </div>

      <div className="map-container">
        <MapContainer center={SWEDEN_FJALL_CENTER} zoom={DEFAULT_ZOOM} scrollWheelZoom>
          <FitToContainer fullscreen={fullscreen} />
          {planning && (
            <RoutePlanner
              waypoints={waypoints}
              onChange={changeRoute}
              samples={analysis?.samples ?? null}
              hovered={hoverIndex !== null ? (analysis?.samples[hoverIndex] ?? null) : null}
              flagged={forecastCheck?.flagged ?? null}
            />
          )}
          <TopoLayer />
          <SlopeLayer enabled={showSlope} />
          <MyPosition enabled={showPosition} onStatus={onPositionStatus} />
          {showHeatmap && <TourHeatmap lines={heatLines} />}
          {showObservations &&
            observations.map((o) => (
              <Marker key={`obs-${o.id}`} position={[o.lat, o.lon]} icon={OBSERVATION_ICON} zIndexOffset={1000}>
                <Popup>
                  <strong>{observationTypeLabel(o.type)}</strong>
                  <br />
                  {new Date(o.observedAt).toLocaleString("sv-SE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}{" "}
                  · {o.author}
                  <br />
                  {o.description.length > 140 ? `${o.description.slice(0, 140)}…` : o.description}
                  <br />
                  <Link to="/observationer">Alla observationer →</Link>
                </Popup>
              </Marker>
            ))}
          {showTours &&
            tours
              .filter((t) => t.pin)
              .map((t) => (
                <Marker key={`tour-${t.id}`} position={t.pin!} icon={TOUR_ICON} zIndexOffset={900}>
                  <Popup>
                    <strong>{t.title}</strong>
                    <br />
                    {new Date(t.startedAt).toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" })}{" "}
                    · {formatDistance(t.distanceM)} · ↑ {t.ascentM} m
                    <br />
                    <Link to={`/turer/${t.id}`}>Visa turen →</Link>
                  </Popup>
                </Marker>
              ))}
          {REGIONS.map((region) => (
            <Marker
              key={region.id}
              position={[region.lat, region.lon]}
              icon={dangerIcon(forecasts[region.id]?.dangerLevel)}
            >
              <Popup>
                <strong>{region.name}</strong>
                <br />
                {region.subAreas.join(" · ")}
                {forecasts[region.id] && (
                  <>
                    <br />
                    {forecastLabel(forecasts[region.id])}
                  </>
                )}
                <br />
                <Link to={`/omrade/${region.id}`}>Visa detaljer →</Link>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
        {showHeatmap && heatLines.length > 0 && <HeatLegend />}
      </div>

      {planning && (
        <RoutePanel
          pointCount={waypoints.length}
          analysis={waypoints.length >= 2 ? analysis : null}
          loading={analysing}
          hoverIndex={hoverIndex}
          onHover={setHoverIndex}
          onUndo={() => changeRoute(waypoints.slice(0, -1))}
          onClear={() => changeRoute([])}
          onExport={() => analysis && downloadGpx(analysis, route.draft.title)}
          onClose={() => setPlanning(false)}
          flagged={forecastCheck?.flagged ?? null}
        >
          <RouteForecastCheck
            regionName={routeRegionId ? (REGIONS.find((r) => r.id === routeRegionId)?.name ?? null) : null}
            forecast={routeForecast}
            check={forecastCheck}
          />
          <RouteSaveBox
            draft={route.draft}
            dirty={route.dirty}
            analysis={analysis}
            onTitle={route.setTitle}
            onSaved={route.markSaved}
            onNew={route.startNew}
          />
        </RoutePanel>
      )}
    </div>
  );
}
