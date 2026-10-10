import { api } from "./api";
import { cached } from "./cache";

// SMHI's weather warnings per forecast area, through the worker
// (worker/src/warnings.ts). Warnings that have ended are left out, also
// from a saved answer shown without coverage.

export type WarningLevel = "yellow" | "orange" | "red" | "message";

export interface WeatherWarning {
  id: string;
  level: WarningLevel;
  event: { sv: string; en: string };
  area: { sv: string; en: string };
  start: string | null;
  end: string | null;
  text: { sv: string; en: string };
}

export const SMHI_WARNINGS_PAGE = "https://www.smhi.se/vader/varningar-och-brandrisk/varningar-och-meddelanden/varningar";

let pending: Promise<Record<string, WeatherWarning[]>> | null = null;

/** All areas' warnings; one request shared by everything on the page. */
export function fetchWarnings(now = new Date()): Promise<Record<string, WeatherWarning[]>> {
  pending ??= cached("warnings", () => api<{ regions: Record<string, WeatherWarning[]> }>("/warnings"))
    .then((r) => r.regions ?? {})
    .finally(() => setTimeout(() => (pending = null), 60_000));
  return pending.then((regions) =>
    Object.fromEntries(
      Object.entries(regions).map(([id, list]) => [id, list.filter((w) => !w.end || Date.parse(w.end) > now.getTime())])
    )
  );
}
