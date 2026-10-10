/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { coversDay, parseWarnings, warningSentence, warningsByRegion } from "./warnings";

const example = JSON.parse(readFileSync(new URL("./fixtures/smhi/warning-example.json", import.meta.url), "utf8"));
const now = new Date("2026-02-13T17:30:00Z");

describe("SMHI weather warnings", () => {
  it("reads warnings still in force, with level, event, times and text", () => {
    const list = parseWarnings(example, now);
    expect(list.map((w) => w.id)).toEqual(["101-1", "101-2", "102-3"]);
    expect(list[0]).toMatchObject({
      level: "yellow",
      event: { sv: "Mycket hård vind", en: "Very strong wind" },
      area: { sv: "Fjällen i Norrbotten" },
      start: "2026-02-13T18:00:00.000Z",
      text: { sv: "Händelsebeskrivning: Västlig vind 25 m/s i byarna på fjället." },
    });
    expect(list[2]).toMatchObject({ level: "orange", end: null, area: { sv: "Jämtlands län" } });
  });

  it("matches areas by the warning's outline, else by county", () => {
    const byRegion = warningsByRegion(parseWarnings(example, now));
    expect(byRegion.kebnekaisefjallen.map((w) => w.id)).toEqual(["101-1"]);
    expect(byRegion.riksgransfjallen.map((w) => w.id)).toEqual(["101-1"]);
    expect(byRegion["sodra-jamtlandsfjallen"].map((w) => w.id)).toEqual(["102-3"]);
    expect(byRegion["vastra-harjedalsfjallen"].map((w) => w.id)).toEqual(["102-3"]);
    // The coast warning, and the ended one in Västerbotten, reach no mountain area.
    expect(byRegion["vastra-vindelfjallen"]).toBeUndefined();
    expect(JSON.stringify(byRegion)).not.toContain("rings");
  });

  it("refuses an answer that isn't a list, and skips unknown levels", () => {
    expect(() => parseWarnings({ error: "x" }, now)).toThrow();
    expect(parseWarnings([{ warningAreas: [{ warningLevel: { code: "PURPLE" } }] }], now)).toEqual([]);
  });

  it("says which warnings cover a tour day", () => {
    const [wind, , snow] = parseWarnings(example, now);
    expect(coversDay(wind, "2026-02-14")).toBe(true);
    expect(coversDay(wind, "2026-02-16")).toBe(false);
    expect(coversDay(snow, "2026-03-01")).toBe(true);
    expect(warningSentence([wind], "sv")).toBe(" SMHI varnar: Gul varning – Mycket hård vind.");
    expect(warningSentence([wind, snow], "en")).toBe(" SMHI weather warning: Yellow warning – Very strong wind; Orange warning – Snowfall.");
    expect(warningSentence([], "sv")).toBe("");
  });
});
