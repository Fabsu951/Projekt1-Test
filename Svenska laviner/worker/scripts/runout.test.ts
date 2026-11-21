import { describe, expect, it } from "vitest";
import { runoutClasses, slopeGrid, type HeightGrid } from "./runout";

const CELL = 10;

/** A slope of `deg` falling eastwards from height `top` onto a flat plain at 0, uniform north–south. */
function slopeOntoPlain(deg: number, top: number, width = 200, height = 40): HeightGrid {
  const tan = Math.tan((deg * Math.PI) / 180);
  const slopeCells = Math.round(top / tan / CELL);
  const z = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // 10 cells of flat top, then the slope, then the plain.
      const d = (x - 10) * CELL;
      z[y * width + x] = x < 10 ? top : Math.max(0, top - d * tan);
    }
  }
  void slopeCells;
  return { width, height, z, cellSize: () => CELL };
}

/** Furthest cell east (in the middle row) with a class of at least `min`. */
function reachX(g: HeightGrid, classes: Uint8Array, min: number): number {
  const y = g.height >> 1;
  let last = -1;
  for (let x = 0; x < g.width; x++) if (classes[y * g.width + x] >= min) last = x;
  return last;
}

describe("slopeGrid", () => {
  it("measures a plane's slope", () => {
    const g = slopeOntoPlain(35, 300);
    const s = slopeGrid(g);
    expect(s[20 * g.width + 30]).toBeCloseTo(35, 0);
    expect(s[20 * g.width + 150]).toBeCloseTo(0, 5);
  });
});

describe("runoutClasses", () => {
  it("reaches as far out on the plain as the alpha angle says", () => {
    const top = 300;
    const g = slopeOntoPlain(35, top);
    const classes = runoutClasses(g, { alphas: [25] });
    // The energy line from the top edge of the slope (x = 10) meets the
    // plain at top / tan(25°) metres out.
    const expected = 10 + top / Math.tan((25 * Math.PI) / 180) / CELL;
    expect(Math.abs(reachX(g, classes, 1) - expected)).toBeLessThanOrEqual(2);
  });

  it("gives nested zones: a steeper angle reaches less far", () => {
    const g = slopeOntoPlain(35, 300);
    const classes = runoutClasses(g, { alphas: [30, 25, 20] });
    const short = reachX(g, classes, 3);
    const medium = reachX(g, classes, 2);
    const long = reachX(g, classes, 1);
    expect(short).toBeGreaterThan(0);
    expect(short).toBeLessThan(medium);
    expect(medium).toBeLessThan(long);
  });

  it("leaves the steep ground itself out (the slope map shows it)", () => {
    const g = slopeOntoPlain(35, 300);
    const classes = runoutClasses(g, { alphas: [20] });
    expect(classes[20 * g.width + 30]).toBe(0);
  });

  it("finds nothing below gentle ground", () => {
    const g = slopeOntoPlain(20, 300);
    const classes = runoutClasses(g, { alphas: [30, 25, 20] });
    expect(classes.some((c) => c > 0)).toBe(false);
  });

  it("doesn't climb a real counter-slope", () => {
    const g = slopeOntoPlain(35, 300, 200);
    // A 15 m wall across the plain 40 m out from the foot of the slope.
    const foot = 10 + Math.round(300 / Math.tan((35 * Math.PI) / 180) / CELL);
    for (let y = 0; y < g.height; y++) for (let x = foot + 4; x < g.width; x++) g.z[y * g.width + x] = 15;
    const classes = runoutClasses(g, { alphas: [20] });
    expect(reachX(g, classes, 1)).toBeLessThan(foot + 4);
  });

  it("spreads less sideways on a slope than on flat ground", () => {
    // A narrow 40° gully (5 cells wide) in a 20° hillside, ending on a plain.
    const width = 200, height = 81, top = 300;
    const z = new Float32Array(width * height);
    const t40 = Math.tan((40 * Math.PI) / 180), t20 = Math.tan((20 * Math.PI) / 180);
    for (let y = 0; y < height; y++) {
      const inGully = Math.abs(y - 40) <= 2;
      for (let x = 0; x < width; x++) {
        const d = x * CELL;
        z[y * width + x] = Math.max(0, top - d * (inGully ? t40 : t20)) + (inGully ? 0 : 0.0);
      }
    }
    const g: HeightGrid = { width, height, z, cellSize: () => CELL };
    const classes = runoutClasses(g, { alphas: [25] });
    // Halfway down the hillside, beside the gully: not flagged far sideways.
    const row = (x: number) => Array.from({ length: height }, (_, y) => classes[y * width + x]).filter((c) => c > 0).length;
    expect(row(30)).toBeLessThan(20);
  });
});
