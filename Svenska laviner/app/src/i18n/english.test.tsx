import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import NotFoundPage from "../pages/NotFoundPage";
import { compass, useLangForTest } from "./index";

afterEach(() => {
  useLangForTest("sv");
  localStorage.setItem("fjallkoll:language", "sv");
});

describe("the English version", () => {
  it("shows pages in English", () => {
    useLangForTest("en");
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>
    );
    expect(screen.getByRole("heading", { name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "To the avalanche forecasts" })).toBeInTheDocument();
  });

  it("translates data labels read when the app starts", async () => {
    localStorage.setItem("fjallkoll:language", "en");
    vi.resetModules();
    const { getDangerInfo } = await import("../data/dangerScale");
    const { PROBLEM_LABELS } = await import("../data/avalancheProblems");
    expect(getDangerInfo(3).label).toBe("Considerable");
    expect(PROBLEM_LABELS.vindpack.label).toBe("Wind slab");
  });

  it("writes compass points with E and W", () => {
    useLangForTest("en");
    expect(["N", "NO", "O", "SO", "S", "SV", "V", "NV"].map(compass)).toEqual(["N", "NE", "E", "SE", "S", "SW", "W", "NW"]);
    useLangForTest("sv");
    expect(compass("NO")).toBe("NO");
  });
});
