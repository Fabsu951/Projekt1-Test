import { NavLink, Outlet, useLocation } from "react-router-dom";
import ErrorBoundary from "./ErrorBoundary";

const NAV_ITEMS = [
  { to: "/", label: "Områden", end: true },
  { to: "/karta", label: "Karta", end: false },
  { to: "/sakerhetsguide", label: "Säkerhetsguide", end: false },
  { to: "/om-appen", label: "Om appen", end: false },
];

export default function Layout() {
  const location = useLocation();

  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <NavLink to="/" className="app-shell__brand">
          🏔️ Fjällvarning
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
        </nav>
      </header>
      <main>
        <ErrorBoundary key={location.pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}
