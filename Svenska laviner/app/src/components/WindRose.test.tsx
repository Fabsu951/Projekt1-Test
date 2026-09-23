import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import WindRose from "./WindRose";
import type { WindReading } from "../utils/windAnalysis";

function renderRose(readings: WindReading[]) {
  return render(<WindRose readings={readings} sourceLabel="mätningen" tableCaption="Vindlast" />);
}

describe("WindRose", () => {
  it("names both the wind direction and the loaded aspect when there is transport", () => {
    renderRose([{ windSpeed: 12, windDirection: 270 }]);
    expect(screen.getByText("Vind från V → mest vindlastat: O-vända sluttningar.")).toBeInTheDocument();
    expect(screen.getByText(/Pilen visar vindens riktning/)).toBeInTheDocument();
  });

  it("highlights the most loaded aspects in the aspect rosette", () => {
    renderRose([{ windSpeed: 12, windDirection: 270 }]);
    expect(screen.getByRole("img", { name: "Mest vindlastade väderstreck: O" })).toBeInTheDocument();
  });

  it("shows no aspect rosette when it's too calm for transport", () => {
    renderRose([{ windSpeed: 3, windDirection: 270 }]);
    expect(screen.queryByRole("img", { name: /Mest vindlastade/ })).not.toBeInTheDocument();
  });

  it("shows where the wind came from when it's too calm for transport", () => {
    const { container } = renderRose([
      { windSpeed: 3, windDirection: 110 },
      { windSpeed: 4, windDirection: 115 },
    ]);
    expect(screen.getByText(/De grå fälten visar varifrån vinden blåser/)).toBeInTheDocument();
    expect(screen.getByText("transport")).toBeInTheDocument();
    expect(container.querySelector('path[fill="#6b7c90"]')).not.toBeNull();
    expect(screen.queryByText(/Nära transportgränsen/)).not.toBeInTheDocument();
  });

  it("warns when the strongest wind is just under the transport threshold", () => {
    renderRose([{ windSpeed: 5.8, windDirection: 112 }]);
    expect(screen.getByText(/Nära transportgränsen/)).toBeInTheDocument();
  });

  it("doesn't warn about the threshold once transport is actually happening", () => {
    renderRose([{ windSpeed: 9, windDirection: 112 }]);
    expect(screen.queryByText(/Nära transportgränsen/)).not.toBeInTheDocument();
  });
});
