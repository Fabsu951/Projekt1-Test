import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DangerHistory from "./DangerHistory";

describe("DangerHistory", () => {
  const days = [
    { date: "2026-02-18", dangerLevel: 2 as const },
    { date: "2026-02-19", dangerLevel: null },
    { date: "2026-02-20", dangerLevel: 3 as const },
    { date: "2026-02-21", dangerLevel: 5 as const },
  ];

  it("names every day and states each level in words, not just colour", () => {
    render(<DangerHistory days={days} today="2026-02-20" />);
    expect(screen.getByText("ons")).toBeInTheDocument();
    expect(screen.getByText("Idag")).toBeInTheDocument();
    expect(screen.getByText("I morgon")).toBeInTheDocument();
    expect(screen.getByLabelText("onsdag 18 februari: 2 Måttlig fara")).toHaveTextContent("2");
    expect(screen.getByLabelText("torsdag 19 februari: ingen prognos")).toHaveTextContent("–");
    expect(screen.getByLabelText("lördag 21 februari: 5 Mycket stor fara")).toHaveTextContent("5");
  });
});
