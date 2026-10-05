import { api } from "./api";
import type { Badge, CommentThread, FeedItem, ItemType, Person, PersonSummary } from "../types/social";

export async function fetchFeed(
  token: string,
  before?: string | null
): Promise<{ items: FeedItem[]; people?: Record<number, Badge>; nextBefore: string | null }> {
  const q = before ? `?before=${encodeURIComponent(before)}` : "";
  return api(`/feed${q}`, { token });
}

export async function searchPeople(token: string, q: string): Promise<PersonSummary[]> {
  return (await api<{ people: PersonSummary[] }>(`/people?q=${encodeURIComponent(q)}`, { token })).people;
}

export async function fetchPerson(id: number, token: string | null): Promise<Person> {
  return (await api<{ person: Person }>(`/people/${id}`, { token })).person;
}

export async function fetchMyFollows(token: string): Promise<{ following: PersonSummary[]; followers: PersonSummary[] }> {
  return api("/people/me/follows", { token });
}

export async function setFollowing(token: string, id: number, follow: boolean): Promise<Person> {
  return (await api<{ person: Person }>(`/people/${id}/follow`, { method: follow ? "POST" : "DELETE", token })).person;
}

export async function fetchComments(type: ItemType, id: number, token: string | null): Promise<CommentThread> {
  return api(`/comments?type=${type}&id=${id}`, { token });
}

export async function addComment(token: string, type: ItemType, id: number, body: string): Promise<CommentThread> {
  return api("/comments", { method: "POST", token, json: { type, id, body } });
}

export async function deleteComment(token: string, commentId: number): Promise<void> {
  await api(`/comments/${commentId}`, { method: "DELETE", token });
}

export async function setLiked(
  token: string,
  type: ItemType,
  id: number,
  liked: boolean
): Promise<{ likes: number; likedByMe: boolean }> {
  return api("/likes", { method: "POST", token, json: { type, id, liked } });
}

export async function uploadAvatar(token: string, image: Blob): Promise<string> {
  const form = new FormData();
  form.set("image", image, "avatar.jpg");
  return (await api<{ avatarPath: string }>("/auth/avatar", { method: "POST", token, form })).avatarPath;
}

export async function removeAvatar(token: string, personId?: number): Promise<void> {
  await api(personId ? `/people/${personId}/avatar` : "/auth/avatar", { method: "DELETE", token });
}
