/// <reference types="node" />
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  apiTime,
  forecastFromApi,
  forecastInForce,
  historyRowsFromApi,
  htmlToLines,
  readForecasts,
  recentUrl,
  currentSeasonYear,
  seasonSummary,
  seasonUrl,
  type ApiForecast,
} from "./forecastApi";
import { extractModel, readForecast } from "./model";

const DIR = join(__dirname, "fixtures");
const load = (name: string): ApiForecast[] =>
  readForecasts(JSON.parse(readFileSync(join(DIR, "nvgis", name), "utf8").replace(/^﻿/, "")));
const local = (text: string) => apiTime(text)!;

describe("forecast API answers", () => {
  it("reads times both as ISO and as Swedish wall-clock time", () => {
    expect(apiTime("2026-02-18T17:00:00Z")?.toISOString()).toBe("2026-02-18T17:00:00.000Z");
    expect(apiTime("2026-02-18 18:00")?.toISOString()).toBe("2026-02-18T17:00:00.000Z"); // winter time
    expect(apiTime("2026-06-01 08:00")?.toISOString()).toBe("2026-06-01T06:00:00.000Z"); // summer time
    expect(apiTime("")).toBeNull();
  });

  it("asks for a few days back in Swedish time", () => {
    const url = new URL(recentUrl(3, new Date("2026-02-18T11:00:00Z")));
    expect(url.searchParams.get("viewparams")).toBe("lang:sv;location:3;start_date:2026-02-15 12:00");
    expect(url.searchParams.get("typeName")).toBe("lavinprognoser:published_forecasts_by_interval");
    expect(url.searchParams.get("propertyName")).not.toContain("geometry");
  });

  it("reads problems with aspects, heights, sensitivity and size", () => {
    const list = load("published_forecasts_by_interval_3_2026-02-15.json");
    expect(list).toHaveLength(12);
    const f = list.find((x) => x.id === 16066)!;
    expect(f.risk).toBe(2);
    expect(f.problems.map((p) => p.type)).toEqual(["drevsnoflak"]);
    for (const p of list.flatMap((x) => x.problems)) {
      expect(p.infoUrl).toMatch(/^https:\/\/www\.lavinprognoser\.se\/sa-laser-du-lavinprognosen\/lavinproblem\/[a-z-]+\/$/);
      expect(p.sensitivity ?? "").not.toMatch(/<|&nbsp;/);
    }
  });

  it("uses the morning correction, not the evening forecast it replaced", () => {
    const list = load("published_forecasts_by_interval_3_2026-02-15.json");
    // 18 Feb: evening forecast said 1, corrected to 2 at 08:03 and again at 08:11.
    expect(forecastInForce(list, local("2026-02-18 06:00"))?.risk).toBe(1);
    const noon = forecastFromApi(list, [], local("2026-02-18 12:00"));
    expect(noon).toMatchObject({ danger: 2, confidence: "parsed", publishedText: "onsdag 18-02-2026 09:00" });
    expect(noon.validUntil).toBe("2026-02-18T17:00:00.000Z");
  });

  it("shows the level the forecast pages showed, for every day both have", () => {
    const ids: Record<string, number> = {
      abisko_riksgransfjallen: 2,
      kebnekaisefjallen: 8,
      vastra_vindelfjallen: 1,
      sodra_lapplandsfjallen: 9,
      sodra_jamtlandsfjallen: 3,
      vastra_harjedalsfjallen: 7,
    };
    const api = readdirSync(join(DIR, "nvgis"))
      .filter((f) => f.startsWith("published_forecasts_by_interval_"))
      .flatMap(load);
    const areaOf = new Map<number, number>();
    for (const f of readdirSync(join(DIR, "nvgis")).filter((f) => f.startsWith("published_forecasts_by_interval_"))) {
      for (const x of load(f)) areaOf.set(x.id, Number(f.split("_")[4]));
    }
    let compared = 0;
    for (const file of readdirSync(join(DIR, "lavinprognoser")).filter((f) => /_\d{4}-/.test(f))) {
      const page = readForecast(extractModel(readFileSync(join(DIR, "lavinprognoser", file), "utf8")));
      const area = ids[file.replace(/_\d{4}-\d\d-\d\d\.html$/, "")];
      if (!page?.validTo || !page.validFrom || page.validTo.getTime() - page.validFrom.getTime() > 48 * 3600e3) continue;
      const at = new Date(page.validTo.getTime() - 60_000);
      const mine = api.filter((x) => areaOf.get(x.id) === area);
      const f = forecastInForce(mine, at);
      if (!f) continue;
      compared++;
      expect([file, forecastFromApi(mine, [], at).danger]).toEqual([file, page.risk]);
    }
    expect(compared).toBeGreaterThanOrEqual(10);
  });

  it("says the season is over off-season, without a level", () => {
    const now = local("2026-10-06 12:00");
    const f = forecastFromApi([], load("published_forecasts_3_now.json"), now);
    expect(f).toMatchObject({ seasonOver: true, danger: null, validUntil: null });
  });

  it("treats the pre-season note as no forecast", () => {
    const f = forecastFromApi([], load("published_forecasts_8_2026-02-18.json"), local("2026-02-10 12:00"));
    expect(f).toMatchObject({ seasonOver: true, danger: null });
  });

  it("never shows a level from a record valid for months (seen in the archive)", () => {
    // Södra Jämtland: a "Måttlig" record valid 1 Jan – 2 Mar.
    const odd = load("published_forecasts_3_2026-02-18.json");
    expect(odd[0].risk).toBe(2);
    const f = forecastFromApi([], odd, local("2026-02-18 12:00"));
    expect(f.danger).toBeNull();
    expect(f.seasonOver).toBe(false);
  });

  it("passes spring conditions and 'no danger' on as what they are, not as levels", () => {
    const base = load("published_forecasts_by_interval_3_2026-02-15.json").find((x) => x.id === 16066)!;
    const now = local("2026-02-18 12:00");
    expect(forecastFromApi([{ ...base, risk: 6, riskLabel: "Vårförhållanden" }], [], now)).toMatchObject({
      danger: null,
      special: "spring",
      riskLabel: "Vårförhållanden",
    });
    expect(forecastFromApi([{ ...base, risk: 7 }], [], now)).toMatchObject({ danger: null, special: "no-danger" });
    expect(forecastFromApi([{ ...base, risk: 0 }], [], now)).toMatchObject({ danger: null, notAssessed: true });
  });

  it("passes on the expected development, the snow report and the mountain weather", () => {
    const list = load("published_forecasts_by_interval_3_2026-02-15.json");
    const f = forecastFromApi(list, [], local("2026-02-18 12:00"));
    expect(f.trend).toMatchObject({ date: "2026-02-19", danger: 2, label: "Måttlig lavinfara" });
    expect(f.snow?.title).toBe("Rapport från området");
    expect(f.snow?.text).not.toMatch(/<|&nbsp;|mso|WordDocument/);
    expect(f.snow?.text.split("\n").length).toBeGreaterThan(2);
    expect(f.snow?.link).toMatch(/^https:\/\/(www\.)?lavinprognoser\.se\//);
    expect(f.weather).toMatchObject({ title: "Fjällväderprognos" });
    expect(f.weather?.link).toMatch(/^https:\/\//);
    // Off-season: nothing of the kind.
    expect(forecastFromApi([], load("published_forecasts_3_now.json"), local("2026-10-06 12:00")).snow).toBeNull();
  });

  it("keeps paragraphs and headings of the editor's text on their own lines", () => {
    expect(htmlToLines("<div><b>Lavinaktivitet</b><br> Inga nya laviner.</div><div>Lugnt&nbsp;väder.</div>")).toBe(
      "Lavinaktivitet\nInga nya laviner.\nLugnt väder."
    );
    expect(htmlToLines("<!--[if gte mso 9]><xml><w:WordDocument/></xml><![endif]--><div>&nbsp;</div>")).toBeNull();
  });

  it("gives one history row per day, from the latest version", () => {
    const list = load("published_forecasts_by_interval_3_2026-02-15.json");
    const rows = historyRowsFromApi("sodra-jamtlandsfjallen", list, local("2026-02-22 12:00"));
    expect(rows.find((r) => r.date === "2026-02-18")?.danger).toBe(2);
    expect(new Set(rows.map((r) => r.date)).size).toBe(rows.length);
    expect(rows.every((r) => r.danger >= 1 && r.danger <= 5)).toBe(true);
  });

  it("sums up a season day by day, with levels and the most common problems", () => {
    const list = ["2026-01-18", "2026-02-15", "2026-04-05"].flatMap((d) => load(`published_forecasts_by_interval_3_${d}.json`));
    const s = seasonSummary(list, local("2026-10-06 12:00"));
    expect(s.days.length).toBeGreaterThan(15);
    expect(new Set(s.days.map((d) => d.date)).size).toBe(s.days.length);
    expect(s.days.find((d) => d.date === "2026-02-18")?.danger).toBe(2); // the corrected level, not the evening's 1
    const total = Object.values(s.levels).reduce((a, b) => a + b, 0);
    expect(total).toBe(s.days.filter((d) => d.danger !== null).length);
    expect(s.problems[0].days).toBeGreaterThanOrEqual(s.problems[s.problems.length - 1].days);
    expect(s.firstDate! <= s.lastDate!).toBe(true);
  });

  it("knows which season it is and asks for the whole of it", () => {
    expect(currentSeasonYear(local("2026-10-06 12:00"))).toBe(2025);
    expect(currentSeasonYear(local("2026-12-20 12:00"))).toBe(2026);
    expect(new URL(seasonUrl(3, 2025)).searchParams.get("viewparams")).toBe(
      "lang:sv;location:3;start_date:2025-11-01 00:00;end_date:2026-06-15 00:00"
    );
  });
});
