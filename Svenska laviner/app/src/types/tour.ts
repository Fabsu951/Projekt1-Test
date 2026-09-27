import type { TrackPoint } from "../utils/trackImport";

export interface Tour {
  id: number;
  userId: number;
  author: string;
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
  /** Metres hidden at each end of the track for everyone but the owner. */
  hideEndsM: number;
  /** Map position after the hidden start, or null when nothing is shown. */
  pin: [number, number] | null;
  createdAt: string;
}

export interface TourWithTrack {
  tour: Tour;
  track: TrackPoint[];
}

/** A shared tour's public line (hidden ends removed, thinned) for the heatmap. */
export interface TourLine {
  id: number;
  points: Array<[number, number]>;
}
