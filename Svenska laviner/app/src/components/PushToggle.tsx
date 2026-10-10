import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/useAuth";
import { useFavorites } from "../favorites/useFavorites";
import {
  regionPushEnabled,
  disablePush,
  enablePush,
  fetchPushKey,
  pushSupported,
  updatePushRegions,
} from "../services/push";
import {
  disableNativeRegionPush,
  enableNativeRegionPush,
  isNativeApp,
  nativePushAvailable,
  nativeRegionPushEnabled,
  updateNativeRegions,
} from "../services/nativePush";
import { t } from "../i18n";

/**
 * "Notiser när farograden ändras" for the starred regions: web push in
 * browsers, Firebase in the Android/iOS apps. Hidden where neither works or
 * the server hasn't turned that kind on yet.
 */
export default function PushToggle() {
  const { favorites } = useFavorites();
  const { token } = useAuth();
  const native = isNativeApp();
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [available, setAvailable] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const synced = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (native) {
      Promise.all([nativePushAvailable(), nativeRegionPushEnabled()])
        .then(([ok, on]) => {
          if (cancelled) return;
          setAvailable(ok);
          setEnabled(ok && on);
        })
        .catch(() => {});
    } else if (pushSupported()) {
      Promise.all([fetchPushKey(), regionPushEnabled()])
        .then(([key, on]) => {
          if (cancelled) return;
          setPublicKey(key);
          setAvailable(Boolean(key));
          setEnabled(Boolean(key && on));
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [native]);

  // Starring or unstarring a region updates which notifications arrive.
  useEffect(() => {
    const key = favorites.join(",");
    if (!enabled || synced.current === key) return;
    synced.current = key;
    const request =
      favorites.length > 0
        ? native
          ? updateNativeRegions(favorites, token)
          : updatePushRegions(favorites)
        : (native ? disableNativeRegionPush(token) : disablePush()).then(() => setEnabled(false));
    request.catch(() => setMessage(t("Kunde inte uppdatera dina notiser. Försök igen senare.")));
  }, [favorites, enabled, native, token]);

  if (!available || favorites.length === 0) return null;

  async function toggle() {
    setBusy(true);
    setMessage(null);
    try {
      if (enabled) {
        if (native) await disableNativeRegionPush(token);
        else await disablePush();
        setEnabled(false);
      } else {
        if (native) await enableNativeRegionPush(favorites, token);
        else await enablePush(publicKey!, favorites);
        synced.current = favorites.join(",");
        setEnabled(true);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t("Kunde inte ändra notiserna."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="push-toggle">
      <label className="push-toggle__label">
        <input type="checkbox" checked={enabled} disabled={busy} onChange={() => void toggle()} />
        {t("Notis när farograden ändras i mina områden")}
      </label>
      {message && (
        <p className="push-toggle__message" role="alert">
          {message}
        </p>
      )}
    </div>
  );
}
