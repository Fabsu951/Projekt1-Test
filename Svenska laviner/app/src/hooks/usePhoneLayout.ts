import { useEffect, useState } from "react";

const QUERY = "(max-width: 640px)";

/** Whether the screen is phone-sized right now (for initial state). */
export function isPhoneLayout(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(QUERY).matches;
}

/** True on phone-sized screens, where the menu becomes a tab bar at the bottom. */
export function usePhoneLayout(): boolean {
  const [phone, setPhone] = useState(isPhoneLayout);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const list = window.matchMedia(QUERY);
    const update = () => setPhone(list.matches);
    list.addEventListener?.("change", update);
    return () => list.removeEventListener?.("change", update);
  }, []);
  return phone;
}
