import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { SHOWING_SAVED_EVENT } from "../services/cache";

function savedTime(iso: string): string {
  return new Date(iso).toLocaleString("sv-SE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/**
 * A strip under the header when there's no connection, or when a page had to
 * fall back to what was saved on the device. Links to the page that explains
 * what works offline.
 */
export default function OfflineBanner() {
  const location = useLocation();
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine !== false));
  const [savedFrom, setSavedFrom] = useState<string | null>(null);

  // A new page starts without the "showing saved" note; its own loads may set it again.
  const [path, setPath] = useState(location.pathname);
  if (path !== location.pathname) {
    setPath(location.pathname);
    setSavedFrom(null);
  }

  useEffect(() => {
    const up = () => {
      setOnline(true);
      setSavedFrom(null);
    };
    const down = () => setOnline(false);
    const saved = (e: Event) => {
      const at = (e as CustomEvent<{ cachedAt?: string }>).detail?.cachedAt;
      if (at) setSavedFrom((prev) => (prev && prev < at ? prev : at));
    };
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    window.addEventListener(SHOWING_SAVED_EVENT, saved);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
      window.removeEventListener(SHOWING_SAVED_EVENT, saved);
    };
  }, []);

  if (online && !savedFrom) return null;
  const onOfflinePage = location.pathname === "/offline";

  return (
    <div className="offline-banner" role="status">
      <span className="offline-banner__dot" aria-hidden="true" />
      <span>
        {online ? <strong>Ingen kontakt med servern.</strong> : <strong>Du är offline.</strong>}{" "}
        {savedFrom ? `Visar det som sparades ${savedTime(savedFrom)}.` : "Turkoll visar det som är sparat på enheten."}
      </span>
      {!onOfflinePage && (
        <Link to="/offline" className="offline-banner__link">
          Vad fungerar utan täckning?
        </Link>
      )}
    </div>
  );
}
