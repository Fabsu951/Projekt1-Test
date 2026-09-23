import type { AvalancheForecast, AvalancheProblem, DangerLevel } from "../types/avalanche";
import { REGIONS } from "../data/regions";

/**
 * Naturvårdsverket publicerar Sveriges officiella lavinprognoser på
 * lavinprognoser.se (dagligen kl 18, mitten av december–mitten av maj) och
 * tillgängliggör historiken som öppna data (CC0) via oppnadata.naturvardsverket.se.
 * Den exakta REST/WFS-kontraktet för att hämta *dagens* prognos per område har
 * inte kunnat verifieras härifrån (nätverksåtkomst till naturvardsverket.se
 * blockeras i den här sandboxmiljön). Den här filen är den enda platsen som
 * behöver bytas ut: ersätt `fetchPlaceholderForecast` med ett riktigt
 * `fetch(...)`-anrop mot rätt endpoint/GeoServer-lager när det är verifierat,
 * och behåll samma returtyp (`AvalancheForecast`) så resten av appen är opåverkad.
 */

const PROBLEM_POOL: AvalancheProblem[] = [
  "nysno",
  "vindpack",
  "gammal_svag_lagring",
  "vatsno",
  "glidlavin",
];

function seedFromString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

async function fetchPlaceholderForecast(regionId: string): Promise<AvalancheForecast> {
  const today = new Date().toISOString().slice(0, 10);
  const seed = seedFromString(regionId + today);

  const dangerLevel = ((seed % 4) + 1) as DangerLevel;
  const problemCount = (seed % 2) + 1;
  const problems = PROBLEM_POOL.filter((_, i) => (seed >> i) % 3 === 0).slice(
    0,
    problemCount
  );

  return {
    regionId,
    dangerLevel,
    validFrom: today,
    problems: problems.length > 0 ? problems : ["vindpack"],
    summary:
      "Exempeldata — verklig prognos från Naturvårdsverkets lavinprognoser.se är inte inkopplad ännu.",
    isPlaceholder: true,
  };
}

export async function fetchForecast(regionId: string): Promise<AvalancheForecast> {
  return fetchPlaceholderForecast(regionId);
}

export async function fetchAllForecasts(): Promise<AvalancheForecast[]> {
  return Promise.all(REGIONS.map((r) => fetchForecast(r.id)));
}
