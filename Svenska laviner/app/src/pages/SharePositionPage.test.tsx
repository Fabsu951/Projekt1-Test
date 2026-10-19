import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ value: { user: { id: 1 }, token: "tok", loading: false } as { user: unknown; token: string | null; loading: boolean } }));
const geo = vi.hoisted(() => ({ getCurrentPosition: vi.fn() }));
const service = vi.hoisted(() => ({
  fetchMyShare: vi.fn(),
  fetchSharedWithMe: vi.fn(),
  startSharing: vi.fn(),
  stopSharing: vi.fn(),
  sendPosition: vi.fn(),
  activeShare: vi.fn(async () => null),
  lingeringShare: vi.fn(async () => null),
}));
vi.mock("../auth/useAuth", () => ({ useAuth: () => auth.value }));
vi.mock("@capacitor/geolocation", () => ({ Geolocation: geo }));
vi.mock("../services/locationShare", async (orig) => ({ ...(await orig<typeof import("../services/locationShare")>()), ...service }));

import SharePositionPage from "./SharePositionPage";

const person = (id: number, displayName: string, companion = false) => ({ id, displayName, avatarPath: null, xp: 0, companion });
const show = () =>
  render(
    <MemoryRouter>
      <SharePositionPage />
    </MemoryRouter>
  );

describe("SharePositionPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.value = { user: { id: 1 }, token: "tok", loading: false };
    service.fetchSharedWithMe.mockResolvedValue([]);
  });

  it("always says it is no transceiver and to call 112", () => {
    auth.value = { user: null, token: null, loading: false };
    show();
    expect(screen.getByText(/Ersätter inte sändare\/mottagare, spade och sond/)).toBeInTheDocument();
    expect(screen.getByText("Vid en olycka: ring 112.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Logga in" })).toBeInTheDocument();
  });

  it("starts with today's tour company ticked and sends the first position", async () => {
    service.fetchMyShare.mockResolvedValue({ share: null, candidates: [person(3, "Cecilia", true), person(2, "Bertil")] });
    geo.getCurrentPosition.mockResolvedValue({ coords: { latitude: 67.9, longitude: 18.5, accuracy: 9.6 } });
    service.startSharing.mockResolvedValue({ startedAt: "", endsAt: "2026-02-14T16:00:00.000Z", position: null, viewers: [] });
    show();
    const cecilia = await screen.findByRole("checkbox", { name: "Cecilia" });
    expect(cecilia).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Bertil" })).not.toBeChecked();
    expect(screen.getByRole("group", { name: "Med på dagens tur" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "4 timmar" }));
    fireEvent.click(screen.getByRole("button", { name: "Börja dela" }));
    await waitFor(() => expect(service.startSharing).toHaveBeenCalledWith("tok", 1, [3], 4));
    expect(service.sendPosition).toHaveBeenCalledWith("tok", { lat: 67.9, lon: 18.5, accuracy: 10 });
  });

  it("doesn't start without location access, and says how to allow it", async () => {
    service.fetchMyShare.mockResolvedValue({ share: null, candidates: [person(2, "Bertil")] });
    geo.getCurrentPosition.mockRejectedValue(new Error("denied"));
    show();
    fireEvent.click(await screen.findByRole("checkbox", { name: "Bertil" }));
    fireEvent.click(screen.getByRole("button", { name: "Börja dela" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Tillåt platstjänster för Snöläge");
    expect(service.startSharing).not.toHaveBeenCalled();
  });

  it("shows a running share with who sees it, and stops it", async () => {
    const share = {
      startedAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + 3600_000).toISOString(),
      position: { lat: 67.9, lon: 18.5, accuracy: 12, at: new Date().toISOString() },
      viewers: [person(2, "Bertil"), person(3, "Cecilia")],
    };
    service.fetchMyShare.mockResolvedValueOnce({ share, candidates: [] }).mockResolvedValue({ share: null, candidates: [] });
    service.stopSharing.mockResolvedValue(undefined);
    show();
    expect(await screen.findByText("Ser den: Bertil och Cecilia.")).toBeInTheDocument();
    expect(screen.getByText("Senast skickad nyss, ungefär ±12 m.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Stoppa delningen" }));
    await waitFor(() => expect(service.stopSharing).toHaveBeenCalledWith("tok"));
    expect(await screen.findByText(/Du kan dela med dem du följer/)).toBeInTheDocument();
  });

  it("lists people sharing with you", async () => {
    service.fetchMyShare.mockResolvedValue({ share: null, candidates: [] });
    service.fetchSharedWithMe.mockResolvedValue([
      { ...person(4, "David"), startedAt: "", endsAt: new Date(Date.now() + 3600_000).toISOString(), position: { lat: 67.9, lon: 18.5, accuracy: 5, at: new Date(Date.now() - 4 * 60_000).toISOString() } },
    ]);
    show();
    expect(await screen.findByRole("link", { name: "David" })).toHaveAttribute("href", "/person/4");
    expect(screen.getByText(/Position för 4 min sedan, delar till kl\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Visa på kartan" })).toHaveAttribute("href", "/karta?kompisar=1");
  });

  it("shows your last point after a share ran out, and removes it", async () => {
    const endsAt = new Date(Date.now() - 30 * 60_000).toISOString();
    service.fetchMyShare
      .mockResolvedValueOnce({
        share: null,
        lingering: { endsAt, keptUntil: new Date(Date.now() + 23 * 3600_000).toISOString(), position: { lat: 67.9, lon: 18.5, accuracy: 9, at: endsAt } },
        candidates: [],
      })
      .mockResolvedValue({ share: null, lingering: null, candidates: [] });
    service.stopSharing.mockResolvedValue(undefined);
    show();
    expect(await screen.findByRole("heading", { name: "Din senaste position syns fortfarande" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ta bort min position" }));
    await waitFor(() => expect(service.stopSharing).toHaveBeenCalledWith("tok"));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Din senaste position syns fortfarande" })).not.toBeInTheDocument());
  });

  it("marks a friend's share that ran out without being stopped, and says to call 112", async () => {
    service.fetchMyShare.mockResolvedValue({ share: null, lingering: null, candidates: [] });
    const endsAt = new Date(Date.now() - 20 * 60_000).toISOString();
    service.fetchSharedWithMe.mockResolvedValue([
      { ...person(4, "David"), startedAt: "", endsAt, ended: true, keptUntil: new Date(Date.now() + 3600_000).toISOString(), position: { lat: 67.9, lon: 18.5, accuracy: 5, at: new Date(Date.now() - 50 * 60_000).toISOString() } },
    ]);
    show();
    expect(await screen.findByText(/Delningen tog slut kl\. .* utan att stoppas\. Senast kända position för 50 min sedan/)).toBeInTheDocument();
    expect(screen.getByText(/ring 112 och berätta var och när positionen skickades/)).toBeInTheDocument();
  });
});
