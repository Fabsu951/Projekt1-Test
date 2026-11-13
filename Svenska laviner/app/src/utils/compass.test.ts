import { describe, expect, it } from "vitest";
import { headingFromEvent, smoothHeading } from "./compass";

describe("headingFromEvent", () => {
  it("uses the iPhone's compass heading as it is", () => {
    expect(headingFromEvent({ alpha: 10, webkitCompassHeading: 75 }, 0, false)).toBe(75);
  });

  it("turns Android's absolute alpha into a clockwise heading", () => {
    // alpha 90 = the top edge points west.
    expect(headingFromEvent({ alpha: 90 }, 0, true)).toBe(270);
    expect(headingFromEvent({ alpha: 0 }, 0, true)).toBe(0);
  });

  it("ignores a relative alpha (it isn't tied to north)", () => {
    expect(headingFromEvent({ alpha: 90, absolute: false }, 0, false)).toBeNull();
  });

  it("adds the screen's rotation in landscape", () => {
    expect(headingFromEvent({ alpha: 0, webkitCompassHeading: 350 }, 90, false)).toBe(80);
  });
});

describe("smoothHeading", () => {
  it("moves part of the way to the next reading", () => {
    expect(smoothHeading(0, 100, 0.5)).toBe(50);
  });

  it("goes the short way round across north", () => {
    expect(smoothHeading(350, 10, 0.5)).toBe(0);
    expect(smoothHeading(10, 350, 0.5)).toBe(0);
  });

  it("starts at the first reading", () => {
    expect(smoothHeading(null, 123)).toBe(123);
  });
});
