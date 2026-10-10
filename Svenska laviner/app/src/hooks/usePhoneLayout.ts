import { useEffect, useState } from "react";

const QUERY = "(max-width: 640px)";

function matches(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(QUERY).matches;
}

/** True on phone-sized screens, where the menu becomes a tab bar at the bottom. */
export function usePhoneLayout(): boolean {
  const [phone, setPhone] = useState(matches);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const list = window.matchMedia(QUERY);
    const update = () => setPhone(list.matches);
    list.addEventListener?.("change", update);
    return () => list.removeEventListener?.("change", update);
  }, []);
  return phone;
}
