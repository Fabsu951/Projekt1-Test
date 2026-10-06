import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import RouteForecastCheck from "./RouteForecastCheck";
import type { AvalancheForecast, ForecastProblem } from "../types/avalanche";
import type { RouteForecastCheck as Check } from "../utils/routeForecast";

const forecast = (over: Partial<AvalancheForecast> = {}): AvalancheForecast => ({
  regionId: "kebnekaisefjallen",
  status: "published",
  dangerLevel: 3,
  problems: [],
  headline: null,
  mainMessage: null,
  publishedText: null,
  sourceUrl: "https://www.lavinprognoser.se/x",
  ...over,
});

const problem: ForecastProblem = {
  type: null,
  name: "Drevsnöflak",
  aspects: [],
  elevations: [],
  metersAbove: null,
  metersBelow: null,
  sensitivity: null,
  size: null,
  where: null,
  infoUrl: null,
};

describe("RouteForecastCheck", () => {
  it("names the problems the route crosses, and those it doesn't", () => {
    const check: Check = {
      regionId: "kebnekaisefjallen",
      treelineM: 650,
      steepM: 600,
      flagged: [],
      problems: [
        { problem: { ...problem }, lengthM: 410, sectors: ["NO", "O"], bands: ["kalfjall"] },
        { problem: { ...problem, name: "Nysnöflak" }, lengthM: 0, sectors: [], bands: [] },
      ],
    };
    render(<MemoryRouter><RouteForecastCheck regionName="Kebnekaisefjällen" forecast={forecast()} check={check} /></MemoryRouter>);
    expect(screen.getByText(/ca 400 m brant mark/)).toHaveTextContent("mot NO, O – kalfjället");
    expect(screen.getByText(/ingen brant mark under rutten/)).toBeInTheDocument();
    expect(screen.getByText(/betyder inte att rutten är säker/)).toBeInTheDocument();
  });

  it("compares nothing without a published forecast", () => {
    render(
      <MemoryRouter>
        <RouteForecastCheck regionName="Kebnekaisefjällen" forecast={forecast({ status: "season-over", dangerLevel: null })} check={null} />
      </MemoryRouter>
    );
    expect(screen.getByText(/ingen publicerad lavinprognos för Kebnekaisefjällen/)).toBeInTheDocument();
    expect(screen.getByText("Utanför säsong")).toBeInTheDocument();
  });

  it("says when the route is outside every forecast area", () => {
    render(<MemoryRouter><RouteForecastCheck regionName={null} forecast={null} check={null} /></MemoryRouter>);
    expect(screen.getByText(/utanför lavinprognosområdena/)).toBeInTheDocument();
  });
});
