import { describe, expect, it } from "vitest";
import { buildIndex, fold, searchPlaces, type PlaceRow } from "./placeSearch";

const ROWS: PlaceRow[] = [
  ["Abiskojaure", 68.2876, 18.5965, "h", 0],
  ["Abisko", 68.3497, 18.8306, "v", 0],
  ["Áhkká", 67.6, 17.47, "p", 2015, ["Akka", "Stortoppen"]],
  ["Storsjön", 63.18, 14.6, "l", 0],
  ["Storsjön", 67.9, 18.6, "l", 0],
  ["Kebnekaise", 67.9, 18.53, "p", 2097],
  ["Kebnekaise fjällstation", 67.877, 18.61, "h", 0],
  ["Lilla Kebnekaise", 67.88, 18.55, "p", 1800],
];
const index = buildIndex(ROWS);

describe("fold", () => {
  it("drops case, accents and Sami letters", () => {
    expect(fold("Áhkká")).toBe("ahkka");
    expect(fold("Čoalmmevárri")).toBe("coalmmevarri");
    expect(fold("Ŋuolja–Bákte")).toBe("nuolja bakte");
    expect(fold("Åre Östra")).toBe("are ostra");
  });
});

describe("searchPlaces", () => {
  it("needs at least two letters", () => {
    expect(searchPlaces(index, "a", null)).toEqual([]);
  });

  it("matches without accents and puts name starts first", () => {
    const names = searchPlaces(index, "abisko", null).map((p) => p.name);
    expect(names[0]).toBe("Abisko");
    expect(names).toContain("Abiskojaure");
  });

  it("finds a place by another name and says which", () => {
    const [hit] = searchPlaces(index, "akka", null);
    expect(hit.name).toBe("Áhkká");
    expect(hit.alsoKnownAs).toBe("Akka");
    expect(hit.ele).toBe(2015);
  });

  it("prefers the whole name, then starts, then words inside", () => {
    expect(searchPlaces(index, "kebnekaise", null).map((p) => p.name)).toEqual([
      "Kebnekaise",
      "Kebnekaise fjällstation",
      "Lilla Kebnekaise",
    ]);
  });

  it("among equal names, the one nearest the map comes first", () => {
    const north = searchPlaces(index, "storsjön", { lat: 67.8, lon: 18.5 });
    expect(north[0].lat).toBe(67.9);
    const south = searchPlaces(index, "storsjon", { lat: 63.2, lon: 14.5 });
    expect(south[0].lat).toBe(63.18);
  });

  it("shows a name once when OSM has it twice close together", () => {
    const twins = buildIndex([
      ["Kebnekaise", 67.893, 18.451, "r", 0],
      ["Kebnekaise", 67.9, 18.521, "r", 0],
      ["Kebnekaise", 63.0, 14.0, "r", 0],
    ]);
    expect(searchPlaces(twins, "kebnekaise", { lat: 67.9, lon: 18.5 })).toHaveLength(2);
  });

  it("returns nothing for gibberish", () => {
    expect(searchPlaces(index, "xyzzy", null)).toEqual([]);
  });
});
