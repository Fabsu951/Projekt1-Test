import type { AvalancheRegion } from "../types/avalanche";

const SNOSAKER = { label: "Snösäker", url: "https://xn--snsker-dua6l.se/" };
const LAVINPROGNOSER = { label: "lavinprognoser.se", url: "https://www.lavinprognoser.se/" };

export const REGIONS: AvalancheRegion[] = [
  {
    id: "kebnekaisefjallen",
    name: "Kebnekaisefjällen",
    subAreas: ["Kebnekaise", "Nikkaluokta", "Tarfala"],
    lat: 67.9,
    lon: 18.55,
    description:
      "Kring Sveriges högsta berg möts glaciärer, branta ryggar och teknisk terräng som skiljer sig tydligt från de flesta andra svenska fjällområden. Vädret kan skifta snabbt, och området används ofta för utbildning i fjällvandringsledarskap, lavinkunskap och alpin säkerhet — just för att terrängen rymmer nästan allt på en relativt liten yta.",
    sources: [LAVINPROGNOSER],
  },
  {
    id: "riksgransfjallen",
    name: "Riksgränsfjällen",
    subAreas: ["Abisko", "Björkliden", "Riksgränsen"],
    lat: 68.42,
    lon: 18.13,
    description:
      "Långsträckta massiv i nord–sydlig riktning med fallhöjder upp till 1100 meter. Klimatet varierar kraftigt trots korta avstånd — Riksgränsen är ett av landets nederbördsrikaste ställen medan Abisko är ett av de torraste, mindre än fyra mil bort. Abisko är en bra utgångspunkt för turer söderut, Björkliden passar familjer, och Riksgränsen har den mest utmanande terrängen utanför pist.",
    sources: [SNOSAKER, LAVINPROGNOSER],
  },
  {
    id: "vastra-vindelfjallen",
    name: "Västra Vindelfjällen",
    subAreas: ["Hemavan", "Tärnaby"],
    lat: 65.82,
    lon: 15.08,
    description:
      "Vindelfjällen är ett av Europas största skyddade naturområden (ca 560 000 hektar). De flesta toppturerna utgår från tre långa fjällryggar, vilket gör det lätt att kombinera flera toppar och åk under samma dag. Hemavan har landets näst bästa fallhöjd efter Åre, med flera partier brantare än 30°.",
    sources: [SNOSAKER, LAVINPROGNOSER],
  },
  {
    id: "sodra-lapplandsfjallen",
    name: "Södra Lapplandsfjällen",
    subAreas: ["Kittelfjäll", "Saxnäs", "Marsfjället", "Gitsfjället", "Borgafjäll"],
    lat: 65.28,
    lon: 14.7,
    description:
      "Marsfjället (1587 m) är södra Lapplands högsta topp och ligger i ett naturreservat som spänner från kalfjäll till urskog. Fjällets östra delar är högalpina med gamla glaciärnischer och branta stup, och är sällan besökta — den södra sidan från Marsliden är mer lättillgänglig. Kring Kittelfjäll finns flera toppar med kort anmarsch och bra fallhöjd nära bilväg.",
    sources: [SNOSAKER, { label: "Länsstyrelsen Västerbotten", url: "https://www.lansstyrelsen.se/vasterbotten/besoksmal/naturreservat/marsfjallet.html" }],
  },
  {
    id: "sodra-jamtlandsfjallen",
    name: "Södra Jämtlandsfjällen",
    subAreas: ["Åre", "Storulvån", "Bydalen", "Sylarna"],
    lat: 63.4,
    lon: 13.08,
    description:
      "Sylarna är Jämtlands alpina nav — ett mäktigt massiv av ryggar, spetsiga toppar och gott om fin åkning, med glaciärer, smala ryggar och branta raviner. Storsylen (1762 m) ligger strax över gränsen på norska sidan; högst på svenska sidan är Storsola/Templet (1728 m). Området får mer nederbörd än genomsnittet för Sverige, vilket goda år ger bra snömängder.",
    sources: [SNOSAKER, LAVINPROGNOSER],
  },
  {
    id: "vastra-harjedalsfjallen",
    name: "Västra Härjedalsfjällen",
    subAreas: ["Funäsfjällen", "Ljungdalen", "Helags"],
    lat: 62.78,
    lon: 12.8,
    description:
      "Helags och Sylarna utgör tillsammans Sveriges sydligaste högfjällsområde. På Helags branta östsida ligger Helagsglaciären, cirka 600 meter lång med uppskattad maxtjocklek 50 meter, och området har några av Jämtlands längsta skidåk. Helags är ett blåshål där vinterns snö ofta blåser bort — bäst snömängder byggs upp först på våren. Funäsfjällen har mjukare fjällsidor och gott om toppturer, bland annat via det lavinsäkrade området Hamra Syd.",
    sources: [SNOSAKER, { label: "Fjällvandring.com", url: "https://www.fjallvandring.com/fjallen/harjedalen/helags/" }],
  },
];

export function getRegionById(id: string): AvalancheRegion | undefined {
  return REGIONS.find((r) => r.id === id);
}
