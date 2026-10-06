import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAllForecasts, toForecast, toHistory, type WorkerProblem, type WorkerRegionForecast } from "./avalancheService";
import { REGIONS } from "../data/regions";

function item(overrides: Partial<WorkerRegionForecast> = {}): WorkerRegionForecast {
  return {
    regionId: "kebnekaisefjallen",
    sourceUrl: "https://www.lavinprognoser.se/oversikt-alla-omraden/kebnekaisefjallen/",
    fetchError: null,
    danger: null,
    seasonOver: false,
    notAssessed: false,
    headline: null,
    publishedText: null,
    ...overrides,
  };
}

function problem(overrides: Partial<WorkerProblem> = {}): WorkerProblem {
  return {
    type: "drevsnoflak",
    name: "Drevsnöflak",
    aspects: ["N", "NO", "V", "NV"],
    elevations: ["kalfjall"],
    metersAbove: null,
    metersBelow: null,
    sensitivity: "Det är lätt att starta laviner på enstaka branta sluttningar.",
    size: "Laviner kan bli stora nog att begrava och döda dig (storlek 2).",
    where: "I tydliga läformationer.",
    infoUrl: "https://www.lavinprognoser.se/sa-laser-du-lavinprognosen/lavinproblem/drevsnoflak/",
    ...overrides,
  };
}

describe("toForecast", () => {
  it("passes spring conditions and 'no danger' on without a level", () => {
    const spring = toForecast(item({ special: "spring", headline: "Vårförhållanden i fjällen" }));
    expect(spring).toMatchObject({ status: "spring", dangerLevel: null, headline: "Vårförhållanden i fjällen" });
    expect(toForecast(item({ special: "no-danger" }))).toMatchObject({ status: "no-danger", dangerLevel: null });
  });

  it("maps a parsed danger level to a published forecast", () => {
    const f = toForecast(item({ danger: 3, headline: "Vindpackad snö i lä.", publishedText: "22 januari 2027, 18:00" }));
    expect(f.status).toBe("published");
    expect(f.dangerLevel).toBe(3);
    expect(f.headline).toBe("Vindpackad snö i lä.");
    expect(f.sourceUrl).toContain("kebnekaisefjallen");
  });

  it("maps the forecast's avalanche problems onto our problem types", () => {
    const f = toForecast(
      item({
        danger: 2,
        mainMessage: "Snödrev kan bilda drevsnöflak.",
        problems: [problem(), problem({ type: "hangdrivor", name: "Hängdrivor" }), problem({ type: "okand-typ", name: "Ny typ" })],
      })
    );
    expect(f.mainMessage).toBe("Snödrev kan bilda drevsnöflak.");
    expect(f.problems.map((p) => [p.type, p.name])).toEqual([
      ["vindpack", "Drevsnöflak"],
      ["hangdrivor", "Hängdrivor"],
      [null, "Ny typ"],
    ]);
    expect(f.problems[0]).toMatchObject({ aspects: ["N", "NO", "V", "NV"], elevations: ["kalfjall"] });
  });

  it("drops malformed problem data instead of drawing it", () => {
    const f = toForecast(
      item({
        danger: 2,
        problems: [
          problem({ aspects: ["N", "ÖST", "S"], elevations: ["kalfjall", "moln"], infoUrl: "javascript:alert(1)" }),
          { ...problem(), name: "" },
        ],
      })
    );
    expect(f.problems).toHaveLength(1);
    expect(f.problems[0]).toMatchObject({ aspects: ["N", "S"], elevations: ["kalfjall"], infoUrl: null });
  });

  it("shows no problems without a published level, and copes with older workers", () => {
    expect(toForecast(item({ notAssessed: true, problems: [problem()] })).problems).toEqual([]);
    expect(toForecast(item({ danger: 3 })).problems).toEqual([]);
  });

  it("reports season-over and not-assessed without a danger level", () => {
    expect(toForecast(item({ seasonOver: true }))).toMatchObject({ status: "season-over", dangerLevel: null });
    expect(toForecast(item({ notAssessed: true }))).toMatchObject({ status: "not-assessed", dangerLevel: null });
  });

  it("never guesses a level for fetch errors, unparsed pages, or out-of-range values", () => {
    expect(toForecast(item({ fetchError: "HTTP 503", danger: 3 })).dangerLevel).toBeNull();
    expect(toForecast(item()).status).toBe("unavailable");
    expect(toForecast(item({ danger: 0 })).status).toBe("unavailable");
    expect(toForecast(item({ danger: 7 })).status).toBe("unavailable");
  });
});

describe("fetchAllForecasts", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns 'unavailable' for every region when no worker is configured", async () => {
    const list = await fetchAllForecasts("");
    expect(list).toHaveLength(REGIONS.length);
    expect(list.every((f) => f.status === "unavailable")).toBe(true);
  });

  it("fetches /forecasts from the worker and fills in regions it didn't return", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ regions: [item({ danger: 2 })] }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const list = await fetchAllForecasts("https://worker.example/");
    expect(fetchMock).toHaveBeenCalledWith("https://worker.example/forecasts");
    expect(list.find((f) => f.regionId === "kebnekaisefjallen")?.dangerLevel).toBe(2);
    expect(list.filter((f) => f.status === "unavailable")).toHaveLength(REGIONS.length - 1);
  });

  it("throws on an HTTP error so the offline cache can take over", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 502 })));
    await expect(fetchAllForecasts("https://worker.example")).rejects.toThrow("502");
  });
});

describe("toHistory", () => {
  it("keeps each day, with anything but a level 1–5 as no forecast", () => {
    const days = toHistory({
      days: [
        { date: "2026-02-18", danger: 2, problems: [] },
        { date: "2026-02-19", danger: null, problems: [] },
        { date: "2026-02-20", danger: 9, problems: [] },
        { date: "igår", danger: 3 },
      ],
    });
    expect(days).toEqual([
      { date: "2026-02-18", dangerLevel: 2 },
      { date: "2026-02-19", dangerLevel: null },
      { date: "2026-02-20", dangerLevel: null },
    ]);
  });

  it("returns nothing for an unexpected response", () => {
    expect(toHistory(null)).toEqual([]);
    expect(toHistory({ days: "x" })).toEqual([]);
  });
});
