import { useEffect, useRef, useState } from "react";
import { Circle, CircleMarker } from "react-leaflet";
import { useMap } from "react-leaflet";
import { Geolocation } from "@capacitor/geolocation";

interface Fix {
  lat: number;
  lon: number;
  /** Metres, 95 % radius as the device reports it. */
  accuracy: number;
}

/** Close enough to read the slope shading when we first jump to the user. */
const FOCUS_ZOOM = 13;
/** Beyond this the fix is too vague for a circle to mean anything on a slope map. */
const MAX_ACCURACY_CIRCLE_M = 2000;

interface Props {
  enabled: boolean;
  onStatus: (message: string | null) => void;
}

/**
 * Follows the device's position while enabled: a dot plus an accuracy circle.
 * The map jumps to the first fix only, so the user can pan freely after that.
 */
export default function MyPosition({ enabled, onStatus }: Props) {
  const map = useMap();
  const [fix, setFix] = useState<Fix | null>(null);
  const centered = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    let watchId: string | null = null;
    let cancelled = false;
    onStatus("Hämtar din position…");

    Geolocation.watchPosition({ enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 }, (pos, err) => {
      if (cancelled) return;
      if (err || !pos) {
        onStatus("Kunde inte hämta din position. Kontrollera att platstjänster är påslagna och tillåtna för Fjällkoll.");
        return;
      }
      const next = { lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy };
      setFix(next);
      onStatus(null);
      if (!centered.current) {
        centered.current = true;
        map.setView([next.lat, next.lon], Math.max(map.getZoom(), FOCUS_ZOOM));
      }
    })
      .then((id) => {
        if (cancelled) void Geolocation.clearWatch({ id });
        else watchId = id;
      })
      .catch(() => {
        if (!cancelled) onStatus("Platstjänster är inte tillgängliga på den här enheten.");
      });

    return () => {
      cancelled = true;
      if (watchId) void Geolocation.clearWatch({ id: watchId });
      // Next time, start fresh: no old dot, and jump to the new first fix.
      setFix(null);
      centered.current = false;
    };
  }, [enabled, map, onStatus]);

  if (!enabled || !fix) return null;
  return (
    <>
      {fix.accuracy <= MAX_ACCURACY_CIRCLE_M && (
        <Circle
          center={[fix.lat, fix.lon]}
          radius={fix.accuracy}
          interactive={false}
          pathOptions={{ className: "my-position__accuracy" }}
        />
      )}
      <CircleMarker
        center={[fix.lat, fix.lon]}
        radius={8}
        interactive={false}
        pathOptions={{ className: "my-position__dot" }}
      />
    </>
  );
}
