import { useCallback, useEffect, useRef, useState } from "react";
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
 * Danger-level notifications for the starred areas: web push in browsers,
 * Firebase in the Android/iOS apps. `available` is false where neither
 * works or the server hasn't turned that kind on yet. With `sync` the
 * subscription follows the stars (only one mounted user should sync).
 */
export function useRegionPush({ sync = true }: { sync?: boolean } = {}) {
  const { favorites } = useFavorites();
  const { token } = useAuth();
  const native = isNativeApp();
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [available, setAvailable] = useState(false);
  const [checked, setChecked] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const synced = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const done = () => !cancelled && setChecked(true);
    if (native) {
      Promise.all([nativePushAvailable(), nativeRegionPushEnabled()])
        .then(([ok, on]) => {
          if (cancelled) return;
          setAvailable(ok);
          setEnabled(ok && on);
        })
        .catch(() => {})
        .finally(done);
    } else if (pushSupported()) {
      Promise.all([fetchPushKey(), regionPushEnabled()])
        .then(([key, on]) => {
          if (cancelled) return;
          setPublicKey(key);
          setAvailable(Boolean(key));
          setEnabled(Boolean(key && on));
        })
        .catch(() => {})
        .finally(done);
    } else {
      done();
    }
    return () => {
      cancelled = true;
    };
  }, [native]);

  // Starring or unstarring a region updates which notifications arrive.
  useEffect(() => {
    if (!sync) return;
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
  }, [favorites, enabled, native, token, sync]);

  /** Turns notifications on or off; returns whether it worked. */
  const set = useCallback(
    async (on: boolean): Promise<boolean> => {
      setBusy(true);
      setMessage(null);
      try {
        if (!on) {
          if (native) await disableNativeRegionPush(token);
          else await disablePush();
          setEnabled(false);
        } else {
          if (native) await enableNativeRegionPush(favorites, token);
          else await enablePush(publicKey!, favorites);
          synced.current = favorites.join(",");
          setEnabled(true);
        }
        return true;
      } catch (err) {
        setMessage(err instanceof Error ? err.message : t("Kunde inte ändra notiserna."));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [native, token, favorites, publicKey]
  );

  return { available, checked, enabled, busy, message, set };
}
