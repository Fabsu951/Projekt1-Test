import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import JumpNav from "./JumpNav";
import CollapsibleSection from "./CollapsibleSection";

describe("JumpNav", () => {
  it("opens a folded section and marks it as the current one", async () => {
    vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => {
      fn(0);
      return 0;
    });
    render(
      <>
        <JumpNav targets={[{ id: "turdag", label: "Turdag" }]} />
        <CollapsibleSection id="jump-test" anchor="turdag" title="Prognos inför din tur">
          <p>Innehåll</p>
        </CollapsibleSection>
      </>
    );
    expect(screen.getByText("Innehåll")).not.toBeVisible();
    fireEvent.click(screen.getByRole("link", { name: "Turdag" }));
    expect(await screen.findByText("Innehåll")).toBeVisible();
    expect(screen.getByRole("link", { name: "Turdag" })).toHaveAttribute("aria-current", "location");
    vi.unstubAllGlobals();
  });
});
