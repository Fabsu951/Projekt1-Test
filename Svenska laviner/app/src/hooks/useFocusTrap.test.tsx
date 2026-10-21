import { fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it } from "vitest";
import { useFocusTrap } from "./useFocusTrap";

function Dialog() {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref);
  return (
    <>
      <button type="button">Utanför</button>
      <div ref={ref} role="dialog">
        <button type="button">Första</button>
        <button type="button">Sista</button>
      </div>
    </>
  );
}

describe("useFocusTrap", () => {
  it("wraps Tab and Shift+Tab inside the dialog", () => {
    render(<Dialog />);
    const first = screen.getByText("Första");
    const last = screen.getByText("Sista");
    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
    screen.getByText("Utanför").focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true);
  });
});
