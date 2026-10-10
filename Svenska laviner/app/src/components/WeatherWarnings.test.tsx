import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const warnings = vi.hoisted(() => ({
  fetchWarnings: vi.fn(),
  SMHI_WARNINGS_PAGE: "https://www.smhi.se/varningar",
}));
vi.mock("../services/warningService", () => warnings);

import WeatherWarnings, { WarningLines } from "./WeatherWarnings";

const wind = {
  id: "1-1",
  level: "orange",
  event: { sv: "Mycket hård vind", en: "Very strong wind" },
  area: { sv: "Fjällen i Norrbotten", en: "The mountains of Norrbotten" },
  start: "2026-02-13T18:00:00.000Z",
  end: "2026-02-15T06:00:00.000Z",
  text: { sv: "Västlig vind 25 m/s.", en: "Westerly wind 25 m/s." },
};

describe("WeatherWarnings", () => {
  it("lists the area's warnings with the level in words, and links to SMHI", async () => {
    warnings.fetchWarnings.mockResolvedValue({ kebnekaisefjallen: [wind] });
    render(<WeatherWarnings regionId="kebnekaisefjallen" />);
    expect(await screen.findByText("Mycket hård vind")).toBeInTheDocument();
    expect(screen.getByText("Orange varning")).toBeInTheDocument();
    expect(screen.getByText(/Fjällen i Norrbotten/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "SMHI:s varningar" })).toHaveAttribute("href", "https://www.smhi.se/varningar");
  });

  it("shows nothing for an area without warnings, or when SMHI can't be reached", async () => {
    warnings.fetchWarnings.mockResolvedValue({ kebnekaisefjallen: [wind] });
    const { container } = render(<WarningLines regionId="riksgransfjallen" />);
    warnings.fetchWarnings.mockRejectedValue(new Error("offline"));
    const other = render(<WeatherWarnings regionId="kebnekaisefjallen" />);
    await new Promise((r) => setTimeout(r, 0));
    expect(container).toBeEmptyDOMElement();
    expect(other.container).toBeEmptyDOMElement();
  });
});
