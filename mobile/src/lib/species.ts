/**
 * Minimal bundled species reference, standing in for a real GBIF/iNaturalist
 * taxonomy export. Keyed by taxonId so it lines up with whatever the
 * identification model (real or stub) returns.
 */
export type Species = {
  taxonId: string;
  commonName: string;
  scientificName: string;
  family: string;
  rarity: 'common' | 'uncommon' | 'rare';
};

export const SPECIES_BY_TAXON_ID: Record<string, Species> = {
  '1': { taxonId: '1', commonName: 'Nötskrika', scientificName: 'Garrulus glandarius', family: 'Corvidae', rarity: 'common' },
  '2': { taxonId: '2', commonName: 'Rådjur', scientificName: 'Capreolus capreolus', family: 'Cervidae', rarity: 'common' },
  '3': { taxonId: '3', commonName: 'Igelkott', scientificName: 'Erinaceus europaeus', family: 'Erinaceidae', rarity: 'uncommon' },
  '4': { taxonId: '4', commonName: 'Kungsörn', scientificName: 'Aquila chrysaetos', family: 'Accipitridae', rarity: 'rare' },
  '5': { taxonId: '5', commonName: 'Ekorre', scientificName: 'Sciurus vulgaris', family: 'Sciuridae', rarity: 'common' },
};

export function xpForRarity(rarity: Species['rarity']): number {
  switch (rarity) {
    case 'rare':
      return 100;
    case 'uncommon':
      return 40;
    case 'common':
    default:
      return 10;
  }
}

/** Case-insensitive lookup against the small curated list above. */
export function findBundledSpeciesByName(label: string): Species | undefined {
  const normalized = label.trim().toLowerCase();
  return Object.values(SPECIES_BY_TAXON_ID).find(
    (s) => s.commonName.toLowerCase() === normalized || s.scientificName.toLowerCase() === normalized
  );
}

/**
 * Wraps a raw label from the vision API (no family/rarity data) into the
 * same Species shape the rest of the app expects. taxonId is derived from
 * the label itself since the API doesn't give us a stable identifier.
 */
export function buildSpeciesFromLabel(label: string): Species {
  const taxonId = `label:${label.trim().toLowerCase().replace(/\s+/g, '-')}`;
  return {
    taxonId,
    commonName: label,
    scientificName: '',
    family: 'Okänd',
    rarity: 'common',
  };
}
