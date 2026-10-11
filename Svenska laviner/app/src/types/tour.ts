import type { TrackPoint } from "../utils/trackImport";
import type { DangerSign } from "./observation";

/** Everyone, the owner's followers, or only the owner. */
export type TourVisibility = "public" | "followers" | "private";

export interface Tour {
  id: number;
  userId: number;
  author: string;
  authorIsAdmin?: boolean;
  title: string;
  description: string;
  startedAt: string;
  durationS: number | null;
  distanceM: number;
  ascentM: number;
  descentM: number;
  maxElevationM: number | null;
  regionId: string | null;
  shared: boolean;
  /** Who sees it; missing from workers deployed before followers existed. */
  visibility?: TourVisibility;
  /** Metres hidden at each end of the track for everyone but the owner. */
  hideEndsM: number;
  /** Map position after the hidden start, or null when nothing is shown. */
  pin: [number, number] | null;
  /** Warning signs seen on the tour: null/missing = not answered, [] = none seen. */
  dangerSigns?: DangerSign[] | null;
  createdAt: string;
}

export interface TourWithTrack {
  tour: Tour;
  track: TrackPoint[];
}

/** A shared tour's public line (hidden ends removed, thinned) for the heatmap. */
export interface TourLine {
  id: number;
  title?: string;
  startedAt?: string;
  points: Array<[number, number]>;
}
