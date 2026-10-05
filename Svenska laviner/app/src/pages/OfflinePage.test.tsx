import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OfflinePage from "./OfflinePage";
import { withCache } from "../services/cache";

vi.mock("../auth/useAuth", () => ({ useAuth: () => ({ user: null, token: null }) }));

beforeEach(() => localStorage.clear());

describe("OfflinePage", () => {
  it("lists what works offline and what needs a connection", async () => {
    render(
      <MemoryRouter>
        <OfflinePage />
      </MemoryRouter>
    );
    expect(screen.getByRole("heading", { name: "Fungerar utan täckning" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Kräver uppkoppling" })).toBeInTheDocument();
    expect(screen.getByText("Rutter sparade offline")).toBeInTheDocument();
    expect(screen.getByText("Lägga upp något")).toBeInTheDocument();
    expect(await screen.findByText(/inte hämtad än/)).toBeInTheDocument();
  });

  it("shows when the forecast was saved on this device", async () => {
    await withCache("forecasts:official", () => Promise.resolve([]));
    render(
      <MemoryRouter>
        <OfflinePage />
      </MemoryRouter>
    );
    expect(await screen.findByText(/^hämtad /)).toBeInTheDocument();
  });
});
