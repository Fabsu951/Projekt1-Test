import type { CompassSector } from "../utils/windAnalysis";

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
  | "glidlavin"
  | "hangdrivor";

/** The elevation bands lavinprognoser.se marks a problem at. */
export type Elevation = "kalfjall" | "tradgrans" | "under_tradgrans";

/** One avalanche problem as today's official forecast describes it. */
export interface ForecastProblem {
  /** Our problem type when we recognise the forecast's, else null. */
  type: AvalancheProblem | null;
  /** The name the forecast uses, e.g. "Drevsnöflak". */
  name: string;
  /** Slope aspects where the problem is found. */
  aspects: CompassSector[];
  elevations: Elevation[];
  /** Altitude limits in metres, when the forecaster gives them. */
  metersAbove: number | null;
  metersBelow: number | null;
  /** How easily avalanches start and how widespread the problem is. */
  sensitivity: string | null;
  /** Expected largest avalanche size. */
  size: string | null;
  /** Where in the terrain the problem is found. */
  where: string | null;
  /** lavinprognoser.se's page explaining this problem type. */
  infoUrl: string | null;
}

/**
 * - published: an official forecast with a parsed danger level.
 * - season-over / not-assessed: lavinprognoser.se explicitly says there is
 *   no forecast (off-season, or the area isn't assessed today).
 * - spring / no-danger: the forecast's own "Vårförhållanden" or "Ingen
 *   lavinfara" (risk 6 / 7 in Naturvårdsverket's API) — real answers that
 *   aren't levels 1–5, so they never get a level or a danger colour.
 * - unavailable: we couldn't fetch or confidently parse it. Never guess a
 *   level in this case — point the user at the official page instead.
 */
export type ForecastStatus = "published" | "season-over" | "not-assessed" | "spring" | "no-danger" | "unavailable";

export interface AvalancheForecast {
  regionId: string;
  status: ForecastStatus;
  /** Only set when status is "published". */
  dangerLevel: DangerLevel | null;
  /** Today's avalanche problems, in the forecast's order. Empty unless published. */
  problems: ForecastProblem[];
  /** The forecast's headline, when found. */
  headline: string | null;
  /** The main message below the headline. */
  mainMessage: string | null;
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
