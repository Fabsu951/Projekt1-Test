import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ stations: vi.fn(), model: vi.fn(), fall: vi.fn() }));
vi.mock("../services/snowDepthService", () => ({ loadSnowDepth: m.stations }));
vi.mock("../services/snowModelService", () => ({ loadSnowModel: m.model, SENORGE_PAGE: "https://www.senorge.no" }));
vi.mock("../services/weatherService", () => ({ fetchSnowfall: m.fall }));
vi.mock("../services/cache", () => ({ cached: (_k: string, f: () => unknown) => f() }));

import SnowDepthCard from "./SnowDepthCard";
import { snowRange } from "../utils/snowRange";

describe("SnowDepthCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.model.mockResolvedValue([]);
    m.fall.mockResolvedValue(null);
    m.stations.mockResolvedValue([]);
  });

  it("lists stations with depth, height, distance and change", async () => {
    m.stations.mockResolvedValue([
      { id: 1, name: "Abisko Aut", heightM: 388, distanceKm: 12.4, depthCm: 45, measuredAt: "2027-02-14T06:00:00Z", changeCm: 8 },
      { id: 2, name: "Katterjåkk", heightM: null, distanceKm: 30, depthCm: 0, measuredAt: "2027-02-14T06:00:00Z", changeCm: -3 },
    ]);
    render(<SnowDepthCard regionId="riksgransfjallen" lat={68.4} lon={18.1} />);
    expect(await screen.findByText("45 cm")).toBeInTheDocument();
    expect(screen.getByText("388 m ö.h., 12 km bort, +8 cm på 3 dygn")).toBeInTheDocument();
    expect(screen.getByText("Barmark")).toBeInTheDocument();
    expect(screen.getByText("30 km bort, −3 cm på 3 dygn")).toBeInTheDocument();
  });

  it("shows the modelled depth at each height with the warning that it isn't evaluated in Sweden", async () => {
    m.model.mockResolvedValue([
      { lat: 67.9, lon: 18.55, altitude: 1660, date: "2026-11-09", depthCm: 38, weekChangeCm: 20, newSnow3dCm: 9 },
      { lat: 67.84, lon: 18.69, altitude: 919, date: "2026-11-09", depthCm: 0, weekChangeCm: 0, newSnow3dCm: 0 },
    ]);
    render(<SnowDepthCard regionId="kebnekaisefjallen" lat={67.9} lon={18.55} />);
    expect(await screen.findByText("På fjället, beräknat")).toBeInTheDocument();
    expect(screen.getByText("38 cm")).toBeInTheDocument();
    expect(screen.getByText("1 660 m ö.h.")).toBeInTheDocument();
    expect(screen.getByText("+20 cm senaste veckan, 9 cm nysnö senaste 3 dygnen")).toBeInTheDocument();
    expect(screen.getByText("Ingen snö")).toBeInTheDocument();
    expect(screen.getByText(/inte utvärderad på svensk sida/)).toBeInTheDocument();
    expect(screen.getByText(/säger inget om lavinfaran/)).toBeInTheDocument();
  });

  it("shows expected snowfall from SMHI as a range of centimetres", async () => {
    m.fall.mockResolvedValue({ next24hMm: 0.2, next72hMm: 6.4 });
    render(<SnowDepthCard regionId="kebnekaisefjallen" lat={67.9} lon={18.55} />);
    expect(await screen.findByText("Väntat snöfall")).toBeInTheDocument();
    expect(screen.getByText("Ingen nämnvärd snö")).toBeInTheDocument();
    expect(screen.getByText("ca 6–13 cm")).toBeInTheDocument();
  });

  it("is hidden when nothing could be loaded", async () => {
    m.stations.mockRejectedValue(new Error("offline"));
    m.fall.mockRejectedValue(new Error("offline"));
    const { container } = render(<SnowDepthCard regionId="x" lat={0} lon={0} />);
    await waitFor(() => expect(m.model).toHaveBeenCalled());
    await Promise.resolve();
    expect(container).toBeEmptyDOMElement();
  });

  it("turns water into a cautious range", () => {
    expect(snowRange(0.3)).toBeNull();
    expect(snowRange(0.6)).toBe("ca 1–2 cm");
    expect(snowRange(10)).toBe("ca 10–20 cm");
  });
});
