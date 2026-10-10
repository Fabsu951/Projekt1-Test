import { useEffect, useState } from "react";
import { APPEARANCE_EVENT, effectiveTheme, setThemeChoice } from "../services/appearance";
import { t } from "../i18n";
import Icon from "./Icon";

/** Switches between the light and the dark look (more choices under Om Snöläge). */
export default function ThemeButton() {
  const [theme, setTheme] = useState(effectiveTheme);
  useEffect(() => {
    const update = () => setTheme(effectiveTheme());
    window.addEventListener(APPEARANCE_EVENT, update);
    return () => window.removeEventListener(APPEARANCE_EVENT, update);
  }, []);
  const next = theme === "light" ? "dark" : "light";
  const label = next === "light" ? t("Byt till ljust läge") : t("Byt till mörkt läge");
  return (
    <button
      type="button"
      className="app-shell__nav-link app-shell__theme"
      aria-label={label}
      title={label}
      onClick={() => setThemeChoice(next)}
    >
      <Icon name={next === "light" ? "sun" : "moon"} size={20} />
      <span className="app-shell__theme-text">{next === "light" ? t("Ljust läge") : t("Mörkt läge")}</span>
    </button>
  );
}
