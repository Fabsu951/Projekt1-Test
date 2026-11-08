import { describe, expect, it } from "vitest";
import { clockText, fixLine, goodSegments, movingTimeMs, parseLine, parseLines, recordingToTrack, summarize } from "./recording";

// About 11.1 m per 0.0001° of latitude.
const line = (i: number, ele: number | null = 800, acc: number | null = 5, t0 = 1_700_000_000_000) =>
  fixLine(67.9 + i * 0.0001, 18.5, ele, t0 + i * 3000, acc);

describe("recording lines", () => {
  it("reads fixes, pauses and resumes, and skips junk", () => {
    expect(parseLine("67.900000,18.500000,812.4,1700000000000,6")).toEqual({
      kind: "fix", lat: 67.9, lon: 18.5, ele: 812.4, time: 1700000000000, accuracy: 6,
    });
    expect(parseLine("67.9,18.5,,1700000000000,")).toMatchObject({ ele: null, accuracy: null });
    expect(parseLine("P,1700000000000")).toEqual({ kind: "pause", time: 1700000000000 });
    expect(parseLine("R,1700000000000")).toEqual({ kind: "resume", time: 1700000000000 });
    expect(parseLine("nonsense")).toBeNull();
    expect(parseLine("95,18.5,800,1700000000000,5")).toBeNull();
  });

  it("writes what it reads", () => {
    expect(parseLine(fixLine(67.123456, 18.654321, 1234.56, 1700000000000.4, 7.6))).toEqual({
      kind: "fix", lat: 67.123456, lon: 18.654321, ele: 1234.6, time: 1700000000000, accuracy: 8,
    });
  });
});

describe("summarize", () => {
  it("adds up distance and leaves out imprecise fixes and GPS jumps", () => {
    const lines = [line(0), line(10), line(11, 800, 120), line(20)];
    // A jump 5 km away within 3 s is no skier.
    lines.splice(3, 0, fixLine(67.95, 18.5, 800, 1_700_000_000_000 + 31_000, 5));
    const s = summarize(parseLines(lines));
    expect(s.fixes).toBe(3);
    expect(s.distanceM).toBeGreaterThan(215);
    expect(s.distanceM).toBeLessThan(230);
  });

  it("doesn't count standing still as distance", () => {
    const wobble = Array.from({ length: 40 }, (_, i) => fixLine(67.9 + (i % 2) * 0.00003, 18.5, 800, 1_700_000_000_000 + i * 3000, 5));
    expect(summarize(parseLines(wobble)).distanceM).toBe(0);
  });

  it("counts climbs but not GPS wobble", () => {
    const up = Array.from({ length: 30 }, (_, i) => line(i, 800 + i * 10));
    expect(summarize(parseLines(up)).ascentM).toBeGreaterThanOrEqual(280);
    const flat = Array.from({ length: 30 }, (_, i) => line(i, 800 + (i % 2) * 6));
    expect(summarize(parseLines(flat)).ascentM).toBe(0);
  });

  it("doesn't count the way between a pause and a resume", () => {
    const entries = parseLines([line(0), line(10), "P,1700000031000", "R,1700000400000", line(200, 800, 5, 1_700_000_000_000 - 200 * 3000 + 400_000), line(210, 800, 5, 1_700_000_000_000 - 200 * 3000 + 430_000)]);
    expect(goodSegments(entries)).toHaveLength(2);
    const s = summarize(entries);
    expect(s.distanceM).toBeGreaterThan(215);
    expect(s.distanceM).toBeLessThan(230);
  });
});

describe("recordingToTrack", () => {
  it("gives upload-ready points in the imported-file format", () => {
    const track = recordingToTrack(parseLines([line(0), line(5), line(6, 800, 90), line(10)]));
    expect(track).toHaveLength(3);
    expect(track[0]).toEqual([67.9, 18.5, 800, 1_700_000_000_000]);
  });
});

describe("time", () => {
  it("leaves pauses out of the moving time and formats it", () => {
    expect(movingTimeMs(1000, 500, 4000)).toBe(2500);
    expect(clockText(65_000)).toBe("1:05");
    expect(clockText(3_909_000)).toBe("1:05:09");
  });
});
