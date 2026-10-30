import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { saveTextFile } from "../services/native";
import { MapContainer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { REGIONS } from "../data/regions";
import { loadForecasts } from "../services/avalancheService";
import type { AvalancheForecast } from "../types/avalanche";
import SlopeLayer from "../components/SlopeLayer";
import OfficialTerrainLayer from "../components/OfficialTerrainLayer";
import DetailedSlopeLayer from "../components/DetailedSlopeLayer";
import OfficialTerrainLegend from "../components/OfficialTerrainLegend";
import { detailedSlopeAvailable, officialTerrainAvailable, type OfficialTerrain } from "../services/mapTiles";
import TopoLayer from "../components/TopoLayer";
import MyPosition from "../components/MyPosition";
import FriendPositions from "../components/FriendPositions";
import { fetchObservations } from "../services/observationService";
import type { Observation } from "../types/observation";
import SeasonFilter from "../components/SeasonFilter";
import TourHeatmap, { HeatLegend } from "../components/TourHeatmap";
import { seasonMonths } from "../data/tourSeasons";
import { fetchTourLines, fetchTours } from "../services/tourService";
import type { Tour, TourLine } from "../types/tour";
import RoutePlanner from "../components/RoutePlanner";
import RoutePanel from "../components/RoutePanel";
import RouteSaveBox from "../components/RouteSaveBox";
import RouteOfflineBox, { OfflineRouteList } from "../components/RouteOfflineBox";
import OfflineViewBox from "../components/OfflineViewBox";
import { offlineAnalysisFor } from "../services/offlineRoutes";
import type { Bounds } from "../services/offlineMap";
import RouteForecastCheck from "../components/RouteForecastCheck";
import { checkRouteAgainstForecast, regionForRoute } from "../utils/routeForecast";
import { useRouteDraft } from "../hooks/useRouteDraft";
import { fetchRoute } from "../services/routeService";
import { ElevationSampler } from "../utils/elevation";
import { analyseRoute, routeToGpx, type RouteAnalysis } from "../utils/routePlan";
import { ObservationMarkers, RegionMarkers, TourMarkers } from "../components/MapMarkers";
import { t } from "../i18n";

const SLOPE_LEGEND: Array<[string, string]> = [
  ["30–35°", "#ffeb3b"],
  ["35–40°", "#ff9800"],
  ["40–45°", "#f44336"],
  ["> 45°", "#8c145a"],
];

// Roughly centers and frames the Swedish fjällen (Kebnekaise in the north to
// Härjedalen in the south) without needing a tile provider account.
const SWEDEN_FJALL_CENTER: [number, number] = [65.6, 15.2];
const DEFAULT_ZOOM = 5;

/** Reports what part of the map is on screen. */
function ViewTracker({ onChange }: { onChange: (b: Bounds) => void }) {
  const map = useMap();
  useEffect(() => {
    const report = () => {
      const b = map.getBounds();
      onChange({ north: b.getNorth(), south: b.getSouth(), west: b.getWest(), east: b.getEast() });
    };
    report();
    map.on("moveend", report);
    return () => {
      map.off("moveend", report);
    };
  }, [map, onChange]);
  return null;
}

/** Shows an area when asked (a saved offline map). */
function FlyTo({ target }: { target: Bounds | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.fitBounds(L.latLngBounds([target.south, target.west], [target.north, target.east]));
  }, [map, target]);
  return null;
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
  const name = title.trim() || t("Snöläge-rutt {date}", { date });
  const file = `${name.replace(/[^\p{L}\p{N} _-]+/gu, "").trim().replace(/\s+/g, "-") || "fjallkoll-rutt"}.gpx`;
  void saveTextFile(file, routeToGpx(name, analysis.samples), "application/gpx+xml");
}

const LAYERS_OPEN_KEY = "fjallkoll:map-layers-open";

/** Whether the layer menu was left open last time. On a first visit it
 * starts open on wide screens and closed on phones, where it would push
 * the map below the fold. */
function readLayersOpen(): boolean {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(LAYERS_OPEN_KEY);
  } catch {
    // Not available, e.g. in a private window.
  }
  if (saved !== null) return saved !== "0";
  return typeof window.matchMedia !== "function" || !window.matchMedia("(max-width: 640px)").matches;
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
  const [showDetailedSlope, setShowDetailedSlope] = useState(false);
  const [detailedSlope, setDetailedSlope] = useState(false);
  useEffect(() => {
    let live = true;
    void detailedSlopeAvailable().then((ok) => live && setDetailedSlope(ok));
    return () => {
      live = false;
    };
  }, []);
  const [officialTerrain, setOfficialTerrain] = useState<OfficialTerrain | null>(null);
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
  // People sharing their position with you ("Dela position"); a notification opens /karta?kompisar=1.
  const friendsFromLink = searchParams.get("kompisar") === "1";
  const [showFriends, setShowFriends] = useState(true);
  const [friendCount, setFriendCount] = useState<number | null>(null);
  const [layersOpen, setLayersOpen] = useState(readLayersOpen);
  const toggleLayers = () =>
    setLayersOpen((open) => {
      saveLayersOpen(!open);
      return !open;
    });
  const [fullscreen, setFullscreen] = useState(false);
  // "Planera rutt" on the start page links to /karta?planera=1.
  const [planning, setPlanning] = useState(searchParams.get("planera") === "1");
  const route = useRouteDraft();
  const waypoints = route.draft.points;
  const [routeError, setRouteError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<RouteAnalysis | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const sampler = useRef<ElevationSampler | null>(null);

  const changeRoute = route.setPoints;
  const [viewBounds, setViewBounds] = useState<Bounds | null>(null);
  const [flyTarget, setFlyTarget] = useState<Bounds | null>(null);
  const [frameKey, setFrameKey] = useState(0);
  const [offlineListKey, setOfflineListKey] = useState(0);

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
      // A route saved offline has its analysis stored: use it, so the
      // profile and numbers also work without coverage.
      offlineAnalysisFor(waypoints)
        .then((stored) => stored ?? analyseRoute(waypoints, sampler.current!))
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
  type Preset = "now" | "plan" | "tours";
  const planSlope: "detailed" | "official" | "own" = detailedSlope ? "detailed" : officialTerrainAvailable ? "official" : "own";
  const applyPreset = (preset: Preset) => {
    setShowObservations(preset !== "tours");
    setShowTours(preset === "tours");
    setShowHeatmap(preset === "tours");
    setShowSlope(preset === "plan" && planSlope === "own");
    setShowDetailedSlope(preset === "plan" && planSlope === "detailed");
    setOfficialTerrain(preset === "plan" && planSlope === "official" ? "lutning" : null);
    setPlanning(preset === "plan");
  };
  const slopeOn = showSlope || showDetailedSlope || officialTerrain === "lutning";
  const currentPreset: Preset | null =
    showObservations && !showTours && !showHeatmap && !slopeOn && officialTerrain === null && !planning
      ? "now"
      : showObservations && !showTours && !showHeatmap && slopeOn && planning
        ? "plan"
        : !showObservations && showTours && showHeatmap && !slopeOn && officialTerrain === null && !planning
          ? "tours"
          : null;
  const PRESETS: Array<[Preset, string, string]> = [
    ["now", t("Läget nu"), t("Prognoser och observationer")],
    ["plan", t("Planera tur"), t("Lutning och ruttplanering")],
    ["tours", t("Turer"), t("Var andra har åkt")],
  ];
  const friendsShown = Boolean(token) && showFriends;
  const activeLayers = [
    showObservations,
    showTours,
    showHeatmap,
    showSlope,
    showDetailedSlope,
    officialTerrain !== null,
    friendsShown && (friendCount ?? 0) > 0,
  ].filter(Boolean).length;
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
          <h1>{t("Karta")}</h1>
          <p className="page__lead">
            {t("Lavinprognosområdenas ungefärliga läge, färgkodade efter farograd.")}
          </p>
        </header>
      )}

      <div className="map-controls">
        {/* In full screen the map gets the room; the modes are a tap away outside it. */}
        {!fullscreen && (
          <div className="map-presets" role="group" aria-label={t("Kartläge")}>
            {PRESETS.map(([id, label, hint]) => (
              <button
                key={id}
                type="button"
                className="map-presets__button"
                aria-pressed={currentPreset === id}
                onClick={() => applyPreset(id)}
              >
                <span className="map-presets__label">{label}</span>
                <span className="map-presets__hint">{hint}</span>
              </button>
            ))}
          </div>
        )}
        <div className="map-toolbar">
          <button
            type="button"
            className={showPosition ? "button map-toolbar__locate map-toolbar__locate--on" : "button map-toolbar__locate"}
            aria-pressed={showPosition}
            aria-label={showPosition ? t("Dölj min position") : t("Visa min position")}
            onClick={() => {
              setShowPosition((on) => !on);
              setPositionStatus(null);
            }}
          >
            <span className="my-position__legend" aria-hidden="true" />
            <span className="map-toolbar__label">{showPosition ? t("Dölj min position") : t("Visa min position")}</span>
          </button>
          <button
            type="button"
            className="button map-toolbar__layers"
            aria-expanded={layersOpen}
            aria-controls="map-layers"
            onClick={toggleLayers}
          >
            {t("Kartlager")}{activeLayers > 0 && t(" ({n} på)", { n: activeLayers })}
            <span className={layersOpen ? "map-toolbar__chevron map-toolbar__chevron--open" : "map-toolbar__chevron"} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={planning ? "button map-toolbar__plan map-toolbar__plan--on" : "button map-toolbar__plan"}
            aria-pressed={planning}
            aria-label={t("Planera rutt")}
            onClick={() => setPlanning((on) => !on)}
          >
            <span className="route-icon" aria-hidden="true" />
            <span className="map-toolbar__label">{t("Planera rutt")}</span>
          </button>
          <button
            type="button"
            className="button map-toolbar__fullscreen"
            aria-pressed={fullscreen}
            aria-label={fullscreen ? t("Stäng helskärm") : t("Helskärm")}
            onClick={() => setFullscreen((on) => !on)}
          >
            <span className={fullscreen ? "fullscreen-icon fullscreen-icon--exit" : "fullscreen-icon"} aria-hidden="true" />
            <span className="map-toolbar__label">{fullscreen ? t("Stäng helskärm") : t("Helskärm")}</span>
          </button>
        </div>

        <div id="map-layers" className="map-toolbar map-layers" hidden={!layersOpen}>
          <div className="map-layers__group" role="group" aria-labelledby="layers-show">
            <p id="layers-show" className="map-layers__title">
              {t("Visa på kartan")}
            </p>
            <label className="map-toolbar__toggle">
              <input
                type="checkbox"
                checked={showObservations}
                onChange={(e) => setShowObservations(e.target.checked)}
              />
              <span className="observation-pin observation-pin--legend"><span /></span>
              {t("Observationer")}
            </label>
            {token && (
              <label className="map-toolbar__toggle">
                <input type="checkbox" checked={showFriends} onChange={(e) => setShowFriends(e.target.checked)} />
                <span className="friend-pin friend-pin--legend" aria-hidden="true" />
                {t("Kompisar som delar position")}
              </label>
            )}
            <label className="map-toolbar__toggle">
              <input type="checkbox" checked={showTours} onChange={(e) => setShowTours(e.target.checked)} />
              <span className="tour-pin tour-pin--legend">
                <span />
              </span>
              {t("Turer")}
            </label>
            <label className="map-toolbar__toggle">
              <input type="checkbox" checked={showHeatmap} onChange={(e) => setShowHeatmap(e.target.checked)} />
              <span className="heat-legend" aria-hidden="true" />
              {t("Värmekarta över turer")}
            </label>
            {showHeatmap && <SeasonFilter selected={heatSeasons} onChange={setHeatSeasons} />}
            {showHeatmap && (
              <p className="notice map-layers__note">
                {t("Värmekartan visar turer som användare delat. Färgen och tjockleken visar hur många olika turer som gått samma väg – tryck på en linje för att se vilka. Början och slutet av turerna är dolda. Den säger inget om förhållandena i dag – kolla alltid lavinprognosen.")}
                {heatLines.length === 0 && t(" Inga delade turer för det valda urvalet än.")}
              </p>
            )}
          </div>
          <div className="map-layers__group" role="group" aria-labelledby="layers-terrain">
            <p id="layers-terrain" className="map-layers__title">
              {t("Terräng")}
            </p>
            <label className="map-toolbar__toggle">
              <input
                type="checkbox"
                checked={showSlope}
                onChange={(e) => setShowSlope(e.target.checked)}
              />
              <span>
                {t("Lutning, egen beräkning")}{" "}<span className="map-layers__sub">{t("(Sverige och Norge, zooma in)")}</span>
              </span>
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
            {detailedSlope && (
              <>
                <label className="map-toolbar__toggle">
                  <input
                    type="checkbox"
                    checked={showDetailedSlope}
                    onChange={(e) => setShowDetailedSlope(e.target.checked)}
                  />
                  <span>
                    {t("Lutning, detaljerad")}{" "}<span className="map-layers__sub">{t("(Lantmäteriets höjddata, zooma in)")}</span>
                  </span>
                </label>
                {showDetailedSlope && (
                  <div className="slope-legend">
                    {SLOPE_LEGEND.map(([label, color]) => (
                      <span key={label} className="slope-legend__item">
                        <span className="slope-legend__swatch" style={{ backgroundColor: color }} />
                        {label}
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
            {officialTerrainAvailable && (
              <div className="official-terrain">
                <p className="official-terrain__title">{t("Officiella kartor")}</p>
                {(
                  [
                    ["lutning", t("Lutning (Naturvårdsverket, i Norge NVE)")],
                    ["riktning", t("Sluttningsriktning (Naturvårdsverket, bara Sverige)")],
                  ] as Array<[OfficialTerrain, string]>
                ).map(([id, label]) => (
                  <label key={id} className="map-toolbar__toggle">
                    <input
                      type="checkbox"
                      checked={officialTerrain === id}
                      onChange={(e) => setOfficialTerrain(e.target.checked ? id : null)}
                    />
                    {label}
                  </label>
                ))}
                {officialTerrain && <OfficialTerrainLegend layer={officialTerrain} />}
              </div>
            )}
          </div>
          <OfflineViewBox bounds={viewBounds} onShow={setFlyTarget} />
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

        {friendsFromLink && friendsShown && friendCount === 0 && (
          <p className="notice notice--stale" role="status">
            {t("Ingen delar sin position med dig just nu.")}
          </p>
        )}

        {officialTerrain && (
          <p className="notice">
            {officialTerrain === "lutning"
              ? t("Lutningskartan kommer från Naturvårdsverkets lavinprognostjänst och i Norge från NVE. Den visar terrängen, inte lavinfaran – läs alltid dagens prognos. Zooma in om lagret inte syns.")
              : t("Kartan över sluttningsriktning kommer från Naturvårdsverkets lavinprognostjänst och finns bara för Sverige. Den visar terrängen, inte lavinfaran – läs alltid dagens prognos. Zooma in om lagret inte syns.")}
          </p>
        )}

        {showDetailedSlope && (
          <p className="notice notice--stale">
            {t("Den detaljerade lutningen är beräknad från Lantmäteriets höjdmodell med 1 m upplösning, i steg om ett par meter. Under 30° visas ingenting. Den visar terrängen, inte lavinfaran, och snö och skavlar kan ändra den verkliga lutningen.")}
          </p>
        )}

        {showSlope && (
          <p className="notice notice--stale">
            {t("Lutningen är beräknad av Snöläge från höjdmodeller med 1 m upplösning (Lantmäteriet i Sverige, Kartverket i Norge). Under 30° visas ingenting. Den visar terrängen, inte lavinfaran, och snö och skavlar kan ändra den verkliga lutningen – läs alltid dagens prognos.")}
          </p>
        )}
      </div>

      <div className="map-container">
        <MapContainer center={SWEDEN_FJALL_CENTER} zoom={DEFAULT_ZOOM} scrollWheelZoom>
          <FitToContainer fullscreen={fullscreen} />
          <ViewTracker onChange={setViewBounds} />
          <FlyTo target={flyTarget} />
          {planning && (
            <RoutePlanner
              waypoints={waypoints}
              onChange={changeRoute}
              samples={analysis?.samples ?? null}
              hovered={hoverIndex !== null ? (analysis?.samples[hoverIndex] ?? null) : null}
              flagged={forecastCheck?.flagged ?? null}
              frameKey={frameKey}
            />
          )}
          <TopoLayer />
          <SlopeLayer enabled={showSlope} />
          <OfficialTerrainLayer layer={officialTerrain} />
          <DetailedSlopeLayer enabled={showDetailedSlope} />
          <MyPosition enabled={showPosition} onStatus={onPositionStatus} />
          {friendsShown && token && <FriendPositions token={token} fit={friendsFromLink} onCount={setFriendCount} />}
          {showHeatmap && <TourHeatmap lines={heatLines} />}
          {showObservations && <ObservationMarkers observations={observations} />}
          {showTours && <TourMarkers tours={tours} />}
          <RegionMarkers forecasts={forecasts} />
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
          footer={
            <OfflineRouteList
              refreshKey={offlineListKey}
              onOpen={(r) => {
                route.openOffline(r);
                setFrameKey((k) => k + 1);
              }}
            />
          }
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
          <RouteOfflineBox
            draft={route.draft}
            analysis={analysis}
            onSaved={() => setOfflineListKey((k) => k + 1)}
          />
        </RoutePanel>
      )}
    </div>
  );
}
