export type DangerLevel = 1 | 2 | 3 | 4 | 5;

export interface AvalancheRegion {
  id: string;
  name: string;
  subAreas: string[];
  lat: number;
  lon: number;
  description: string;
  sources: Source[];
}

export type AvalancheProblem =
  | "nysno"
  | "vindpack"
  | "gammal_svag_lagring"
  | "vatsno"
  | "glidlavin";

/**
 * - published: an official forecast with a parsed danger level.
 * - season-over / not-assessed: lavinprognoser.se explicitly says there is
 *   no forecast (off-season, or the area isn't assessed today).
 * - unavailable: we couldn't fetch or confidently parse it. Never guess a
 *   level in this case — point the user at the official page instead.
 */
export type ForecastStatus = "published" | "season-over" | "not-assessed" | "unavailable";

export interface AvalancheForecast {
  regionId: string;
  status: ForecastStatus;
  /** Only set when status is "published". */
  dangerLevel: DangerLevel | null;
  /** Not scraped yet — empty unless a future source provides them. */
  problems: AvalancheProblem[];
  /** The forecast's "Huvudbudskap", when found. */
  headline: string | null;
  /** Publication time as printed on the source page, e.g. "22 september 2026, 18:00". */
  publishedText: string | null;
  /** The official forecast page for this region. */
  sourceUrl: string;
}

export interface DangerLevelInfo {
  level: DangerLevel;
  label: string;
  color: string;
  description: string;
}

export interface Source {
  label: string;
  url: string;
}
