import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import RegionList from "./RegionList";
import { REGIONS } from "../data/regions";

const { mockForecasts } = vi.hoisted(() => {
  return {
    mockForecasts: vi.fn(),
  };
});

vi.mock("../services/avalancheService", () => ({
  fetchAllForecasts: mockForecasts,
}));

mockForecasts.mockResolvedValue(
  REGIONS.map((r) => ({
    regionId: r.id,
    dangerLevel: 2,
    validFrom: "2026-01-01",
    problems: [],
    summary: "test",
    isPlaceholder: true,
  }))
);

describe("RegionList", () => {
  it("renders a card for every region with its danger level once loaded", async () => {
    render(
      <MemoryRouter>
        <RegionList />
      </MemoryRouter>
    );

    for (const region of REGIONS) {
      expect(screen.getByText(region.name)).toBeInTheDocument();
    }

    await waitFor(() => {
      expect(screen.getAllByText(/Måttlig fara/)).toHaveLength(REGIONS.length);
    });
  });

  it("shows the placeholder-data notice when forecasts are marked as placeholders", async () => {
    render(
      <MemoryRouter>
        <RegionList />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/exempeldata/)).toBeInTheDocument();
    });
  });
});
