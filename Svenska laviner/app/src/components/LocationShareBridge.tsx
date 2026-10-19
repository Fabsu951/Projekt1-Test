import { useEffect, useState } from "react";
import { Geolocation } from "@capacitor/geolocation";
import { useAuth } from "../auth/useAuth";
import { ApiError } from "../services/api";
import {
  activeShare,
  forgetActiveShare,
  sendPosition,
  shareRanOut,
  SEND_HEARTBEAT_MS,
  SHARE_CHANGED_EVENT,
  SHARE_SENT_EVENT,
  shouldSend,
  type ActiveShare,
} from "../services/locationShare";

/**
 * While you share your position, follows it and sends it to the worker –
 * on every page, as long as Snöläge is open. Renders nothing; the banner
 * under the header shows that sharing is on.
 */
export default function LocationShareBridge() {
  const { user, token } = useAuth();
  const userId = user?.id;
  const [active, setActive] = useState<ActiveShare | null>(null);

  useEffect(() => {
    let live = true;
    const refresh = () => void activeShare(userId).then((a) => live && setActive(a));
    refresh();
    window.addEventListener(SHARE_CHANGED_EVENT, refresh);
    return () => {
      live = false;
      window.removeEventListener(SHARE_CHANGED_EVENT, refresh);
    };
  }, [userId]);

  const endsAt = active?.endsAt;
  useEffect(() => {
    if (!endsAt || !token) return;
    let stopped = false;
    let watchId: string | null = null;
    let last: { lat: number; lon: number; at: number } | null = null;
    let latest: { lat: number; lon: number; accuracy: number } | null = null;
    let sending = false;

    const finish = (ranOut = false) => {
      if (stopped) return;
      stopped = true;
      void (ranOut && userId ? shareRanOut({ userId, endsAt }) : forgetActiveShare());
    };

    const send = async (fix: { lat: number; lon: number; accuracy: number }) => {
      if (sending || stopped) return;
      sending = true;
      try {
        await sendPosition(token, { lat: fix.lat, lon: fix.lon, accuracy: Math.round(fix.accuracy) });
        last = { lat: fix.lat, lon: fix.lon, at: Date.now() };
        window.dispatchEvent(new CustomEvent(SHARE_SENT_EVENT, { detail: { ...fix, at: new Date().toISOString() } }));
      } catch (err) {
        // Stopped or ended elsewhere (another device, the end time).
        if (err instanceof ApiError && (err.status === 404 || err.status === 401)) finish();
        // Without coverage: the next fix or the heartbeat tries again.
      } finally {
        sending = false;
      }
    };

    Geolocation.watchPosition({ enableHighAccuracy: true, timeout: 30_000, maximumAge: 15_000 }, (pos) => {
      if (stopped || !pos) return;
      latest = { lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy };
      if (shouldSend(last, latest, Date.now())) void send(latest);
    })
      .then((id) => {
        if (stopped) void Geolocation.clearWatch({ id });
        else watchId = id;
      })
      .catch(() => {
        // No location access: the sharing page explains how to allow it.
      });

    // Standing still (or a send that failed for lack of coverage): resend now and then.
    const heartbeat = window.setInterval(() => {
      if (latest && (!last || Date.now() - last.at >= SEND_HEARTBEAT_MS)) void send(latest);
    }, 60_000);
    const end = window.setTimeout(() => finish(true), Math.max(0, Date.parse(endsAt) - Date.now()));

    return () => {
      stopped = true;
      window.clearInterval(heartbeat);
      window.clearTimeout(end);
      if (watchId) void Geolocation.clearWatch({ id: watchId });
    };
  }, [endsAt, token, userId]);

  return null;
}
