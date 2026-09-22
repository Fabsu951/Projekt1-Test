import * as FileSystem from 'expo-file-system/legacy';

import { getApiUrl } from './config';
import { buildSpeciesFromLabel, findBundledSpeciesByName, type Species } from './species';

export type IdentificationResult = {
  species: Species;
  confidence: number;
};

export async function identifySpecies(photoUri: string): Promise<IdentificationResult> {
  const imageBase64 = await FileSystem.readAsStringAsync(photoUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const response = await fetch(`${getApiUrl()}/identify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64 }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Identifiering misslyckades (${response.status}): ${body}`);
  }

  const data: { label: string; confidence: number } = await response.json();
  const species = findBundledSpeciesByName(data.label) ?? buildSpeciesFromLabel(data.label);

  return { species, confidence: data.confidence };
}
