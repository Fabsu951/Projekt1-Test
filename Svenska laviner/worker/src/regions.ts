export interface RegionSource {
  id: string;
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
  { id: "kebnekaisefjallen", slugs: ["kebnekaisefjallen"] },
  { id: "riksgransfjallen", slugs: ["abisko_riksgransfjallen"] },
  { id: "vastra-vindelfjallen", slugs: ["vastra_vindelfjallen"] },
  { id: "sodra-lapplandsfjallen", slugs: ["sodra_lapplandsfjallen"] },
  { id: "sodra-jamtlandsfjallen", slugs: ["sodra_jamtlandsfjallen"] },
  { id: "vastra-harjedalsfjallen", slugs: ["vastra_harjedalsfjallen"] },
];
