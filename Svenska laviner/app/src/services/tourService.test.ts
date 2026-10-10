import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.fn();
vi.mock("./api", async (orig) => ({ ...(await orig<typeof import("./api")>()), api: (...args: unknown[]) => api(...args) }));

import { seasonMonths } from "../data/tourSeasons";
import { ApiError } from "./api";
import { createTour, fetchTourLines, SimilarTourError } from "./tourService";

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

describe("createTour", () => {
  it("turns the server's 'same outing' answer into an error naming the tour you already have", async () => {
    const similarTo = { id: 7, title: "Sydtoppen", startedAt: "2026-02-03T09:00:00.000Z" };
    api.mockRejectedValueOnce(new ApiError(409, "Du har redan en tur som startade samtidigt: ”Sydtoppen”.", { similarTo }));
    const tour = { title: "x", description: "", visibility: "private" as const, hideEndsM: 500, date: null, points: [] };
    const err = await createTour("tok", tour).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SimilarTourError);
    expect((err as SimilarTourError).similarTo).toEqual(similarTo);
    api.mockRejectedValueOnce(new ApiError(400, "Ogiltigt spår."));
    expect(await createTour("tok", tour).catch((e: unknown) => e)).not.toBeInstanceOf(SimilarTourError);
  });
});
