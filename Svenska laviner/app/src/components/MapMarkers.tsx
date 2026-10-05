import { memo } from "react";
import { Link } from "react-router-dom";
import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { REGIONS } from "../data/regions";
import { getDangerInfo } from "../data/dangerScale";
import { observationTypeLabel } from "../data/observationTypes";
import type { AvalancheForecast } from "../types/avalanche";
import type { Observation } from "../types/observation";
import type { Tour } from "../types/tour";
import { forecastLabel } from "../utils/forecastLabel";
import { formatDistance } from "../utils/tourFormat";
import AdminBadge from "./AdminBadge";

// The map's pins, kept apart from the map page and memoised: the page
// re-renders on every pan (the visible area feeds "spara det som syns") and
// while hovering the route profile, and re-creating hundreds of markers and
// icons each time made panning stutter.

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

const dangerIcons = new Map<string, L.DivIcon>();

/** One shared icon per danger level, so markers only change when the level does. */
function dangerIcon(dangerLevel: number | null | undefined): L.DivIcon {
  const key = String(dangerLevel ?? "none");
  let icon = dangerIcons.get(key);
  if (!icon) {
    const color = dangerLevel ? getDangerInfo(dangerLevel).color : "#5c6b7a";
    const isDark = !!dangerLevel && dangerLevel >= 5;
    icon = L.divIcon({
      className: "region-marker",
      html: `<span style="background:${color}; color:${isDark ? "#fff" : "#1a1a1a"}">${dangerLevel ?? "?"}</span>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -15],
    });
    dangerIcons.set(key, icon);
  }
  return icon;
}

const REGION_POSITIONS = Object.fromEntries(REGIONS.map((r) => [r.id, [r.lat, r.lon] as [number, number]]));

export const RegionMarkers = memo(function RegionMarkers({ forecasts }: { forecasts: Record<string, AvalancheForecast> }) {
  return (
    <>
      {REGIONS.map((region) => (
        <Marker key={region.id} position={REGION_POSITIONS[region.id]} icon={dangerIcon(forecasts[region.id]?.dangerLevel)}>
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
    </>
  );
});

const ObservationMarker = memo(function ObservationMarker({ o }: { o: Observation }) {
  return (
    <Marker position={[o.lat, o.lon]} icon={OBSERVATION_ICON} zIndexOffset={1000}>
      <Popup>
        <strong>{observationTypeLabel(o.type)}</strong>
        <br />
        {new Date(o.observedAt).toLocaleString("sv-SE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} ·{" "}
        {o.author}
        <AdminBadge show={o.authorIsAdmin} />
        <br />
        {o.description.length > 140 ? `${o.description.slice(0, 140)}…` : o.description}
        <br />
        <Link to="/observationer">Alla observationer →</Link>
      </Popup>
    </Marker>
  );
});

export const ObservationMarkers = memo(function ObservationMarkers({ observations }: { observations: Observation[] }) {
  return (
    <>
      {observations.map((o) => (
        <ObservationMarker key={o.id} o={o} />
      ))}
    </>
  );
});

const TourMarker = memo(function TourMarker({ t }: { t: Tour }) {
  return (
    <Marker position={t.pin!} icon={TOUR_ICON} zIndexOffset={900}>
      <Popup>
        <strong>{t.title}</strong>
        <br />
        {new Date(t.startedAt).toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" })} ·{" "}
        {formatDistance(t.distanceM)} · ↑ {t.ascentM} m
        <br />
        <Link to={`/turer/${t.id}`}>Visa turen →</Link>
      </Popup>
    </Marker>
  );
});

export const TourMarkers = memo(function TourMarkers({ tours }: { tours: Tour[] }) {
  return (
    <>
      {tours
        .filter((t) => t.pin)
        .map((t) => (
          <TourMarker key={t.id} t={t} />
        ))}
    </>
  );
});
