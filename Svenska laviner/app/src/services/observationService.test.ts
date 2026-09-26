import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./api", () => ({ api: vi.fn(async () => ({ observations: [], observation: {} })) }));
import { api } from "./api";
import { createObservation, fetchObservations } from "./observationService";

const mockApi = vi.mocked(api);
afterEach(() => mockApi.mockClear());

describe("fetchObservations", () => {
  it("passes region, type and age filters to the worker", async () => {
    await fetchObservations({ region: "kebnekaisefjallen", type: "kollaps", days: 7, limit: 100 });
    expect(mockApi).toHaveBeenCalledWith("/observations?region=kebnekaisefjallen&type=kollaps&days=7&limit=100");
  });

  it("leaves out filters that aren't set", async () => {
    await fetchObservations({ limit: 100 });
    expect(mockApi).toHaveBeenCalledWith("/observations?limit=100");
  });
});

describe("createObservation", () => {
  const base = {
    type: "lavin",
    lat: 68,
    lon: 18.5,
    regionId: "kebnekaisefjallen",
    observedAt: new Date("2027-01-22T10:00:00Z"),
    description: "Färsk flaklavin på NO-sluttning.",
    image: null,
  };

  it("sends every ticked warning sign and the snow depth", async () => {
    await createObservation("t", { ...base, dangerSigns: ["farska_laviner", "snodrev"], snowDepthCm: 120 });
    const form = mockApi.mock.calls[0][1]!.form!;
    expect(form.getAll("dangerSigns")).toEqual(["farska_laviner", "snodrev"]);
    expect(form.get("snowDepthCm")).toBe("120");
  });

  it("sends no snow depth when it wasn't given", async () => {
    await createObservation("t", { ...base, dangerSigns: [], snowDepthCm: null });
    const form = mockApi.mock.calls[0][1]!.form!;
    expect(form.getAll("dangerSigns")).toEqual([]);
    expect(form.has("snowDepthCm")).toBe(false);
  });
});
