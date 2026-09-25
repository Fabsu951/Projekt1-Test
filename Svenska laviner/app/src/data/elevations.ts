import type { Elevation } from "../types/avalanche";

/** The elevation bands as lavinprognoser.se names them. */
export const ELEVATION_LABELS: Record<Elevation, string> = {
  kalfjall: "Kalfjället",
  tradgrans: "Trädgränsen",
  under_tradgrans: "Under trädgränsen",
};
