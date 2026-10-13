import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedItem } from "../types/social";

const auth = { user: { id: 1 } as unknown, token: "t" as string | null, loading: false };
vi.mock("../auth/useAuth", () => ({ useAuth: () => auth }));
const fetchFeed = vi.fn();
const searchPeople = vi.fn();
const setFollowing = vi.fn();
const setLiked = vi.fn();
const fetchComments = vi.fn();
const addComment = vi.fn();
vi.mock("../services/socialService", () => ({
  fetchFeed: (...a: unknown[]) => fetchFeed(...a),
  searchPeople: (...a: unknown[]) => searchPeople(...a),
  setFollowing: (...a: unknown[]) => setFollowing(...a),
  setLiked: (...a: unknown[]) => setLiked(...a),
  fetchComments: (...a: unknown[]) => fetchComments(...a),
  addComment: (...a: unknown[]) => addComment(...a),
  deleteComment: vi.fn(),
}));

import FeedPage from "./FeedPage";

const tourItem: FeedItem = {
  type: "tour",
  id: 5,
  createdAt: "2026-04-12T08:00:00Z",
  tour: {
    id: 5,
    userId: 2,
    author: "Bertil",
    title: "Sydtoppen i sol",
    description: "Hård skare på morgonen.",
    startedAt: "2026-04-12T06:30:00Z",
    durationS: 3600 * 8,
    distanceM: 18000,
    ascentM: 1500,
    descentM: 1500,
    maxElevationM: 2095,
    regionId: "kebnekaisefjallen",
    shared: true,
    visibility: "followers",
    hideEndsM: 500,
    pin: null,
    createdAt: "2026-04-12T08:00:00Z",
  },
  line: [
    [67.86, 18.58],
    [67.9, 18.52],
  ],
  likes: 2,
  likedByMe: false,
  comments: 1,
};

describe("FeedPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.user = { id: 1 };
    auth.token = "t";
  });

  it("shows what people you follow shared, and lets you like and comment", async () => {
    fetchFeed.mockResolvedValue({ items: [tourItem], nextBefore: null });
    setLiked.mockResolvedValue({ likes: 3, likedByMe: true });
    fetchComments.mockResolvedValue({
      comments: [{ id: 9, userId: 3, author: "Cecilia", body: "Hur var snön?", createdAt: "2026-04-12T09:00:00Z", canDelete: false }],
      likes: 3,
      likedByMe: true,
    });
    addComment.mockResolvedValue({
      comments: [
        { id: 9, userId: 3, author: "Cecilia", body: "Hur var snön?", createdAt: "2026-04-12T09:00:00Z", canDelete: false },
        { id: 10, userId: 1, author: "Anna", body: "Skare hela vägen", createdAt: "2026-04-12T10:00:00Z", canDelete: true },
      ],
      likes: 3,
      likedByMe: true,
    });
    render(<MemoryRouter><FeedPage /></MemoryRouter>);

    expect(await screen.findByText("Sydtoppen i sol")).toBeInTheDocument();
    expect(screen.getByText(/laddade upp en tur/)).toBeInTheDocument();
    expect(screen.getByText(/bara följare/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Bertil" })).toHaveAttribute("href", "/person/2");

    await act(async () => fireEvent.click(screen.getByRole("button", { name: /Gilla \(2\)/ })));
    expect(setLiked).toHaveBeenCalledWith("t", "tour", 5, true);
    expect(screen.getByRole("button", { name: /Gilla \(3\)/ })).toHaveAttribute("aria-pressed", "true");

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "1 kommentar" })));
    expect(await screen.findByText("Hur var snön?")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Skriv en kommentar"), { target: { value: "Skare hela vägen" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Skicka" })));
    expect(addComment).toHaveBeenCalledWith("t", "tour", 5, "Skare hela vägen");
    expect(screen.getByRole("button", { name: "2 kommentarer" })).toBeInTheDocument();
  });

  it("finds people to follow when the feed is empty", async () => {
    fetchFeed.mockResolvedValue({ items: [], nextBefore: null });
    searchPeople.mockResolvedValue([{ id: 2, displayName: "Bertil", iFollow: false }]);
    setFollowing.mockResolvedValue({ id: 2, displayName: "Bertil", iFollow: true });
    render(<MemoryRouter><FeedPage /></MemoryRouter>);
    expect(await screen.findByText(/Flödet är tomt/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Hitta kompisar"), { target: { value: "ber" } });
    const follow = await screen.findByRole("button", { name: "Följ" });
    await act(async () => fireEvent.click(follow));
    expect(setFollowing).toHaveBeenCalledWith("t", 2, true);
    expect(screen.getByRole("button", { name: "Följer ✓" })).toBeInTheDocument();
  });

  it("asks signed-out visitors to log in", () => {
    auth.user = null;
    auth.token = null;
    render(<MemoryRouter><FeedPage /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "Logga in" })).toHaveAttribute("href", "/logga-in?next=/flode");
    expect(fetchFeed).not.toHaveBeenCalled();
  });
});
