/// <reference types="node" />
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractModel, parseSwedishDateTime, readForecast } from "./model";
import { parseForecastHtml } from "./parse";

// Real pages from lavinprognoser.se, 2025/26 season, fetched with
// scripts/fetch-fixtures.ps1 (the site is unreachable from cloud sessions).
const FIXTURES = new URL("./fixtures/lavinprognoser/", import.meta.url);
const page = (name: string) => readFileSync(new URL(name, FIXTURES), "utf-8");

/** Midday, Swedish time, on the date a fixture was requested for. */
const middayOn = (date: string) => parseSwedishDateTime(`${date.split("-").reverse().join("-")} 12:00`)!;

describe("parseSwedishDateTime", () => {
  it("reads the site's dates as Swedish local time, winter and summer", () => {
    expect(parseSwedishDateTime("fredag 20-02-2026 18:00")?.toISOString()).toBe("2026-02-20T17:00:00.000Z");
    expect(parseSwedishDateTime("fredag 10-04-2026 18:00")?.toISOString()).toBe("2026-04-10T16:00:00.000Z");
    expect(parseSwedishDateTime("ingen tid")).toBeNull();
  });
});

describe("parseForecastHtml on real pages", () => {
  it("reads the danger level, texts and avalanche problem from the embedded model", () => {
    const result = parseForecastHtml(page("kebnekaisefjallen_2026-02-20.html"), middayOn("2026-02-20"));
    expect(result.danger).toBe(2);
    expect(result.confidence).toBe("parsed");
    expect(result.headline).toBe("Snöfattigt – men inte helt ofarligt");
    expect(result.publishedText).toBe("fredag 20-02-2026 08:00");
    expect(result.mainMessage).toMatch(/^Trots att det är midvinter/);
    // The texts are pasted from Word; none of its markup may leak through.
    expect(result.mainMessage).not.toMatch(/mso|WordDocument|false false/);

    expect(result.problems).toEqual([
      {
        type: "drevsnoflak",
        name: "Drevsnöflak",
        aspects: ["N", "NO", "V", "NV"],
        elevations: ["kalfjall"],
        metersAbove: null,
        metersBelow: null,
        sensitivity: expect.stringContaining("lätt att starta laviner"),
        size: expect.stringContaining("(storlek 2)"),
        where: expect.stringMatching(/^I tydliga läformationer/),
        infoUrl: "https://www.lavinprognoser.se/sa-laser-du-lavinprognosen/lavinproblem/drevsnoflak/",
      },
    ]);
  });

  it("keeps several problems in the forecast's order", () => {
    const result = parseForecastHtml(page("abisko_riksgransfjallen_2026-03-20.html"), middayOn("2026-03-20"));
    expect(result.danger).toBe(3);
    expect(result.problems.map((p) => p.type)).toEqual(["drevsnoflak", "bestaende-flak"]);
    expect(result.problems[1].aspects).toHaveLength(8);
  });

  it("keeps altitude limits when the forecaster gives them", () => {
    const result = parseForecastHtml(page("sodra_lapplandsfjallen_2025-12-20.html"), middayOn("2025-12-20"));
    expect(result.problems[0].metersAbove).toBe(800);
  });

  it("shows no level once the forecast has expired", () => {
    const html = page("kebnekaisefjallen_2026-02-20.html");
    const evening = parseSwedishDateTime("20-02-2026 18:30")!;
    const result = parseForecastHtml(html, evening);
    expect(result.danger).toBeNull();
    expect(result.problems).toEqual([]);
    expect(result.confidence).toBe("explicit-none");
  });

  it("reports 'Ej bedömd' (risk 0) as not assessed", () => {
    const result = parseForecastHtml(page("kebnekaisefjallen_2025-12-20.html"), middayOn("2025-12-20"));
    expect(result.danger).toBeNull();
    expect(result.notAssessed).toBe(true);
  });

  it("treats a page without a forecast as no forecast, not as not assessed", () => {
    const result = parseForecastHtml(page("sodra_jamtlandsfjallen_2026-03-20.html"), middayOn("2026-03-20"));
    expect(result.danger).toBeNull();
    expect(result.notAssessed).toBe(false);
    expect(result.seasonOver).toBe(false);
    expect(result.confidence).toBe("explicit-none");
  });

  it("refuses a level from a record that isn't a daily forecast", () => {
    // Served for 2026-01-20: "Måttlig", valid 1 Jan – 2 Mar, published 1 Mar.
    const result = parseForecastHtml(page("sodra_jamtlandsfjallen_2026-01-20.html"), middayOn("2026-01-20"));
    expect(result.danger).toBeNull();
    expect(result.problems).toEqual([]);
    expect(result.confidence).toBe("none");
  });

  it("parses every archived in-season page consistently", () => {
    const files = readdirSync(FIXTURES).filter((f: string) => /_\d{4}-\d{2}-\d{2}\.html$/.test(f));
    expect(files.length).toBe(30);

    let published = 0;
    for (const file of files) {
      const date = file.match(/_(\d{4}-\d{2}-\d{2})\.html$/)![1];
      const html = page(file);
      const result = parseForecastHtml(html, middayOn(date));
      const model = readForecast(extractModel(html));
      expect(model, file).toBeDefined();

      if (result.danger === null) {
        expect(result.problems, file).toEqual([]);
        continue;
      }
      published++;
      expect(result.danger, file).toBe(model!.risk);
      expect(result.problems.length, file).toBeGreaterThan(0);
      for (const problem of result.problems) {
        expect(problem.aspects.length, `${file} ${problem.type}`).toBeGreaterThan(0);
        expect(problem.elevations.length, `${file} ${problem.type}`).toBeGreaterThan(0);
        expect(problem.size, `${file} ${problem.type}`).toMatch(/storlek \d/);
      }
    }
    // 30 pages minus: 3 "Ej bedömd", 3 without a forecast, 2 serving the two-month Jämtland record.
    expect(published).toBe(22);
  });
});
