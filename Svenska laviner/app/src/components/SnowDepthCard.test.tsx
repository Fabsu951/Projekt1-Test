import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const load = vi.hoisted(() => vi.fn());
vi.mock("../services/snowDepthService", () => ({ loadSnowDepth: load }));

import SnowDepthCard from "./SnowDepthCard";

describe("SnowDepthCard", () => {
  it("lists stations with depth, height, distance and change", async () => {
    load.mockResolvedValue([
      { id: 1, name: "Abisko Aut", heightM: 388, distanceKm: 12.4, depthCm: 45, measuredAt: "2027-02-14T06:00:00Z", changeCm: 8 },
      { id: 2, name: "Katterjåkk", heightM: null, distanceKm: 30, depthCm: 0, measuredAt: "2027-02-14T06:00:00Z", changeCm: -3 },
    ]);
    render(<SnowDepthCard regionId="riksgransfjallen" lat={68.4} lon={18.1} />);
    expect(await screen.findByText("45 cm")).toBeInTheDocument();
    expect(screen.getByText("388 m ö.h. · 12 km bort · +8 cm på 3 dygn")).toBeInTheDocument();
    expect(screen.getByText("Barmark")).toBeInTheDocument();
    expect(screen.getByText("30 km bort · −3 cm på 3 dygn")).toBeInTheDocument();
  });

  it("is hidden without stations or when SMHI can't be reached", async () => {
    load.mockRejectedValue(new Error("offline"));
    const { container } = render(<SnowDepthCard regionId="x" lat={0} lon={0} />);
    await Promise.resolve();
    expect(container).toBeEmptyDOMElement();
  });
});
