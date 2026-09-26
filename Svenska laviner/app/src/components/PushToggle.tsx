import { useEffect, useRef, useState } from "react";
import { useFavorites } from "../favorites/useFavorites";
import {
  currentSubscription,
  disablePush,
  enablePush,
  fetchPushKey,
  pushSupported,
  updatePushRegions,
} from "../services/push";

/**
 * "Notiser när farograden ändras" for the starred regions. Hidden when the
 * browser can't do web push or the server hasn't enabled it yet.
 */
export default function PushToggle() {
  const { favorites } = useFavorites();
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const synced = useRef<string | null>(null);

  useEffect(() => {
    if (!pushSupported()) return;
    let cancelled = false;
    Promise.all([fetchPushKey(), currentSubscription()])
      .then(([key, subscription]) => {
        if (cancelled) return;
        setPublicKey(key);
        setEnabled(Boolean(key && subscription));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Starring or unstarring a region updates which notifications arrive.
  useEffect(() => {
    const key = favorites.join(",");
    if (!enabled || synced.current === key) return;
    synced.current = key;
    const request = favorites.length > 0 ? updatePushRegions(favorites) : disablePush().then(() => setEnabled(false));
    request.catch(() => setMessage("Kunde inte uppdatera dina notiser. Försök igen senare."));
  }, [favorites, enabled]);

  if (!publicKey || favorites.length === 0) return null;

  async function toggle() {
    setBusy(true);
    setMessage(null);
    try {
      if (enabled) {
        await disablePush();
        setEnabled(false);
      } else {
        await enablePush(publicKey!, favorites);
        synced.current = favorites.join(",");
        setEnabled(true);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Kunde inte ändra notiserna.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="push-toggle">
      <label className="push-toggle__label">
        <input type="checkbox" checked={enabled} disabled={busy} onChange={() => void toggle()} />
        Notis när farograden ändras i mina områden
      </label>
      {message && (
        <p className="push-toggle__message" role="alert">
          {message}
        </p>
      )}
    </div>
  );
}
