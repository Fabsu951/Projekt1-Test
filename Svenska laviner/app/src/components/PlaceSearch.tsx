import { useEffect, useMemo, useRef, useState } from "react";
import { Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { buildIndex, KIND_LABELS, searchPlaces, type Place, type PlaceIndex, type PlaceRow } from "../utils/placeSearch";
import { t, locale } from "../i18n";

/** Close enough to see the terrain around a found place. */
const PLACE_ZOOM = 13;

let indexPromise: Promise<PlaceIndex> | null = null;

/** The place names, loaded the first time someone searches (about a megabyte, kept for offline use). */
function loadIndex(): Promise<PlaceIndex> {
  indexPromise ??= import("../data/ortnamn.json")
    .then((mod) => buildIndex((mod.default as unknown as { places: PlaceRow[] }).places))
    .catch((err) => {
      indexPromise = null;
      throw err;
    });
  return indexPromise;
}

interface Props {
  near: { lat: number; lon: number } | null;
  onPick: (place: Place) => void;
  onClose: () => void;
}

/** Search box with results, shown under the map toolbar. */
export default function PlaceSearch({ near, onPick, onClose }: Props) {
  const [index, setIndex] = useState<PlaceIndex | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    loadIndex()
      .then((i) => live && setIndex(i))
      .catch(() => live && setFailed(true));
    input.current?.focus();
    return () => {
      live = false;
    };
  }, []);

  // The map centre when the search opened: panning while the list is open shouldn't reshuffle it.
  const [origin] = useState(near);
  const results = useMemo(() => (index ? searchPlaces(index, query, origin) : []), [index, query, origin]);
  const typed = query.trim().length >= 2;

  return (
    <div className="place-search" role="search">
      <div className="place-search__bar">
        <input
          aria-label={t("Sök plats")}
          ref={input}
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          placeholder={t("Sök topp, stuga, sjö eller ort")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "Enter" && results[0]) onPick(results[0]);
          }}
        />
        <button type="button" className="link-button" onClick={onClose}>
          {t("Stäng")}
        </button>
      </div>
      {failed && <p className="place-search__note">{t("Ortnamnen kunde inte laddas. Försök igen när du har täckning.")}</p>}
      {!failed && !index && typed && <p className="place-search__note">{t("Laddar ortnamn…")}</p>}
      {index && typed && results.length === 0 && <p className="place-search__note">{t("Ingen plats med det namnet.")}</p>}
      {results.length > 0 && (
        <ul className="place-search__results">
          {results.map((p) => (
            <li key={`${p.name}-${p.lat}-${p.lon}`}>
              <button type="button" onClick={() => onPick(p)}>
                <span className="place-search__name">{p.name}</span>
                <span className="place-search__meta">
                  {[
                    KIND_LABELS[p.kind],
                    p.ele ? t("{m} m ö.h.", { m: p.ele.toLocaleString(locale()) }) : null,
                    p.alsoKnownAs ? t("även {name}", { name: p.alsoKnownAs }) : null,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {typed && <p className="place-search__credit">{t("Ortnamn: © OpenStreetMap-bidragsgivare (ODbL)")}</p>}
    </div>
  );
}

const PIN = L.divIcon({
  className: "place-pin",
  html: '<svg viewBox="0 0 24 32" aria-hidden="true"><path d="M12 31S2 19.5 2 12a10 10 0 0 1 20 0c0 7.5-10 19-10 19Z" fill="#17222b" stroke="#fff" stroke-width="2"/><circle cx="12" cy="12" r="3.6" fill="#fff"/></svg>',
  iconSize: [28, 36],
  iconAnchor: [14, 35],
  popupAnchor: [0, -30],
});

/** The picked place on the map: flies there and marks it with a pin. */
export function PickedPlace({ place }: { place: Place | null }) {
  const map = useMap();
  const marker = useRef<L.Marker | null>(null);
  useEffect(() => {
    if (!place) return;
    map.setView([place.lat, place.lon], Math.max(map.getZoom(), PLACE_ZOOM));
    // Opens once the marker is on the map.
    const timer = window.setTimeout(() => marker.current?.openPopup(), 50);
    return () => window.clearTimeout(timer);
  }, [map, place]);
  if (!place) return null;
  return (
    <Marker ref={marker} position={[place.lat, place.lon]} icon={PIN} title={place.name} alt={place.name}>
      <Popup>
        <strong>{place.name}</strong>
        <br />
        {KIND_LABELS[place.kind]}
        {place.ele ? `, ${t("{m} m ö.h.", { m: place.ele.toLocaleString(locale()) })}` : ""}
      </Popup>
    </Marker>
  );
}
