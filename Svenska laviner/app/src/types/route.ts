import type { LatLon } from "../utils/routePlan";

/** A planned route saved on the account. */
export interface PlannedRoute {
  id: number;
  title: string;
  waypoints: LatLon[];
  distanceM: number;
  ascentM: number | null;
  descentM: number | null;
  regionId: string | null;
  /** Anyone with the link can open it. */
  shared: boolean;
  /** The signed-in user owns it. */
  mine: boolean;
  createdAt: string;
  updatedAt: string;
}
