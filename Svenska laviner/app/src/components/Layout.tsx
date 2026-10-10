import { useEffect, useState } from "react";
import NativePushBridge from "./NativePushBridge";
import ObservationQueueBanner from "./ObservationQueueBanner";
import ObservationQueueBridge from "./ObservationQueueBridge";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { defaultTitle, fullTitle, PageTitleContext } from "./pageTitle";
import { applyPageMeta } from "./pageMeta";
import ErrorBoundary from "./ErrorBoundary";
import Avatar from "./Avatar";
import NotificationBell from "./NotificationBell";
import OfflineBanner from "./OfflineBanner";
import { useAuth } from "../auth/useAuth";

/** The menu in three groups: today's conditions, the community, and reading. */
const NAV_GROUPS = [
  {
    label: "Läget",
    items: [
      { to: "/", label: "Idag", end: true },
      { to: "/karta", label: "Karta", end: false },
      { to: "/observationer", label: "Observationer", end: false },
    ],
  },
  {
    label: "Gemenskap",
    items: [
      { to: "/flode", label: "Flöde", end: false },
      { to: "/turer", label: "Turer", end: false },
    ],
  },
  {
    label: "Lär dig mer",
    items: [
      { to: "/sakerhetsguide", label: "Säkerhetsguide", end: false },
      { to: "/om-appen", label: "Om Snöläge", end: false },
    ],
  },
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
  const { user, token } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pageTitle, setPageTitle] = useState<string | null>(null);

  // Close the phone menu after choosing a page.
  const [menuPath, setMenuPath] = useState(location.pathname);
  if (menuPath !== location.pathname) {
    setMenuPath(location.pathname);
    setMenuOpen(false);
  }

  useEffect(() => {
    const title = fullTitle(pageTitle ?? defaultTitle(location.pathname));
    document.title = title;
    applyPageMeta(location.pathname, title);
  }, [pageTitle, location.pathname]);

  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <NavLink to="/" className="app-shell__brand">
          <BrandMark />
          Snöläge
        </NavLink>
        <button
          type="button"
          className="app-shell__menu-button"
          aria-expanded={menuOpen}
          aria-controls="app-nav"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span className={menuOpen ? "menu-icon menu-icon--open" : "menu-icon"} aria-hidden="true" />
          Meny
        </button>
        <nav
          id="app-nav"
          className={menuOpen ? "app-shell__nav app-shell__nav--open" : "app-shell__nav"}
          aria-label="Huvudmeny"
        >
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="app-shell__nav-group" role="group" aria-label={group.label}>
              <span className="app-shell__nav-heading" aria-hidden="true">
                {group.label}
              </span>
              {group.items.map((item) => (
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
            </div>
          ))}
          <div className="app-shell__nav-group app-shell__nav-group--me">
            {user && token && <NotificationBell token={token} />}
            <NavLink
              to={user ? "/profil" : "/logga-in"}
              aria-label={user ? `Min profil (${user.displayName})` : undefined}
              title={user ? "Min profil" : undefined}
              className={({ isActive }) =>
                [
                  "app-shell__nav-link app-shell__nav-link--account",
                  user && "app-shell__nav-link--avatar",
                  isActive && "app-shell__nav-link--active",
                ]
                  .filter(Boolean)
                  .join(" ")
              }
            >
              {user ? (
                <>
                  <Avatar name={user.displayName} avatarPath={user.avatarPath} xp={user.xp} size={38} />
                  <span className="app-shell__account-name">Min profil</span>
                </>
              ) : (
                "Logga in"
              )}
            </NavLink>
          </div>
        </nav>
        <Ridgeline />
      </header>
      <OfflineBanner />
      <ObservationQueueBanner />
      <NativePushBridge />
      <ObservationQueueBridge />
      <main>
        <ErrorBoundary key={location.pathname}>
          <PageTitleContext.Provider value={setPageTitle}>
            <Outlet />
          </PageTitleContext.Provider>
        </ErrorBoundary>
      </main>
    </div>
  );
}
