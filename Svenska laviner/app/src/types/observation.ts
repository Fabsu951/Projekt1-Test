export type ObservationType = "lavin" | "sprickor" | "kollaps" | "glidsprickor" | "snotacke" | "ovrigt";

export type DangerSign =
  | "farska_laviner"
  | "skjutsprickor"
  | "wumpf"
  | "snodrev"
  | "mycket_nysno"
  | "snabb_uppvarmning";

export interface Observation {
  id: number;
  userId: number;
  author: string;
  type: ObservationType;
  lat: number;
  lon: number;
  regionId: string | null;
  observedAt: string;
  createdAt: string;
  description: string;
  imagePath: string | null;
  hidden: boolean;
  reportCount: number;
  /** Missing on observations served by workers from before migration 0004. */
  dangerSigns?: DangerSign[];
  snowDepthCm?: number | null;
}

export interface User {
  id: number;
  email: string;
  displayName: string;
  isAdmin: boolean;
  emailVerified: boolean;
  /** False until the email is verified (when the server enforces it). */
  canPost: boolean;
  /** Profile picture and experience points, from /auth/me. */
  avatarPath?: string | null;
  xp?: number;
}
