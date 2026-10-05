import type { Observation } from "./observation";
import type { PlannedRoute } from "./route";
import type { Tour } from "./tour";

export type ItemType = "tour" | "observation" | "route";

export interface PersonSummary {
  id: number;
  displayName: string;
  iFollow: boolean;
}

export interface Person extends PersonSummary {
  followers: number;
  following: number;
  followsMe: boolean;
  isMe: boolean;
}

export interface Reactions {
  likes: number;
  likedByMe: boolean;
  comments: number;
}

export type FeedItem =
  | ({ type: "tour"; id: number; createdAt: string; tour: Tour; line: Array<[number, number]> | null } & Reactions)
  | ({ type: "observation"; id: number; createdAt: string; observation: Observation } & Reactions)
  | ({
      type: "route";
      id: number;
      createdAt: string;
      route: PlannedRoute;
      author: { id: number; displayName: string };
    } & Reactions);

export interface Comment {
  id: number;
  userId: number;
  author: string;
  body: string;
  createdAt: string;
  canDelete: boolean;
}

export interface CommentThread {
  comments: Comment[];
  likes: number;
  likedByMe: boolean;
}
