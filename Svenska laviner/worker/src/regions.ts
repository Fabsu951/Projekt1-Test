export interface RegionSource {
  id: string;
  /** Candidate URL slugs, tried in order until one doesn't 404. */
  slugs: string[];
}

/**
 * Maps our internal region ids (matching app/src/data/regions.ts) to the
 * URL slugs used under lavinprognoser.se/oversikt-alla-omraden/<slug>/.
 * Verified live 2026-09-23 (pages load): kebnekaisefjallen,
 * vastra_vindelfjallen, sodra_lapplandsfjallen, sodra_jamtlandsfjallen,
 * vastra_harjedalsfjallen. "riksgransfjallen" 404s — the official area is
 * named "Abisko/Riksgränsfjällen", so a few spellings of that are tried;
 * pin the one that works once confirmed.
 */
export const REGION_SOURCES: RegionSource[] = [
  { id: "kebnekaisefjallen", slugs: ["kebnekaisefjallen"] },
  {
    id: "riksgransfjallen",
    slugs: [
      "abisko_riksgransfjallen",
      "abiskoriksgransfjallen",
      "abisko-riksgransfjallen",
      "riksgransfjallen_abisko",
      "riksgransfjallen",
    ],
  },
  { id: "vastra-vindelfjallen", slugs: ["vastra_vindelfjallen"] },
  { id: "sodra-lapplandsfjallen", slugs: ["sodra_lapplandsfjallen"] },
  { id: "sodra-jamtlandsfjallen", slugs: ["sodra_jamtlandsfjallen"] },
  { id: "vastra-harjedalsfjallen", slugs: ["vastra_harjedalsfjallen"] },
];
