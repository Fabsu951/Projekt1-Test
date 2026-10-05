import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import OfflineBanner from "./OfflineBanner";
import { SHOWING_SAVED_EVENT } from "../services/cache";

afterEach(() => vi.restoreAllMocks());

function renderBanner() {
  return render(
    <MemoryRouter>
      <OfflineBanner />
    </MemoryRouter>
  );
}

describe("OfflineBanner", () => {
  it("is hidden when online", () => {
    renderBanner();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows when the connection drops and links to the offline page", () => {
    renderBanner();
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(screen.getByRole("status")).toHaveTextContent("Du är offline");
    expect(screen.getByRole("link", { name: "Vad fungerar utan täckning?" })).toHaveAttribute("href", "/offline");
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("says when a page shows saved data", () => {
    renderBanner();
    act(() => {
      window.dispatchEvent(new CustomEvent(SHOWING_SAVED_EVENT, { detail: { cachedAt: "2026-02-03T07:15:00Z" } }));
    });
    expect(screen.getByRole("status")).toHaveTextContent("Ingen kontakt med servern");
    expect(screen.getByRole("status")).toHaveTextContent("Visar det som sparades");
  });
});
