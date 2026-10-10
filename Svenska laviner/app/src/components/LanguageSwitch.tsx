import { lang, setLang } from "../i18n";

/**
 * Switches between Swedish and English. Written in the language you switch
 * to, so someone who can't read the current one still finds it. The page
 * reloads in the new language (see i18n/index.ts).
 */
export default function LanguageSwitch({ className = "app-shell__nav-link app-shell__lang" }: { className?: string }) {
  const english = lang() === "en";
  return (
    <button
      type="button"
      className={className}
      lang={english ? "sv" : "en"}
      aria-label={english ? "Byt till svenska" : "Switch to English"}
      title={english ? "Byt till svenska" : "Switch to English"}
      onClick={() => setLang(english ? "sv" : "en")}
    >
      {english ? "Svenska" : "English"}
    </button>
  );
}
