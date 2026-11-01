import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import TerrainFinderControls from "./TerrainFinderControls";
import { DEFAULT_FILTER, type TerrainFilter } from "../utils/terrainFinder";

type FromForecast = { area: string; filter: TerrainFilter } | null;

function Harness({ start = DEFAULT_FILTER, fromForecast = null }: { start?: TerrainFilter; fromForecast?: FromForecast }) {
  const [filter, setFilter] = useState(start);
  return <TerrainFinderControls filter={filter} onChange={setFilter} fromForecast={fromForecast} />;
}

describe("TerrainFinderControls", () => {
  it("starts with every direction and picks one on the first tap", () => {
    render(<Harness />);
    expect(screen.getByText("Visar 15–25°, alla väderstreck.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "öster" }));
    expect(screen.getByRole("checkbox", { name: "öster" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("checkbox", { name: "norr" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText("Visar 15–25°, O.")).toBeInTheDocument();
  });

  it("adds neighbours with the keyboard and goes back to all directions", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("checkbox", { name: "nordost" }));
    fireEvent.keyDown(screen.getByRole("checkbox", { name: "öster" }), { key: " " });
    fireEvent.keyDown(screen.getByRole("checkbox", { name: "sydost" }), { key: "Enter" });
    expect(screen.getByText("Visar 15–25°, NO\u2060–\u2060SO.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Alla väderstreck" }));
    expect(screen.getByText("Visar 15–25°, alla väderstreck.")).toBeInTheDocument();
  });

  it("keeps the slope range in order", () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText("Lutning från"), { target: { value: "30" } });
    expect(screen.getByLabelText("till")).toHaveValue("35");
    expect(screen.getByText("Visar 30–35°, alla väderstreck.")).toBeInTheDocument();
  });

  it("takes today's forecast with one tap, only when there is one", () => {
    const { rerender } = render(<Harness />);
    expect(screen.queryByRole("button", { name: /Använd dagens prognos/ })).toBeNull();
    const fromForecast = {
      area: "Kebnekaisefjällen",
      filter: { min: 30, max: 60, sectors: [false, true, true, false, false, false, false, false] },
    };
    rerender(<Harness fromForecast={fromForecast} />);
    const button = screen.getByRole("button", { name: "Använd dagens prognos för Kebnekaisefjällen" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(button);
    expect(screen.getByText("Visar 30° och brantare, NO\u2060–\u2060O.")).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-pressed", "true");
  });
});
