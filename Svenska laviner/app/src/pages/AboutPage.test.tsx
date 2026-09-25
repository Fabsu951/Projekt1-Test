import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import AboutPage from "./AboutPage";

describe("AboutPage", () => {
  it("is titled after the app and lists what it offers", () => {
    render(
      <MemoryRouter>
        <AboutPage />
      </MemoryRouter>
    );
    expect(screen.getByRole("heading", { level: 1, name: "Om Fjällkoll" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Vad Fjällkoll gör" })).toBeInTheDocument();
    expect(screen.getByText("Observationer")).toBeInTheDocument();
  });

  it("shows an explicit safety disclaimer", () => {
    render(
      <MemoryRouter>
        <AboutPage />
      </MemoryRouter>
    );
    expect(
      screen.getByText(/ersätter inte officiell lavinprognos eller lavinutbildning/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/läs alltid hela/i)).toBeInTheDocument();
  });

  it("has a privacy policy explaining what's public and how to delete an account", () => {
    render(
      <MemoryRouter>
        <AboutPage />
      </MemoryRouter>
    );
    expect(screen.getByRole("heading", { name: "Integritetspolicy" })).toBeInTheDocument();
    expect(screen.getByText(/visas aldrig för andra/)).toBeInTheDocument();
    expect(screen.getByText(/radera hela ditt/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Integritetsskyddsmyndigheten/ })).toHaveAttribute("href", "https://www.imy.se");
  });

  it("links to the official avalanche forecast source", () => {
    render(
      <MemoryRouter>
        <AboutPage />
      </MemoryRouter>
    );
    const link = screen.getByRole("link", { name: /lavinprognoser\.se/i });
    expect(link).toHaveAttribute("href", "https://www.lavinprognoser.se");
  });
});
