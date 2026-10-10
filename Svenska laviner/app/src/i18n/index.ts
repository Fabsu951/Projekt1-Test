import { EN } from "./en";

// Swedish is the app's own language; English is a translation table keyed by
// the Swedish text (gettext style), so a missing translation shows Swedish
// rather than nothing. i18n.test.ts checks that every t("…") has an entry.
// Changing language reloads the app, so nothing needs to re-render live.
// Forecast texts from Naturvårdsverket, posts by users and the legal texts
// stay Swedish.

export type Lang = "sv" | "en";
const KEY = "fjallkoll:language";

// Also compiled for the build (vite.config.ts → pageHead.ts), which has no DOM types.
const g = globalThis as unknown as {
  window?: { location: { reload(): void } };
  document?: { documentElement: { lang: string } };
  localStorage?: { getItem(k: string): string | null; setItem(k: string, v: string): void };
  navigator?: { language: string; languages?: readonly string[] };
};

/** Swedish for Swedes and neighbours who read it; English for everyone else. */
export function detectLang(saved: string | null, browser: readonly string[]): Lang {
  if (saved === "sv" || saved === "en") return saved;
  const first = (browser[0] ?? "sv").toLowerCase();
  return /^(sv|nb|nn|no|da)\b/.test(first) ? "sv" : "en";
}

function readSaved(): string | null {
  try {
    return g.localStorage?.getItem(KEY) ?? null;
  } catch {
    return null;
  }
}

// Outside a browser (the build writes per-page HTML heads) it is always Swedish.
let current: Lang =
  !g.window || !g.navigator
    ? "sv"
    : detectLang(readSaved(), g.navigator.languages?.length ? g.navigator.languages : [g.navigator.language]);

export const lang = (): Lang => current;
export const isEnglish = () => current === "en";
/** For toLocaleDateString and friends. Use "sv-SE" directly only for machine dates (YYYY-MM-DD). */
export const locale = () => (current === "en" ? "en-GB" : "sv-SE");

/** The text in the current language, with {name} placeholders filled in. */
export function t(sv: string, vars?: Record<string, string | number>): string {
  const text = current === "en" ? (EN[sv] ?? sv) : sv;
  return vars ? text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : text;
}

/** "1 tur" / "3 turer": pass both Swedish forms; the English ones come from the table. */
export function plural(n: number, one: string, many: string): string {
  return t(n === 1 ? one : many, { n });
}

export function setLang(next: Lang, reload = true): void {
  try {
    g.localStorage?.setItem(KEY, next);
  } catch {
    // Not remembered (private window); still switches for this visit.
  }
  current = next;
  if (g.document) g.document.documentElement.lang = next;
  if (reload) g.window?.location.reload();
}

/** For tests. */
export function useLangForTest(next: Lang): void {
  current = next;
}

if (g.document) g.document.documentElement.lang = current;

/** Compass points are stored the Swedish way (O = öst, V = väst); English shows E and W. */
export const compass = (sector: string): string => (current === "en" ? sector.replace(/O/g, "E").replace(/V/g, "W") : sector);
