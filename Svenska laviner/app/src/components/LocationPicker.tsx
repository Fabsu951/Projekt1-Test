import { useEffect, useState } from "react";
import { MapContainer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Geolocation } from "@capacitor/geolocation";
import TopoLayer from "./TopoLayer";
import { t } from "../i18n";

const PIN = L.divIcon({ className: "observation-pin", html: "<span></span>", iconSize: [22, 22], iconAnchor: [11, 11] });

export interface Point {
  lat: number;
  lon: number;
}

function ClickToPlace({ onPick }: { onPick: (p: Point) => void }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lon: e.latlng.lng });
    },
  });
  return null;
}

/** Pans/zooms the map whenever `point` changes (used after a GPS fix). */
function FocusOn({ point }: { point: Point | null }) {
  const map = useMap();
  useEffect(() => {
    if (point) map.setView([point.lat, point.lon], 13);
  }, [map, point]);
  return null;
}

interface Props {
  value: Point | null;
  onChange: (p: Point) => void;
}

export default function LocationPicker({ value, onChange }: Props) {
  const [status, setStatus] = useState<string | null>(null);
  const [focus, setFocus] = useState<Point | null>(null);

  async function locateMe() {
    setStatus(t("Hämtar position…"));
    try {
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 });
      const p = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      onChange(p);
      setFocus(p);
      setStatus(null);
    } catch {
      setStatus(t("Kunde inte hämta din position. Klicka på kartan i stället."));
    }
  }

  return (
    <div className="location-picker">
      <div className="location-picker__map">
        <MapContainer center={[65.6, 15.2]} zoom={5} scrollWheelZoom>
          <TopoLayer />
          <ClickToPlace onPick={onChange} />
          <FocusOn point={focus} />
          {value && <Marker position={[value.lat, value.lon]} icon={PIN} />}
        </MapContainer>
      </div>
      <div className="location-picker__bar">
        <button type="button" className="button" onClick={() => void locateMe()}>
          {t("📍 Använd min position")}
        </button>
        <span className="form__hint">
          {status ??
            (value ? `${value.lat.toFixed(4)}, ${value.lon.toFixed(4)}` : t("Klicka på kartan där du gjorde observationen."))}
        </span>
      </div>
    </div>
  );
}
