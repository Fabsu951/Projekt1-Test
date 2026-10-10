import { useEffect, useState } from "react";
import { loadSnowDepth, type SnowStation } from "../services/snowDepthService";

function measured(iso: string): string {
  return new Date(iso).toLocaleString("sv-SE", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function change(cm: number | null): string | null {
  if (cm === null) return null;
  if (cm === 0) return "oförändrat på 3 dygn";
  return `${cm > 0 ? "+" : "−"}${Math.abs(cm)} cm på 3 dygn`;
}

interface Props {
  regionId: string;
  lat: number;
  lon: number;
}

/**
 * "Snödjup": measured depth at SMHI's nearest stations. Hidden when no
 * station within reach has a fresh value (or SMHI can't be reached).
 */
export default function SnowDepthCard({ regionId, lat, lon }: Props) {
  const [stations, setStations] = useState<SnowStation[] | null>(null);

  useEffect(() => {
    let live = true;
    loadSnowDepth(regionId, lat, lon)
      .then((list) => live && setStations(list))
      .catch(() => live && setStations([]));
    return () => {
      live = false;
    };
  }, [regionId, lat, lon]);

  if (!stations || stations.length === 0) return null;

  return (
    <section className="section">
      <h2>Snödjup</h2>
      <ul className="snow-depth">
        {stations.map((s) => (
          <li key={s.id} className="snow-depth__station">
            <span className="snow-depth__value">{s.depthCm === 0 ? "Barmark" : `${s.depthCm} cm`}</span>
            <span className="snow-depth__info">
              <strong>{s.name}</strong>
              <span className="muted">
                {[s.heightM !== null ? `${s.heightM} m ö.h.` : null, `${Math.round(s.distanceKm)} km bort`, change(s.changeCm)]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              <span className="muted">Mätt {measured(s.measuredAt)}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="muted snow-depth__note">
        Uppmätt av SMHI en gång om dygnet, oftast i dalgång eller by. Snödjupet på fjället kan vara helt annat, och
        vinden flyttar snön. Källa: SMHI:s öppna data.
      </p>
    </section>
  );
}
