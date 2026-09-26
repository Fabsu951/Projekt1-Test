export interface RegionSource {
  id: string;
  /** Display name, as in app/src/data/regions.ts (used in notifications). */
  name: string;
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
  { id: "kebnekaisefjallen", name: "Kebnekaisefjällen", slugs: ["kebnekaisefjallen"] },
  { id: "riksgransfjallen", name: "Riksgränsfjällen", slugs: ["abisko_riksgransfjallen"] },
  { id: "vastra-vindelfjallen", name: "Västra Vindelfjällen", slugs: ["vastra_vindelfjallen"] },
  { id: "sodra-lapplandsfjallen", name: "Södra Lapplandsfjällen", slugs: ["sodra_lapplandsfjallen"] },
  { id: "sodra-jamtlandsfjallen", name: "Södra Jämtlandsfjällen", slugs: ["sodra_jamtlandsfjallen"] },
  { id: "vastra-harjedalsfjallen", name: "Västra Härjedalsfjällen", slugs: ["vastra_harjedalsfjallen"] },
];
