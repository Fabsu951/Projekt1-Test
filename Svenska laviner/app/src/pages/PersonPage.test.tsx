import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Person } from "../types/social";

const auth = { user: { id: 1, isAdmin: false } as unknown, token: "tok" as string | null, loading: false };
vi.mock("../auth/useAuth", () => ({ useAuth: () => auth }));

const blockCalls: Array<[number, boolean]> = [];
let person: Person;
vi.mock("../services/socialService", () => ({
  fetchPerson: async () => person,
  removeAvatar: async () => {},
  setFollowing: async () => person,
  setBlocked: async (_token: string, id: number, block: boolean) => void blockCalls.push([id, block]),
}));
vi.mock("../services/tourService", () => ({ fetchTours: async () => [] }));
vi.mock("../services/reportService", () => ({ reportContent: async () => {} }));

import PersonPage from "./PersonPage";

function page() {
  return render(
    <MemoryRouter initialEntries={["/person/2"]}>
      <Routes>
        <Route path="/person/:id" element={<PersonPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  blockCalls.length = 0;
  person = {
    id: 2, displayName: "Bertil", iFollow: true, avatarPath: null, xp: 0, isAdmin: false,
    tours: 0, ascentM: 0, observations: 0, followers: 1, following: 0, followsMe: false, isMe: false,
    blocked: false, blockedByMe: false,
  };
});

describe("blocking from a profile", () => {
  it("asks first, then blocks and hides the follow button", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    page();
    fireEvent.click(await screen.findByRole("button", { name: "Blockera" }));
    await waitFor(() => expect(blockCalls).toEqual([[2, true]]));
    expect(window.confirm).toHaveBeenCalled();
    expect(await screen.findByText(/Du har blockerat Bertil/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Följer/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Sluta blockera" }));
    await waitFor(() => expect(blockCalls).toEqual([[2, true], [2, false]]));
  });

  it("offers no block button to someone who was blocked by the other", async () => {
    person = { ...person, iFollow: false, blocked: true, blockedByMe: false };
    page();
    await screen.findByRole("heading", { name: /Bertil/ });
    expect(screen.queryByRole("button", { name: "Blockera" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Följ" })).toBeNull();
  });
});
