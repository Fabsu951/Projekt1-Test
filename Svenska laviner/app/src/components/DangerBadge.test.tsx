import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DangerBadge from "./DangerBadge";

describe("DangerBadge", () => {
  it("renders the level number and Swedish label", () => {
    render(<DangerBadge level={3} />);
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText(/Betydande fara/)).toBeInTheDocument();
  });

  it("uses light text on the dark level-5 background", () => {
    render(<DangerBadge level={5} />);
    const badge = screen.getByText(/Mycket stor fara/).closest("span");
    expect(badge).toHaveStyle({ color: "#fff" });
  });
});
