import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import CollapsibleSection, { ShowMore } from "./CollapsibleSection";

describe("CollapsibleSection", () => {
  beforeEach(() => localStorage.clear());

  it("starts folded with the count shown, opens, and remembers it", () => {
    const { unmount } = render(
      <CollapsibleSection id="t" title="Mina turer" count={14}>
        <p>innehåll</p>
      </CollapsibleSection>
    );
    const toggle = screen.getByRole("button", { name: /Mina turer/ });
    expect(toggle).toHaveTextContent("14");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("innehåll")).not.toBeVisible();

    fireEvent.click(toggle);
    expect(screen.getByText("innehåll")).toBeVisible();
    unmount();

    render(
      <CollapsibleSection id="t" title="Mina turer" count={14}>
        <p>innehåll</p>
      </CollapsibleSection>
    );
    expect(screen.getByRole("button", { name: /Mina turer/ })).toHaveAttribute("aria-expanded", "true");
  });

  it("shows five items until asked for all", () => {
    render(<ShowMore items={[1, 2, 3, 4, 5, 6, 7]} render={(v) => <p>{v.join(",")}</p>} />);
    expect(screen.getByText("1,2,3,4,5")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Visa alla 7" }));
    expect(screen.getByText("1,2,3,4,5,6,7")).toBeInTheDocument();
  });
});
