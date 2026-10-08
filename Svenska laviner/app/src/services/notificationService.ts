import { api } from "./api";
import { cached, USER_SCOPE } from "./cache";
import type { Badge } from "../types/social";

export interface AppNotification {
  id: number;
  kind: "follow" | "comment" | "reply" | "like" | "moderation";
  actor: { id: number; displayName: string };
  /** Ready-made Swedish sentence from the server. */
  text: string;
  /** Path in the app to open. */
  url: string;
  createdAt: string;
  read: boolean;
}

/** Fired after notifications are read, so the bell in the menu updates at once. */
export const NOTIFICATIONS_READ_EVENT = "fjallkoll:notifications-read";

export async function fetchNotifications(
  token: string
): Promise<{ notifications: AppNotification[]; unread: number; people: Record<number, Badge> }> {
  return cached(`${USER_SCOPE}notifications`, () => api("/notifications", { token }));
}

export async function fetchUnread(token: string): Promise<number> {
  return (await api<{ unread: number }>("/notifications/unread", { token })).unread;
}

export async function markAllRead(token: string): Promise<void> {
  await api("/notifications/read", { method: "POST", token, json: {} });
  window.dispatchEvent(new Event(NOTIFICATIONS_READ_EVENT));
}
