import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ForecastProblems from "./ForecastProblems";
import type { ForecastProblem } from "../types/avalanche";

const DREVSNO: ForecastProblem = {
  type: "vindpack",
  name: "Drevsnöflak",
  aspects: ["N", "NO", "V", "NV"],
  elevations: ["kalfjall", "tradgrans"],
  metersAbove: 800,
  metersBelow: null,
  sensitivity: "Det är lätt att starta laviner på enstaka branta sluttningar.",
  size: "Laviner kan bli stora nog att begrava och döda dig (storlek 2).",
  where: "I tydliga läformationer som rännor.",
  infoUrl: "https://www.lavinprognoser.se/sa-laser-du-lavinprognosen/lavinproblem/drevsnoflak/",
};

describe("ForecastProblems", () => {
  it("shows where the problem is, how sensitive it is and how big it gets", () => {
    render(<ForecastProblems problems={[DREVSNO]} />);
    expect(screen.getByRole("heading", { name: "Drevsnöflak" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Utsatta väderstreck: N, NO, V, NV" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Utsatta höjder: Kalfjället, Trädgränsen" })).toBeInTheDocument();
    expect(screen.getByText("Kalfjället, Trädgränsen, över 800 m")).toBeInTheDocument();
    expect(screen.getByText(/storlek 2/)).toBeInTheDocument();
    expect(screen.getByText(/rännor/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Mer om drevsnöflak/ })).toHaveAttribute("href", DREVSNO.infoUrl);
  });

  it("explains the problem and how to handle it", () => {
    render(<ForecastProblems problems={[DREVSNO]} />);
    expect(screen.getByText("Vad är drevsnöflak?")).toBeInTheDocument();
    expect(screen.getByText(/Undvik branta läsidor där den har samlats/)).toBeInTheDocument();
  });

  it("says 'Alla väderstreck' rather than listing all eight", () => {
    render(<ForecastProblems problems={[{ ...DREVSNO, aspects: ["N", "NO", "O", "SO", "S", "SV", "V", "NV"] }]} />);
    expect(screen.getByText("Alla väderstreck")).toBeInTheDocument();
  });

  it("still shows a problem type we have no icon for", () => {
    render(<ForecastProblems problems={[{ ...DREVSNO, type: null, name: "Ny typ" }]} />);
    expect(screen.getByRole("heading", { name: "Ny typ" })).toBeInTheDocument();
  });
});
