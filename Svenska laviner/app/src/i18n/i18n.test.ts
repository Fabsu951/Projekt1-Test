import { describe, expect, it } from "vitest";
import { EN } from "./en";
import { detectLang, plural, t, useLangForTest } from "./index";

// The app's own source (tests and this folder excluded), as text.
const SOURCES = import.meta.glob(["../**/*.{ts,tsx}", "!../**/*.test.*", "!../i18n/**", "!../test/**"], {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

/** Every literal first argument of t( / plural( in the app. */
function usedKeys(): string[] {
  const keys = new Set<string>();
  const call = /\b(?:t|plural)\(\s*("(?:[^"\\]|\\.)*"|`(?:[^`\\$]|\\.)*`)(?:\s*,\s*("(?:[^"\\]|\\.)*"))?/g;
  for (const text of Object.values(SOURCES)) {
    for (const m of text.matchAll(call)) {
      for (const lit of [m[1], m[2]]) if (lit) keys.add(JSON.parse(lit.startsWith("`") ? JSON.stringify(lit.slice(1, -1)) : lit));
    }
  }
  return [...keys];
}

describe("translations", () => {
  it("has English for every text the app shows through t()", () => {
    const missing = usedKeys().filter((k) => !(k in EN));
    expect(missing).toEqual([]);
  });

  it("keeps the placeholders in the English text", () => {
    const wrong = Object.entries(EN).filter(([sv, en]) => {
      const names = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
      return names(sv) !== names(en);
    });
    expect(wrong).toEqual([]);
  });

  it("picks Swedish for Scandinavian browsers and English for others, unless chosen", () => {
    expect(detectLang(null, ["sv-SE"])).toBe("sv");
    expect(detectLang(null, ["nb-NO", "en"])).toBe("sv");
    expect(detectLang(null, ["de-DE"])).toBe("en");
    expect(detectLang("sv", ["de-DE"])).toBe("sv");
    expect(detectLang("en", ["sv-SE"])).toBe("en");
  });

  it("fills placeholders and falls back to Swedish", () => {
    useLangForTest("en", EN);
    expect(t("Okänd text som saknas")).toBe("Okänd text som saknas");
    expect(t("{n} x", { n: 3 })).toBe("3 x");
    useLangForTest("sv");
    expect(plural(1, "{n} tur", "{n} turer")).toBe("1 tur");
    expect(plural(3, "{n} tur", "{n} turer")).toBe("3 turer");
  });
});
