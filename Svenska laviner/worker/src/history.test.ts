/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { addDays, historyRow, historyWindow, type HistoryRow } from "./history";
import { parseSwedishDateTime } from "./model";
import { parseForecastHtml } from "./parse";

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/lavinprognoser/${name}`, import.meta.url), "utf-8");

const row = (date: string, danger: number): HistoryRow => ({ regionId: "kebnekaisefjallen", date, danger, problems: [] });

describe("historyRow", () => {
  it("records a forecast under the Swedish date it is valid until", () => {
    // Published Thursday 19 March 18:00, valid until Friday 20 March 18:00.
    const evening = parseSwedishDateTime("19-03-2026 20:00")!;
    const parsed = parseForecastHtml(fixture("abisko_riksgransfjallen_2026-03-20.html"), evening);
    expect(historyRow("riksgransfjallen", parsed)).toEqual({
      regionId: "riksgransfjallen",
      date: "2026-03-20",
      danger: 3,
      problems: ["drevsnoflak", "bestaende-flak"],
    });
  });

  it("records nothing without a published level", () => {
    const parsed = parseForecastHtml(fixture("kebnekaisefjallen_2025-12-20.html"), parseSwedishDateTime("20-12-2025 12:00")!);
    expect(historyRow("kebnekaisefjallen", parsed)).toBeNull();
  });
});

describe("historyWindow", () => {
  it("lists every day up to today, with gaps as null", () => {
    const days = historyWindow([row("2026-02-18", 2), row("2026-02-20", 3)], "2026-02-20", 4);
    expect(days.map((d) => [d.date, d.danger])).toEqual([
      ["2026-02-17", null],
      ["2026-02-18", 2],
      ["2026-02-19", null],
      ["2026-02-20", 3],
    ]);
  });

  it("ends tomorrow once tomorrow's forecast is out", () => {
    const days = historyWindow([row("2026-02-20", 2), row("2026-02-21", 3)], "2026-02-20", 3);
    expect(days.map((d) => d.date)).toEqual(["2026-02-19", "2026-02-20", "2026-02-21"]);
  });

  it("adds days across month and year ends", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });
});
