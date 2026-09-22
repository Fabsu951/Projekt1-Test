import { SPECIES_BY_TAXON_ID, type Species } from './species';

export type IdentificationResult = {
  species: Species;
  confidence: number;
};

/**
 * Stand-in for the real identifier. The plan is to swap this for the
 * on-device iNaturalist "Seek" TFLite model (offline, no account/network
 * needed) — see the tech-stack notes. Keeping the same return shape means
 * that swap only touches this file.
 */
export async function identifySpecies(photoUri: string): Promise<IdentificationResult> {
  await new Promise((resolve) => setTimeout(resolve, 1200));

  const taxonIds = Object.keys(SPECIES_BY_TAXON_ID);
  const randomTaxonId = taxonIds[Math.floor(Math.random() * taxonIds.length)];

  return {
    species: SPECIES_BY_TAXON_ID[randomTaxonId],
    confidence: 0.7 + Math.random() * 0.3,
  };
}
