import { NavLink, Outlet, useLocation } from "react-router-dom";
import ErrorBoundary from "./ErrorBoundary";
import { useAuth } from "../auth/useAuth";

const NAV_ITEMS = [
  { to: "/", label: "Områden", end: true },
  { to: "/karta", label: "Karta", end: false },
  { to: "/observationer", label: "Observationer", end: false },
  { to: "/flode", label: "Flöde", end: false },
  { to: "/turer", label: "Turer", end: false },
  { to: "/sakerhetsguide", label: "Säkerhetsguide", end: false },
  { to: "/om-appen", label: "Om Fjällkoll", end: false },
];

function BrandMark() {
  return (
    <svg className="app-shell__mark" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="23" cy="9" r="4" fill="var(--signal)" />
      <path d="M2 28 L12 10 L17 18 L20 14 L30 28 Z" fill="var(--accent)" />
      <path d="M12 10 L15.2 15.8 L13.2 14.6 L11.4 16.4 L9.6 14.6 Z" fill="var(--snow)" />
    </svg>
  );
}

/** Two layered ridgelines along the bottom edge of the header. */
function Ridgeline() {
  return (
    <svg className="app-shell__ridge" viewBox="0 0 1200 60" preserveAspectRatio="none" aria-hidden="true">
      <path
        d="M0 60 L0 38 L90 22 L160 34 L260 8 L340 30 L420 18 L520 36 L610 12 L700 32 L790 20 L880 38 L980 14 L1070 30 L1140 22 L1200 32 L1200 60 Z"
        fill="var(--accent)"
        opacity="0.12"
      />
      <path
        d="M0 60 L0 48 L120 36 L210 50 L320 30 L430 46 L540 34 L650 50 L760 38 L870 52 L990 32 L1100 48 L1200 40 L1200 60 Z"
        fill="var(--bg)"
      />
    </svg>
  );
}

export default function Layout() {
  const location = useLocation();
  const { user } = useAuth();

  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <NavLink to="/" className="app-shell__brand">
          <BrandMark />
          Fjällkoll
        </NavLink>
        <nav className="app-shell__nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                isActive ? "app-shell__nav-link app-shell__nav-link--active" : "app-shell__nav-link"
              }
            >
              {item.label}
            </NavLink>
          ))}
          <NavLink
            to={user ? "/profil" : "/logga-in"}
            className={({ isActive }) =>
              isActive
                ? "app-shell__nav-link app-shell__nav-link--account app-shell__nav-link--active"
                : "app-shell__nav-link app-shell__nav-link--account"
            }
          >
            {user ? user.displayName : "Logga in"}
          </NavLink>
        </nav>
        <Ridgeline />
      </header>
      <main>
        <ErrorBoundary key={location.pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}
