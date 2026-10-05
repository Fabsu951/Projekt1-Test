import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = { user: { id: 1 } as unknown, token: "t" as string | null, loading: false };
vi.mock("../auth/useAuth", () => ({ useAuth: () => auth }));
const fetchNotifications = vi.fn();
const markAllRead = vi.fn(async () => {});
const fetchUnread = vi.fn();
vi.mock("../services/notificationService", () => ({
  fetchNotifications: (...a: unknown[]) => fetchNotifications(...a),
  markAllRead: (...a: unknown[]) => markAllRead(...(a as [])),
  fetchUnread: (...a: unknown[]) => fetchUnread(...a),
  NOTIFICATIONS_READ_EVENT: "read",
}));
vi.mock("../services/push", () => ({
  pushSupported: () => false,
  fetchPushKey: async () => null,
  accountPushEnabled: async () => false,
  enableAccountPush: vi.fn(),
  disableAccountPush: vi.fn(),
}));

import NotificationsPage from "./NotificationsPage";
import NotificationBell from "../components/NotificationBell";

describe("notifications", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists notifications with links, highlights unread ones and marks them read", async () => {
    fetchNotifications.mockResolvedValue({
      notifications: [
        { id: 2, kind: "comment", actor: { id: 3, displayName: "Cecilia" }, text: "Cecilia kommenterade din tur ”Sydtoppen”", url: "/turer/5", createdAt: "2026-10-05T10:00:00Z", read: false },
        { id: 1, kind: "follow", actor: { id: 2, displayName: "Bertil" }, text: "Bertil började följa dig", url: "/person/2", createdAt: "2026-10-04T10:00:00Z", read: true },
      ],
      unread: 1,
      people: {},
    });
    render(<MemoryRouter><NotificationsPage /></MemoryRouter>);
    const comment = await screen.findByRole("link", { name: /Cecilia kommenterade din tur/ });
    expect(comment).toHaveAttribute("href", "/turer/5");
    expect(comment.closest("li")).toHaveClass("notification--unread");
    expect(screen.getByRole("link", { name: /Bertil började följa dig/ }).closest("li")).not.toHaveClass("notification--unread");
    await waitFor(() => expect(markAllRead).toHaveBeenCalledWith("t"));
  });

  it("shows the unread count on the bell", async () => {
    fetchUnread.mockResolvedValue(3);
    render(<MemoryRouter><NotificationBell token="t" /></MemoryRouter>);
    expect(await screen.findByRole("link", { name: "Notiser, 3 olästa" })).toHaveTextContent("3");
  });
});
