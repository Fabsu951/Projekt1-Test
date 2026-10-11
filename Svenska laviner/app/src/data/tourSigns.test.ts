import { describe, expect, it } from "vitest";
import { toggleTourSign } from "./tourSigns";

describe("warning signs on a tour", () => {
  it("keeps 'none seen' apart from signs and from 'not answered'", () => {
    expect(toggleTourSign(null, "none")).toEqual([]);
    expect(toggleTourSign([], "none")).toBeNull();
    expect(toggleTourSign([], "wumpf")).toEqual(["wumpf"]);
    expect(toggleTourSign(["wumpf"], "none")).toEqual([]);
    expect(toggleTourSign(["wumpf", "snodrev"], "wumpf")).toEqual(["snodrev"]);
    // Unticking the last sign goes back to "not answered", never to "none seen".
    expect(toggleTourSign(["wumpf"], "wumpf")).toBeNull();
  });
});
