import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import SafetyGuide from "./SafetyGuide";
import { PROBLEM_LABELS } from "../data/avalancheProblems";
import { DANGER_SCALE } from "../data/dangerScale";

describe("SafetyGuide", () => {
  // "Så läser du lavinprognosen" points to the danger scale "nedan" and the
  // avalanche problems "ovan", so both must actually be on this page.
  it("shows the danger scale and every avalanche problem it refers to", () => {
    render(
      <MemoryRouter>
        <SafetyGuide />
      </MemoryRouter>
    );
    expect(screen.getByRole("heading", { name: "Lavinskalan" })).toBeInTheDocument();
    for (const info of DANGER_SCALE) {
      expect(screen.getByText(info.label)).toBeInTheDocument();
    }
    const problems = screen.getByRole("heading", { name: "Lavinproblemen" }).closest("section")!;
    for (const info of Object.values(PROBLEM_LABELS)) {
      expect(within(problems).getByText(info.label, { selector: "strong" })).toBeInTheDocument();
    }
  });
});
