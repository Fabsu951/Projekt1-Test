import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DangerAdvice from "./DangerAdvice";
import { LEVEL_ADVICE } from "../data/dangerAdvice";

describe("DangerAdvice", () => {
  it("gives plain advice for the published level and says it is general", () => {
    render(<DangerAdvice level={3} />);
    expect(screen.getByRole("heading", { name: "Vad betyder det för mig?" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText(/Allmänna råd för betydande fara/)).toBeInTheDocument();
  });

  it("never calls anything safe", () => {
    for (const lines of Object.values(LEVEL_ADVICE)) {
      for (const line of lines) expect(line).not.toMatch(/säker/i);
    }
  });
});
