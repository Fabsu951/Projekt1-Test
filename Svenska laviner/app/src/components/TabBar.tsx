import { Link, useLocation } from "react-router-dom";
import { t } from "../i18n";
import Icon, { type IconName } from "./Icon";

interface Tab {
  to: string;
  label: string;
  icon: IconName;
  /** Other paths that belong to this tab. */
  also?: string[];
  primary?: boolean;
}

const TABS: Tab[] = [
  { to: "/", label: t("Idag"), icon: "mountain", also: ["/omrade/"] },
  { to: "/karta", label: t("Karta"), icon: "map" },
  { to: "/observationer/snabb", label: t("Observera"), icon: "plus", primary: true },
  { to: "/flode", label: t("Flöde"), icon: "people", also: ["/person/"] },
  { to: "/turer", label: t("Turer"), icon: "route" },
];

function isActive(tab: Tab, path: string): boolean {
  if (tab.to === "/") return path === "/" || (tab.also ?? []).some((p) => path.startsWith(p));
  return path === tab.to || path.startsWith(`${tab.to}/`) || (tab.also ?? []).some((p) => path.startsWith(p));
}

/** The phone's main navigation, within thumb reach at the bottom of the screen. */
export default function TabBar() {
  const { pathname } = useLocation();
  return (
    <nav className="tab-bar" aria-label={t("Flikar")}>
      {TABS.map((tab) => {
        const active = !tab.primary && isActive(tab, pathname);
        return (
          <Link
            key={tab.to}
            to={tab.to}

            className={["tab-bar__tab", tab.primary && "tab-bar__tab--primary", active && "tab-bar__tab--active"].filter(Boolean).join(" ")}
            aria-current={active ? "page" : undefined}
          >
            <span className="tab-bar__icon">
              <Icon name={tab.icon} size={tab.primary ? 26 : 24} />
            </span>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
