import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ShareButton from "./ShareButton";

const props = { path: "/omrade/abisko", title: "Lavinprognos Abisko", text: "Dagens lavinprognos", what: "prognosen för Abisko" };

describe("ShareButton", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, "share");
  });

  it("opens the browser's share sheet with the page's address", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    render(<ShareButton {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Dela prognosen för Abisko" }));
    await waitFor(() => expect(share).toHaveBeenCalled());
    expect(share.mock.calls[0][0]).toMatchObject({ title: "Lavinprognos Abisko", url: `${window.location.origin}/omrade/abisko` });
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("copies the link where there is no share sheet, and says so", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<ShareButton {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /Dela/ }));
    expect(await screen.findByText("Länken är kopierad")).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/omrade/abisko`);
  });

  it("says nothing when the share sheet is closed", async () => {
    const share = vi.fn().mockRejectedValue(Object.assign(new Error("Share canceled"), { name: "AbortError" }));
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    render(<ShareButton {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /Dela/ }));
    await waitFor(() => expect(share).toHaveBeenCalled());
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });
});
