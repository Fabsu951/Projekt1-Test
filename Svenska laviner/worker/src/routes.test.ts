import { describe, expect, it } from "vitest";
import { cleanWaypoints, MAX_WAYPOINTS } from "./routes";

describe("cleanWaypoints", () => {
  it("keeps valid points, rounded to about 10 cm", () => {
    expect(cleanWaypoints([[67.8512345678, 18.6], ["67.9", "18.5"]])).toEqual([
      [67.851235, 18.6],
      [67.9, 18.5],
    ]);
  });

  it("refuses too few, too many and broken points", () => {
    expect(() => cleanWaypoints([[67.85, 18.6]])).toThrow("minst två");
    expect(() => cleanWaypoints(Array.from({ length: MAX_WAYPOINTS + 1 }, () => [67.85, 18.6]))).toThrow("högst");
    expect(() => cleanWaypoints([[67.85, 18.6], [95, 18.6]])).toThrow("Ogiltig");
    expect(() => cleanWaypoints([[67.85, 18.6], [67.9]])).toThrow("Ogiltig");
    expect(() => cleanWaypoints("nope")).toThrow("minst två");
  });
});
