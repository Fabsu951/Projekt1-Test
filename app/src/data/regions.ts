import type { AvalancheRegion } from "../types/avalanche";

export const REGIONS: AvalancheRegion[] = [
  {
    id: "kebnekaisefjallen",
    name: "Kebnekaisefjällen",
    subAreas: ["Kebnekaise", "Nikkaluokta", "Tarfala"],
    lat: 67.9,
    lon: 18.55,
  },
  {
    id: "riksgransfjallen",
    name: "Riksgränsfjällen",
    subAreas: ["Abisko", "Björkliden", "Riksgränsen"],
    lat: 68.42,
    lon: 18.13,
  },
  {
    id: "vastra-vindelfjallen",
    name: "Västra Vindelfjällen",
    subAreas: ["Hemavan", "Tärnaby"],
    lat: 65.82,
    lon: 15.08,
  },
  {
    id: "sodra-lapplandsfjallen",
    name: "Södra Lapplandsfjällen",
    subAreas: ["Kittelfjäll", "Saxnäs", "Marsfjället", "Gitsfjället", "Borgafjäll"],
    lat: 65.28,
    lon: 14.7,
  },
  {
    id: "sodra-jamtlandsfjallen",
    name: "Södra Jämtlandsfjällen",
    subAreas: ["Åre", "Storulvån", "Bydalen", "Sylarna"],
    lat: 63.4,
    lon: 13.08,
  },
  {
    id: "vastra-harjedalsfjallen",
    name: "Västra Härjedalsfjällen",
    subAreas: ["Funäsfjällen", "Ljungdalen", "Helags"],
    lat: 62.78,
    lon: 12.8,
  },
];

export function getRegionById(id: string): AvalancheRegion | undefined {
  return REGIONS.find((r) => r.id === id);
}
