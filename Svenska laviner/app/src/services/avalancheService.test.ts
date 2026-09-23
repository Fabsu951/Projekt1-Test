import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAllForecasts, toForecast, type WorkerRegionForecast } from "./avalancheService";
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

describe("toForecast", () => {
  it("maps a parsed danger level to a published forecast", () => {
    const f = toForecast(item({ danger: 3, headline: "Vindpackad snö i lä.", publishedText: "22 januari 2027, 18:00" }));
    expect(f.status).toBe("published");
    expect(f.dangerLevel).toBe(3);
    expect(f.headline).toBe("Vindpackad snö i lä.");
    expect(f.sourceUrl).toContain("kebnekaisefjallen");
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
