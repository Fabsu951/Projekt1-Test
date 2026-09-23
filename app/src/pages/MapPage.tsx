import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { REGIONS } from "../data/regions";
import { fetchAllForecasts } from "../services/avalancheService";
import { withCache } from "../services/cache";
import { getDangerInfo } from "../data/dangerScale";
import type { AvalancheForecast } from "../types/avalanche";

// Roughly centers and frames the Swedish fjällen (Kebnekaise in the north to
// Härjedalen in the south) without needing a tile provider account.
const SWEDEN_FJALL_CENTER: [number, number] = [65.6, 15.2];
const DEFAULT_ZOOM = 5;

function dangerIcon(dangerLevel: number | undefined): L.DivIcon {
  const color = dangerLevel ? getDangerInfo(dangerLevel).color : "#5c6b7a";
  const isDark = dangerLevel !== undefined && dangerLevel >= 5;
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

  useEffect(() => {
    withCache("forecasts:all", fetchAllForecasts).then((result) => {
      const byId: Record<string, AvalancheForecast> = {};
      for (const f of result.data) byId[f.regionId] = f;
      setForecasts(byId);
    });
  }, []);

  return (
    <div className="page page--map">
      <header className="page__header">
        <h1>Karta</h1>
        <p className="page__lead">
          Lavinprognosområdenas ungefärliga läge, färgkodade efter farograd.
        </p>
      </header>

      <div className="map-container">
        <MapContainer center={SWEDEN_FJALL_CENTER} zoom={DEFAULT_ZOOM} scrollWheelZoom>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-bidragsgivare'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
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
                    {getDangerInfo(forecasts[region.id].dangerLevel).label}
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
