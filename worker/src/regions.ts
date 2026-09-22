export interface RegionSource {
  id: string;
  slug: string;
}

/**
 * Maps our internal region ids (matching app/src/data/regions.ts) to the
 * URL slugs used under lavinprognoser.se/oversikt-alla-omraden/<slug>/.
 * Confirmed slugs (seen directly in search results / linked pages):
 *   kebnekaisefjallen, vastra_vindelfjallen, sodra_jamtlandsfjallen
 * The remaining three follow the same transliteration pattern
 * (å/ä/ö -> a/o, spaces -> underscore) but have not been directly observed
 * and should be double-checked against the live site after first deploy.
 */
export const REGION_SOURCES: RegionSource[] = [
  { id: "kebnekaisefjallen", slug: "kebnekaisefjallen" },
  { id: "riksgransfjallen", slug: "riksgransfjallen" },
  { id: "vastra-vindelfjallen", slug: "vastra_vindelfjallen" },
  { id: "sodra-lapplandsfjallen", slug: "sodra_lapplandsfjallen" },
  { id: "sodra-jamtlandsfjallen", slug: "sodra_jamtlandsfjallen" },
  { id: "vastra-harjedalsfjallen", slug: "vastra_harjedalsfjallen" },
];
