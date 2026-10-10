import { Capacitor, SystemBars, SystemBarsStyle } from "@capacitor/core";

// Light or dark look, and "fältläge" (bigger text and buttons for gloves
// and sunlight). Kept on the device; applied as data-theme / data-field on
// <html> before the first render so the page never flashes the wrong theme.

export type ThemeChoice = "auto" | "light" | "dark";

const THEME_KEY = "fjallkoll:theme";
const FIELD_KEY = "fjallkoll:field-mode";
export const APPEARANCE_EVENT = "snolage:appearance";

/** Page background per theme, for the browser/phone chrome. */
const CHROME = { light: "#f5f3ee", dark: "#0f1418" } as const;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Not remembered (private window); still applies for this visit.
  }
}

export function themeChoice(): ThemeChoice {
  const saved = read(THEME_KEY);
  return saved === "light" || saved === "dark" ? saved : "auto";
}

export function fieldMode(): boolean {
  return read(FIELD_KEY) === "1";
}

function systemPrefersLight(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: light)").matches;
}

/** The theme actually shown right now. */
export function effectiveTheme(): "light" | "dark" {
  const choice = themeChoice();
  if (choice !== "auto") return choice;
  return systemPrefersLight() ? "light" : "dark";
}

export function applyAppearance(): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const choice = themeChoice();
  if (choice === "auto") delete root.dataset.theme;
  else root.dataset.theme = choice;
  if (fieldMode()) root.dataset.field = "on";
  else delete root.dataset.field;

  const theme = effectiveTheme();
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", CHROME[theme]);
  if (Capacitor.isNativePlatform()) {
    // Light icons on the dark theme, dark icons on the light one.
    SystemBars.setStyle({ style: theme === "light" ? SystemBarsStyle.Light : SystemBarsStyle.Dark }).catch(() => {});
  }
  window.dispatchEvent(new CustomEvent(APPEARANCE_EVENT));
}

export function setThemeChoice(choice: ThemeChoice): void {
  write(THEME_KEY, choice === "auto" ? null : choice);
  applyAppearance();
}

export function setFieldMode(on: boolean): void {
  write(FIELD_KEY, on ? "1" : null);
  applyAppearance();
}

/** Applies the saved look now and follows the phone's light/dark switch while on "auto". */
export function initAppearance(): void {
  applyAppearance();
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
  window.matchMedia("(prefers-color-scheme: light)").addEventListener?.("change", () => {
    if (themeChoice() === "auto") applyAppearance();
  });
}
