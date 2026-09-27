import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.fn();
vi.mock("./api", () => ({ api: (...args: unknown[]) => api(...args) }));

import { seasonMonths } from "../data/tourSeasons";
import { fetchTourLines } from "./tourService";

describe("fetchTourLines", () => {
  beforeEach(() => api.mockReset());

  it("asks for the heatmap lines of the picked seasons", async () => {
    api.mockResolvedValue({ lines: [{ id: 1, points: [[67.9, 18.5], [67.91, 18.52]] }] });
    const lines = await fetchTourLines({ months: seasonMonths(["var", "tidig"]) });
    expect(api).toHaveBeenCalledWith("/tours/lines?months=11%2C12%2C3%2C4");
    expect(lines).toHaveLength(1);
  });

  it("asks for every month when no season is picked", async () => {
    api.mockResolvedValue({ lines: [] });
    await fetchTourLines({ months: seasonMonths([]) });
    expect(api).toHaveBeenCalledWith("/tours/lines?");
  });
});
