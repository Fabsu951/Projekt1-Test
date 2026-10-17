import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { fetchUnread, NOTIFICATIONS_READ_EVENT } from "../services/notificationService";
import { t, plural } from "../i18n";

// New notices also arrive as push; the bell only needs to catch up now and
// then, which keeps the worker's request count down.
const POLL_MS = 5 * 60_000;

/** Bell in the menu with the number of unread notifications. */
export default function NotificationBell({ token }: { token: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const check = () => {
      if (document.visibilityState === "hidden") return;
      fetchUnread(token)
        .then((n) => !cancelled && setCount(n))
        .catch(() => {});
    };
    check();
    const timer = setInterval(check, POLL_MS);
    const onRead = () => setCount(0);
    document.addEventListener("visibilitychange", check);
    window.addEventListener(NOTIFICATIONS_READ_EVENT, onRead);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener(NOTIFICATIONS_READ_EVENT, onRead);
    };
  }, [token]);

  const label = count === 0 ? t("Notiser") : plural(count, "Notiser, 1 oläst", "Notiser, {n} olästa");
  return (
    <NavLink
      to="/notiser"
      aria-label={label}
      title={t("Notiser")}
      className={({ isActive }) =>
        isActive ? "app-shell__nav-link notification-bell app-shell__nav-link--active" : "app-shell__nav-link notification-bell"
      }
    >
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
        <path
          d="M12 3a6 6 0 0 0-6 6v3.5L4.5 16h15L18 12.5V9a6 6 0 0 0-6-6zM9.5 18.5a2.5 2.5 0 0 0 5 0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {count > 0 && <span className="notification-bell__count">{count > 99 ? "99+" : count}</span>}
      <span className="app-shell__account-name">{t("Notiser")}</span>
    </NavLink>
  );
}
