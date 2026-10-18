import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Circle, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { Link } from "react-router-dom";
import { fetchSharedWithMe, type FriendShare } from "../services/locationShare";
import { clockTime, sinceText } from "../utils/shareTime";
import { t } from "../i18n";

const POLL_MS = 60_000;
/** Beyond this the circle says nothing useful on a slope map. */
const MAX_ACCURACY_CIRCLE_M = 2000;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2)).toUpperCase();
}

function friendIcon(name: string): L.DivIcon {
  const span = document.createElement("span");
  span.className = "friend-pin";
  span.textContent = initials(name);
  return L.divIcon({ html: span.outerHTML, className: "friend-pin__wrap", iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -18] });
}

interface Props {
  token: string;
  /** Frame the people on the first answer (opened from a notification). */
  fit: boolean;
  onCount: (count: number) => void;
}

/** People sharing their position with you, as initials on the map; refreshed every minute while visible. */
export default function FriendPositions({ token, fit, onCount }: Props) {
  const map = useMap();
  const [people, setPeople] = useState<FriendShare[]>([]);
  const [now, setNow] = useState(() => new Date());
  const framed = useRef(false);

  useEffect(() => {
    let live = true;
    const load = () => {
      if (document.visibilityState === "hidden") return;
      fetchSharedWithMe(token)
        .then((list) => {
          if (!live) return;
          setPeople(list);
          setNow(new Date());
          onCount(list.length);
        })
        .catch(() => live && onCount(0));
    };
    load();
    const timer = window.setInterval(load, POLL_MS);
    document.addEventListener("visibilitychange", load);
    return () => {
      live = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
    };
  }, [token, onCount]);

  const placed = useMemo(() => people.filter((p) => p.position), [people]);

  useEffect(() => {
    if (!fit || framed.current || placed.length === 0) return;
    framed.current = true;
    const bounds = L.latLngBounds(placed.map((p) => [p.position!.lat, p.position!.lon] as [number, number]));
    map.fitBounds(bounds.pad(0.3), { maxZoom: 14 });
  }, [fit, placed, map]);

  const icons = useMemo(() => new Map(placed.map((p) => [p.id, friendIcon(p.displayName)])), [placed]);

  return (
    <>
      {placed.map((p) => {
        const pos = p.position!;
        return (
          <Fragment key={p.id}>
            {pos.accuracy !== null && pos.accuracy <= MAX_ACCURACY_CIRCLE_M && (
              <Circle center={[pos.lat, pos.lon]} radius={pos.accuracy} interactive={false} pathOptions={{ className: "friend-pin__accuracy" }} />
            )}
            <Marker position={[pos.lat, pos.lon]} icon={icons.get(p.id)} alt={p.displayName} zIndexOffset={1000}>
              <Popup>
                <strong>{p.displayName}</strong>
                <br />
                {t("Position {when}", { when: sinceText(pos.at, now) })}
                {pos.accuracy !== null && <>, {t("ungefär ±{m} m", { m: Math.round(pos.accuracy) })}</>}
                <br />
                {t("Delar till kl. {time}", { time: clockTime(p.endsAt) })}
                <br />
                <Link to={`/person/${p.id}`}>{t("Profil")}</Link>
              </Popup>
            </Marker>
          </Fragment>
        );
      })}
    </>
  );
}
