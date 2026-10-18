import { locale, plural, t } from "../i18n";

/** "14:32" in the reader's language. */
export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" });
}

/** How long ago a shared position was sent: "nyss", "för 4 min sedan", "för 2 timmar sedan". */
export function sinceText(iso: string, now: Date): string {
  const minutes = Math.floor((now.getTime() - Date.parse(iso)) / 60_000);
  if (minutes < 1) return t("nyss");
  if (minutes < 60) return t("för {n} min sedan", { n: minutes });
  return plural(Math.floor(minutes / 60), "för {n} timme sedan", "för {n} timmar sedan");
}
