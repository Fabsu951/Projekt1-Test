import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MapContainer, Marker, Popup } from "react-leaflet";
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
import { fetchTours } from "../services/tourService";
import type { Tour } from "../types/tour";
import { formatDistance } from "../utils/tourFormat";

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

export default function MapPage() {
  const [forecasts, setForecasts] = useState<Record<string, AvalancheForecast>>({});
  const [showSlope, setShowSlope] = useState(false);
  const [showObservations, setShowObservations] = useState(true);
  const [showTours, setShowTours] = useState(false);
  const [tours, setTours] = useState<Tour[]>([]);

  useEffect(() => {
    if (!showTours) return;
    fetchTours({ limit: 200 })
      .then(setTours)
      .catch(() => setTours([]));
  }, [showTours]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [showPosition, setShowPosition] = useState(false);
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
    <div className="page page--map">
      <header className="page__header">
        <h1>Karta</h1>
        <p className="page__lead">
          Lavinprognosområdenas ungefärliga läge, färgkodade efter farograd.
        </p>
      </header>

      <div className="map-toolbar">
        <button
          type="button"
          className={showPosition ? "button map-toolbar__locate map-toolbar__locate--on" : "button map-toolbar__locate"}
          aria-pressed={showPosition}
          onClick={() => {
            setShowPosition((on) => !on);
            setPositionStatus(null);
          }}
        >
          <span className="my-position__legend" aria-hidden="true" />
          {showPosition ? "Dölj min position" : "Visa min position"}
        </button>
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
      </div>

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

      <div className="map-container">
        <MapContainer center={SWEDEN_FJALL_CENTER} zoom={DEFAULT_ZOOM} scrollWheelZoom>
          <TopoLayer />
          <SlopeLayer enabled={showSlope} />
          <MyPosition enabled={showPosition} onStatus={onPositionStatus} />
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
      </div>
    </div>
  );
}
