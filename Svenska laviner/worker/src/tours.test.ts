import { describe, expect, it } from "vitest";
import { nearestRegion, parseMonths } from "./tours";

describe("nearestRegion", () => {
  it("places a tour in the forecast region nearest its start", () => {
    expect(nearestRegion([67.91, 18.51, null, null])).toBe("kebnekaisefjallen"); // Kebnekaise fjällstation
    expect(nearestRegion([68.43, 18.13, null, null])).toBe("riksgransfjallen");
    expect(nearestRegion([63.39, 13.08, null, null])).toBe("sodra-jamtlandsfjallen"); // Åre
  });

  it("leaves tours far from every region without one", () => {
    expect(nearestRegion([59.33, 18.07, null, null])).toBeNull(); // Stockholm
  });
});

describe("parseMonths", () => {
  it("turns a season filter into two-digit months", () => {
    expect(parseMonths("12,1,2")).toEqual(["12", "01", "02"]);
    expect(parseMonths("4,4,13,x")).toEqual(["04"]);
    expect(parseMonths(null)).toEqual([]);
  });
});
