import { api } from "./api";
import { cached } from "./cache";

// Modelled snow on the mountain from seNorge (NVE and MET Norway), through
// the worker (worker/src/snowModel.ts): three 1 × 1 km cells per area at
// different heights. NVE OK'd the use (9 Nov 2026) and noted the model is
// not evaluated on the Swedish side; the card says so.

export interface SnowCell {
  lat: number;
  lon: number;
  altitude: number | null;
  /** Swedish date (YYYY-MM-DD) the numbers are for. */
  date: string;
  depthCm: number | null;
  weekChangeCm: number | null;
  newSnow3dCm: number | null;
}

export const SENORGE_PAGE = "https://www.senorge.no";

/** The area's cells, highest first; an empty list when the model can't be reached. */
export async function loadSnowModel(regionId: string): Promise<SnowCell[]> {
  try {
    const answer = await cached(`snow-model:${regionId}`, () =>
      api<{ cells?: SnowCell[] }>(`/snow/model?region=${encodeURIComponent(regionId)}`),
    );
    return (answer.cells ?? []).filter((c) => c.depthCm !== null);
  } catch {
    return [];
  }
}
