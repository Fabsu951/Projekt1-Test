import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { listenForReminderTaps } from "../services/backgroundImport";
import { listenForNativePush, syncNativeLanguage } from "../services/nativePush";
import { syncPushLanguage } from "../services/push";

/**
 * In the apps: tapping a push notification (or a reminder about a new session
 * from the watch) opens its page; new Firebase tokens are re-registered.
 */
export default function NativePushBridge() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const tokenRef = useRef(token);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);
  useEffect(() => {
    listenForNativePush(
      (path) => navigate(path),
      () => tokenRef.current
    );
  }, [navigate]);
  useEffect(() => listenForReminderTaps((path) => navigate(path)), [navigate]);
  // The language may have changed since notices were turned on.
  useEffect(() => {
    syncNativeLanguage().catch(() => {});
    syncPushLanguage().catch(() => {});
  }, []);
  return null;
}
