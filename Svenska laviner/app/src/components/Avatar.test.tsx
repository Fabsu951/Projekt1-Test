import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Avatar from "./Avatar";
import { LEVELS, levelFor } from "../data/levels";

describe("levels", () => {
  it("climbs through the frames as points grow", () => {
    expect(levelFor(0).level.name).toBe("Nykomling");
    expect(levelFor(99).level.name).toBe("Nykomling");
    expect(levelFor(100).level.name).toBe("Spårare");
    expect(levelFor(3000).level.name).toBe("Fjällveteran");
    expect(levelFor(200)).toMatchObject({ progress: 0.5, toNext: 100 });
    expect(levelFor(99999)).toMatchObject({ next: null, progress: 1 });
    expect(LEVELS.map((l) => l.minXp)).toEqual([...LEVELS.map((l) => l.minXp)].sort((a, b) => a - b));
  });
});

describe("Avatar", () => {
  it("shows initials without a picture and names the level", () => {
    const { container } = render(<Avatar name="Anna Berg" avatarPath={null} xp={750} />);
    expect(screen.getByRole("img", { name: "Anna Berg, Fjällvan" })).toBeInTheDocument();
    expect(container.querySelector("text")).toHaveTextContent("AB");
  });

  it("shows the picture when there is one", () => {
    const { container } = render(<Avatar name="Anna" avatarPath="/images/avatar/x.jpg" xp={0} />);
    expect(container.querySelector("image")?.getAttribute("href")).toMatch(/\/images\/avatar\/x\.jpg$/);
    expect(container.querySelector("text")).toBeNull();
  });
});
