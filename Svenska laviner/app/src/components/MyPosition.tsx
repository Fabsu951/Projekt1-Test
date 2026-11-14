import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Circle, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { Geolocation } from "@capacitor/geolocation";
import { formatDecimal, formatSweref } from "../utils/coordinates";
import { smoothHeading, watchHeading } from "../utils/compass";
import { t, locale } from "../i18n";

interface Fix {
  lat: number;
  lon: number;
  /** Metres, 95 % radius as the device reports it. */
  accuracy: number;
  /** Direction of travel from the GPS, only while moving. */
  course: number | null;
}

/** Close enough to read the slope shading when we first jump to the user. */
const FOCUS_ZOOM = 13;
/** Beyond this the fix is too vague for a circle to mean anything on a slope map. */
const MAX_ACCURACY_CIRCLE_M = 2000;
/** A compass reading older than this no longer counts (sensor stopped, e.g. no magnetometer). */
const COMPASS_FRESH_MS = 3000;
/** Slower than this (m/s) the GPS course is noise. */
const MIN_COURSE_SPEED = 1;

export interface PositionFix {
  lat: number;
  lon: number;
  accuracy: number;
}

interface Props {
  enabled: boolean;
  onStatus: (message: string | null) => void;
  /** Each new fix (null when turned off), for the coordinate box over the map. */
  onFix?: (fix: PositionFix | null) => void;
}

// The blue dot with a cone for the way the phone points; the cone turns by
// CSS on the marker's own element, so ~60 compass readings a second never
// re-render React.
const ICON = L.divIcon({
  className: "my-pos",
  html:
    '<svg class="my-pos__cone" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="my-pos-fade" x1="0" y1="1" x2="0" y2="0"><stop offset="0.45" stop-color="#2f8cff" stop-opacity="0.55"/><stop offset="1" stop-color="#2f8cff" stop-opacity="0"/></linearGradient></defs><path d="M32 32 L17 6 A30 30 0 0 1 47 6 Z" fill="url(#my-pos-fade)"/></svg>' +
    '<span class="my-pos__dot"></span>',
  iconSize: [64, 64],
  iconAnchor: [32, 32],
  popupAnchor: [0, -10],
});

/**
 * Follows the device's position while enabled: a dot, an accuracy circle and
 * a cone for the direction the phone points (compass, or the GPS course
 * while moving). Tapping the dot shows the coordinates. The map jumps to the
 * first fix only, so the user can pan freely after that.
 */
export default function MyPosition({ enabled, onStatus, onFix }: Props) {
  const map = useMap();
  const [fix, setFix] = useState<Fix | null>(null);
  const centered = useRef(false);
  const markerRef = useRef<L.Marker | null>(null);
  const compass = useRef<{ heading: number | null; at: number }>({ heading: null, at: 0 });
  const course = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let watchId: string | null = null;
    let cancelled = false;
    onStatus(t("Hämtar din position…"));

    Geolocation.watchPosition({ enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 }, (pos, err) => {
      if (cancelled) return;
      if (err || !pos) {
        onStatus(t("Kunde inte hämta din position. Kontrollera att platstjänster är påslagna och tillåtna för Snöläge."));
        return;
      }
      const { heading, speed } = pos.coords;
      const moving = typeof speed === "number" && speed >= MIN_COURSE_SPEED && typeof heading === "number" && Number.isFinite(heading);
      const next = { lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy, course: moving ? heading : null };
      setFix(next);
      onFix?.({ lat: next.lat, lon: next.lon, accuracy: next.accuracy });
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
        if (!cancelled) onStatus(t("Platstjänster är inte tillgängliga på den här enheten."));
      });

    return () => {
      cancelled = true;
      if (watchId) void Geolocation.clearWatch({ id: watchId });
      // Next time, start fresh: no old dot, and jump to the new first fix.
      setFix(null);
      onFix?.(null);
      centered.current = false;
    };
  }, [enabled, map, onStatus, onFix]);

  // Turns the cone to the freshest direction we have, or hides it.
  const paint = useMemo(
    () => () => {
      const cone = markerRef.current?.getElement()?.querySelector<SVGElement>(".my-pos__cone");
      if (!cone) return;
      const fresh = compass.current.heading !== null && Date.now() - compass.current.at < COMPASS_FRESH_MS;
      const heading = fresh ? compass.current.heading : course.current;
      if (heading === null) {
        cone.style.display = "none";
        return;
      }
      cone.style.display = "block";
      cone.style.transform = `rotate(${heading.toFixed(1)}deg)`;
    },
    [],
  );

  useEffect(() => {
    if (!enabled) return;
    let frame = 0;
    const stop = watchHeading((heading) => {
      compass.current = { heading: smoothHeading(compass.current.heading, heading), at: Date.now() };
      if (!frame) {
        frame = requestAnimationFrame(() => {
          frame = 0;
          paint();
        });
      }
    });
    // Falls back to the GPS course when the compass goes quiet.
    const timer = window.setInterval(paint, COMPASS_FRESH_MS);
    return () => {
      stop();
      window.clearInterval(timer);
      if (frame) cancelAnimationFrame(frame);
      compass.current = { heading: null, at: 0 };
    };
  }, [enabled, paint]);

  useEffect(() => {
    course.current = fix?.course ?? null;
    paint();
  }, [fix, paint]);

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
      <Marker
        ref={markerRef}
        position={[fix.lat, fix.lon]}
        icon={ICON}
        title={t("Din position")}
        alt={t("Din position")}
        eventHandlers={{ add: paint }}
      >
        <Popup>
          <div className="my-pos-popup">
            <strong>{t("Din position")}</strong>
            <span>{formatDecimal(fix.lat, fix.lon)}</span>
            <span>
              {t("SWEREF 99 TM")} {formatSweref(fix.lat, fix.lon)}
            </span>
            <span className="muted">{t("Noggrannhet ±{m} m", { m: Math.round(fix.accuracy).toLocaleString(locale()) })}</span>
            <Link to="/var-ar-jag">{t("Visa stort och ring 112")}</Link>
          </div>
        </Popup>
      </Marker>
    </>
  );
}
