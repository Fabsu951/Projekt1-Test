import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { listenForNativePush } from "../services/nativePush";

/** In the apps: tapping a push notification opens its page; new Firebase tokens are re-registered. */
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
  return null;
}
