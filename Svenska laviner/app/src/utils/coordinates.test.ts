import { describe, expect, it } from "vitest";
import { coordinateText, formatDecimal, formatDegreesMinutes, formatSweref, groupDigits, toSweref99tm } from "./coordinates";

describe("toSweref99tm", () => {
  it("matches proj4 (EPSG:3006) across Sweden", () => {
    // Expected values computed with proj4 "+proj=utm +zone=33 +ellps=GRS80".
    expect(toSweref99tm(67.9, 18.55)).toEqual([7535993, 648979]);
    expect(toSweref99tm(62.78, 12.52)).toEqual([6963514, 373460]);
    expect(toSweref99tm(55.6, 13.0)).toEqual([6163377, 373988]);
    expect(toSweref99tm(68.36, 23.9)).toEqual([7609435, 865200]);
  });
});

describe("formatting", () => {
  it("writes decimal degrees with five decimals and a point", () => {
    expect(formatDecimal(67.901234, 18.550119)).toBe("67.90123° N, 18.55012° E");
  });

  it("writes degrees and decimal minutes with a Swedish comma", () => {
    // 0.9 × 60 = 54.000; 0.55 × 60 = 33.000
    expect(formatDegreesMinutes(67.9, 18.55)).toBe("N 67° 54,000′  E 18° 33,000′");
  });

  it("rounds 59.9996 minutes up to the next degree", () => {
    expect(formatDegreesMinutes(67.999999, 18.5)).toBe("N 68° 0,000′  E 18° 30,000′");
  });

  it("groups digits in threes", () => {
    expect(groupDigits(7535993)).toBe("7 535 993");
    expect(formatSweref(67.9, 18.55)).toBe("N 7 535 993  E 648 979");
  });

  it("copies every form on its own line", () => {
    expect(coordinateText(67.9, 18.55)).toBe(
      "WGS 84: 67.90000, 18.55000\nWGS 84: N 67° 54,000′ E 18° 33,000′\nSWEREF 99 TM: N 7535993 E 648979",
    );
  });
});
