import { describe, expect, it } from "vitest";
import { slopeColor } from "./slopeColors";
import { SLOPE_BANDS } from "./routePlan";

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

describe("own slope layer colours", () => {
  it("uses the route planner's steps from 30°", () => {
    expect(slopeColor(31)).toEqual(rgb(SLOPE_BANDS[1].color));
    expect(slopeColor(37)).toEqual(rgb(SLOPE_BANDS[2].color));
    expect(slopeColor(44.9)).toEqual(rgb(SLOPE_BANDS[3].color));
    expect(slopeColor(60)).toEqual(rgb(SLOPE_BANDS[4].color));
  });

  it("gives flatter ground a marker colour that isn't any band", () => {
    const flat = slopeColor(29.9);
    expect(SLOPE_BANDS.slice(1).map((b) => rgb(b.color))).not.toContainEqual(flat);
    expect(slopeColor(5)).toEqual(flat);
  });
});
