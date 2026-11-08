import { Suspense, useEffect, useRef, useState } from "react";
import NativePushBridge from "./NativePushBridge";
import PageLoading from "./PageLoading";
import ObservationQueueBanner from "./ObservationQueueBanner";
import ObservationQueueBridge from "./ObservationQueueBridge";
import LocationShareBanner from "./LocationShareBanner";
import RecordingBanner from "./RecordingBanner";
import LocationShareBridge from "./LocationShareBridge";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { defaultTitle, fullTitle, PageTitleContext } from "./pageTitle";
import { applyPageMeta } from "./pageMeta";
import ErrorBoundary from "./ErrorBoundary";
import Avatar from "./Avatar";
import LanguageSwitch from "./LanguageSwitch";
import ThemeButton from "./ThemeButton";
import TabBar from "./TabBar";
import { usePhoneLayout } from "../hooks/usePhoneLayout";
import NotificationBell from "./NotificationBell";
import OfflineBanner from "./OfflineBanner";
import { useAuth } from "../auth/useAuth";
import { t } from "../i18n";

/** The menu in three groups: today's conditions, the community, and reading. */
const NAV_GROUPS = [
  {
    label: t("Läget"),
    items: [
      { to: "/", label: t("Idag"), end: true, tab: true },
      { to: "/karta", label: t("Karta"), end: false, tab: true },
      { to: "/observationer", label: t("Observationer"), end: false },
    ],
  },
  {
    label: t("Gemenskap"),
    items: [
      { to: "/flode", label: t("Flöde"), end: false, tab: true },
      { to: "/turer", label: t("Turer"), end: false, tab: true },
    ],
  },
  {
    label: t("Lär dig mer"),
    items: [
      { to: "/sakerhetsguide", label: t("Säkerhetsguide"), end: false },
      { to: "/om-appen", label: t("Om Snöläge"), end: false },
    ],
  },
];

/** A peak with the stepped crown of a slab avalanche cut across it. */
function BrandMark({ className = "app-shell__mark" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--accent)" />
      <path
        d="M4 25 L13.2 8.5 L18 16.6 L20.6 12.6 L28 25 Z"
        fill="var(--on-accent)"
      />
      <path
        d="M6.6 20.6 L11.4 18.4 L13.4 19.9 L17.6 17.4 L19.6 18.9 L25.2 16.8"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.7"
        strokeLinejoin="miter"
      />
    </svg>
  );
}

export default function Layout() {
  const location = useLocation();
  const { user, token } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  // Phones get a tab bar at the bottom; the menu then only holds the rest.
  const phone = usePhoneLayout();
  const [pageTitle, setPageTitle] = useState<string | null>(null);
  const headerRef = useRef<HTMLElement>(null);

  // Sticky things below the header (the jump links) need its height.
  useEffect(() => {
    const el = headerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() =>
      document.documentElement.style.setProperty(
        "--header-h",
        `${Math.round(el.getBoundingClientRect().height)}px`
      )
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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

  const accountLink = (
    <NavLink
      to={user ? "/profil" : "/logga-in"}
      aria-label={
        user ? t("Min profil ({name})", { name: user.displayName }) : undefined
      }
      title={user ? t("Min profil") : undefined}
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
          <Avatar
            name={user.displayName}
            avatarPath={user.avatarPath}
            xp={user.xp}
            size={38}
          />
          <span className="app-shell__account-name">{t("Min profil")}</span>
        </>
      ) : (
        t("Logga in")
      )}
    </NavLink>
  );

  return (
    <div className={phone ? "app-shell app-shell--tabs" : "app-shell"}>
      <header className="app-shell__header" ref={headerRef}>
        <NavLink to="/" className="app-shell__brand">
          <BrandMark />
          Snöläge
        </NavLink>
        {phone && (
          <div className="app-shell__quick">
            {user && token && <NotificationBell token={token} />}
            {accountLink}
          </div>
        )}
        <button
          type="button"
          className="app-shell__menu-button"
          aria-expanded={menuOpen}
          aria-controls="app-nav"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span
            className={menuOpen ? "menu-icon menu-icon--open" : "menu-icon"}
            aria-hidden="true"
          />
          {t("Meny")}
        </button>
        <nav
          id="app-nav"
          className={
            menuOpen ? "app-shell__nav app-shell__nav--open" : "app-shell__nav"
          }
          aria-label={t("Huvudmeny")}
        >
          {NAV_GROUPS.map((group) => ({
            ...group,
            items: group.items.filter((item) => !(phone && item.tab)),
          }))
            .filter((group) => group.items.length > 0)
            .map((group) => (
              <div
                key={group.label}
                className="app-shell__nav-group"
                role="group"
                aria-label={group.label}
              >
                <span className="app-shell__nav-heading" aria-hidden="true">
                  {group.label}
                </span>
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      isActive
                        ? "app-shell__nav-link app-shell__nav-link--active"
                        : "app-shell__nav-link"
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            ))}
          <div className="app-shell__nav-group app-shell__nav-group--me">
            <LanguageSwitch />
            <ThemeButton />
            {!phone && user && token && <NotificationBell token={token} />}
            {!phone && accountLink}
          </div>
        </nav>
      </header>
      <OfflineBanner />
      <ObservationQueueBanner />
      <LocationShareBanner />
      <RecordingBanner />
      <NativePushBridge />
      <ObservationQueueBridge />
      <LocationShareBridge />
      <main>
        <ErrorBoundary key={location.pathname}>
          <PageTitleContext.Provider value={setPageTitle}>
            {/* Pages loaded on demand (App.tsx) show this while they load; the header stays. */}
            <Suspense fallback={<PageLoading />}>
              <Outlet />
            </Suspense>
          </PageTitleContext.Provider>
        </ErrorBoundary>
      </main>
      {phone && <TabBar />}
    </div>
  );
}
