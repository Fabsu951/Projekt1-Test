import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  savedArea: vi.fn(),
  downloadArea: vi.fn(),
  offlineRouteFor: vi.fn(),
  saveRouteOffline: vi.fn(),
}));
vi.mock("./mapTiles", () => ({ offlineMapsAvailable: true, mapTileUrls: () => ["tile"] }));
vi.mock("./offlineMap", () => ({ offlineSupported: () => true, savedArea: mocks.savedArea, downloadArea: mocks.downloadArea }));
vi.mock("./offlineRoutes", () => ({ offlineRouteFor: mocks.offlineRouteFor, saveRouteOffline: mocks.saveRouteOffline }));

import { prepareTripOffline } from "./tripOffline";

const route = {
  id: 3,
  title: "Sydtoppen",
  waypoints: [[67.9, 18.5], [67.91, 18.52]] as Array<[number, number]>,
  updatedAt: "2026-02-10T10:00:00.000Z",
} as never;
const analysis = { samples: [] } as never;

beforeEach(() => vi.clearAllMocks());

describe("saving the map before a tour day", () => {
  it("downloads the area's overview map once, and the route when it is new or changed", async () => {
    mocks.savedArea.mockResolvedValueOnce(null);
    mocks.offlineRouteFor.mockResolvedValueOnce({ savedAt: "2026-02-01T00:00:00.000Z" });
    expect(await prepareTripOffline("kebnekaisefjallen", { route, analysis }, () => {})).toEqual({ area: true, route: true });
    expect(mocks.downloadArea).toHaveBeenCalledWith(expect.objectContaining({ id: "kebnekaisefjallen" }), "oversikt", expect.any(Function), expect.any(Function), undefined);
    expect(mocks.saveRouteOffline).toHaveBeenCalledTimes(1);

    // Already saved, route unchanged since: nothing downloaded again.
    mocks.savedArea.mockResolvedValueOnce({ level: "detaljerad" });
    mocks.offlineRouteFor.mockResolvedValueOnce({ savedAt: "2026-02-11T00:00:00.000Z" });
    await prepareTripOffline("kebnekaisefjallen", { route, analysis }, () => {});
    expect(mocks.downloadArea).toHaveBeenCalledTimes(1);
    expect(mocks.saveRouteOffline).toHaveBeenCalledTimes(1);
  });

  it("does nothing for an unknown area", async () => {
    expect(await prepareTripOffline("okant", null, () => {})).toEqual({ area: false, route: false });
    expect(mocks.downloadArea).not.toHaveBeenCalled();
  });
});
