export type DangerLevel = 1 | 2 | 3 | 4 | 5;

export interface AvalancheRegion {
  id: string;
  name: string;
  subAreas: string[];
  lat: number;
  lon: number;
}

export type AvalancheProblem =
  | "nysno"
  | "vindpack"
  | "flaklavin"
  | "vatsno"
  | "gammal_svag_lagring";

export interface AvalancheForecast {
  regionId: string;
  dangerLevel: DangerLevel;
  validFrom: string;
  problems: AvalancheProblem[];
  summary: string;
  isPlaceholder: boolean;
}

export interface DangerLevelInfo {
  level: DangerLevel;
  label: string;
  color: string;
  description: string;
}
