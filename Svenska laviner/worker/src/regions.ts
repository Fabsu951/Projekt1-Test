export interface RegionSource {
  id: string;
  /** Display name, as in app/src/data/regions.ts (used in notifications). */
  name: string;
  /** Approximate centre, as in app/src/data/regions.ts (used to place tours). */
  lat: number;
  lon: number;
  /** Candidate URL slugs, tried in order until one doesn't 404. */
  slugs: string[];
}

/**
 * Maps our internal region ids (matching app/src/data/regions.ts) to the
 * URL slugs used under lavinprognoser.se/oversikt-alla-omraden/<slug>/.
 * All six verified 2026-09-25 against archived in-season pages (see
 * src/fixtures/lavinprognoser).
 */
export const REGION_SOURCES: RegionSource[] = [
  { id: "kebnekaisefjallen", name: "Kebnekaisefjällen", lat: 67.9, lon: 18.55, slugs: ["kebnekaisefjallen"] },
  { id: "riksgransfjallen", name: "Riksgränsfjällen", lat: 68.42, lon: 18.13, slugs: ["abisko_riksgransfjallen"] },
  { id: "vastra-vindelfjallen", name: "Västra Vindelfjällen", lat: 65.82, lon: 15.08, slugs: ["vastra_vindelfjallen"] },
  { id: "sodra-lapplandsfjallen", name: "Södra Lapplandsfjällen", lat: 65.28, lon: 14.7, slugs: ["sodra_lapplandsfjallen"] },
  { id: "sodra-jamtlandsfjallen", name: "Södra Jämtlandsfjällen", lat: 63.4, lon: 13.08, slugs: ["sodra_jamtlandsfjallen"] },
  { id: "vastra-harjedalsfjallen", name: "Västra Härjedalsfjällen", lat: 62.78, lon: 12.8, slugs: ["vastra_harjedalsfjallen"] },
];
