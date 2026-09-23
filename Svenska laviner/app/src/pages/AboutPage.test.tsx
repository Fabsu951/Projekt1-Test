import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AboutPage from "./AboutPage";

describe("AboutPage", () => {
  it("shows an explicit safety disclaimer", () => {
    render(<AboutPage />);
    expect(
      screen.getByText(/ersätter inte officiell lavinprognos eller lavinutbildning/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/exempeldata/i)).toBeInTheDocument();
  });

  it("links to the official avalanche forecast source", () => {
    render(<AboutPage />);
    const link = screen.getByRole("link", { name: /lavinprognoser\.se/i });
    expect(link).toHaveAttribute("href", "https://www.lavinprognoser.se");
  });
});
