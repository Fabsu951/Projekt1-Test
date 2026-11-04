import { describe, expect, it } from "vitest";
import { tileInNorwayOnly } from "./norwayTiles";

const tile = (lat: number, lon: number, z: number): [number, number, number] => {
  const n = 2 ** z;
  const r = (lat * Math.PI) / 180;
  return [z, Math.floor(((lon + 180) / 360) * n), Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n)];
};

describe("Lantmäteriet tiles wholly in Norway", () => {
  it("skips tiles well inside Norway", () => {
    expect(tileInNorwayOnly(...tile(67.28, 14.4, 12))).toBe(true); // Bodø
    expect(tileInNorwayOnly(...tile(59.91, 10.75, 13))).toBe(true); // Oslo
    expect(tileInNorwayOnly(...tile(69.65, 18.96, 11))).toBe(true); // Tromsø
  });

  it("keeps tiles in Sweden and along the border", () => {
    expect(tileInNorwayOnly(...tile(67.0188, 16.3064, 15))).toBe(false); // border cairn 237
    expect(tileInNorwayOnly(...tile(67.0188, 16.25, 16))).toBe(false); // 2.5 km into Norway
    expect(tileInNorwayOnly(...tile(67.9, 18.55, 14))).toBe(false); // Kebnekaise
    expect(tileInNorwayOnly(...tile(63.2, 12.3, 12))).toBe(false); // Storlien
    expect(tileInNorwayOnly(...tile(68.42, 18.13, 13))).toBe(false); // Riksgränsen
    expect(tileInNorwayOnly(...tile(67.05, 16.0, 9))).toBe(false); // big tile reaching Sweden
    expect(tileInNorwayOnly(...tile(67.05, 16.0, 15))).toBe(false); // Sulitjelma, ~12 km from the border
  });

  it("keeps the Swedish side at border cairn 232, where the simplified outline is ~15 km off", () => {
    // Fabian's video 2026-11-04: zoomed in, the Swedish map vanished east of the cairn.
    for (const lon of [15.6, 15.7, 15.8, 15.9, 16.0]) {
      for (const z of [12, 14, 15, 16, 17]) expect(tileInNorwayOnly(...tile(66.95, lon, z))).toBe(false);
    }
  });

  it("keeps the overview zooms and places outside Norway", () => {
    expect(tileInNorwayOnly(...tile(67.28, 14.4, 7))).toBe(false);
    expect(tileInNorwayOnly(...tile(69.05, 20.8, 13))).toBe(false); // Kilpisjärvi, Finland
    expect(tileInNorwayOnly(...tile(66.0, 5.0, 12))).toBe(false); // open sea
  });
});
