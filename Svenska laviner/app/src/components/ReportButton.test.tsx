import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ReportButton from "./ReportButton";

const { auth, reportContent } = vi.hoisted(() => ({
  auth: { user: { id: 1, canPost: true } as { id: number; canPost: boolean } | null, token: "t" as string | null },
  reportContent: vi.fn(async () => {}),
}));
vi.mock("../auth/useAuth", () => ({ useAuth: () => auth }));
vi.mock("../services/reportService", () => ({ reportContent }));

beforeEach(() => {
  auth.user = { id: 1, canPost: true };
  auth.token = "t";
  reportContent.mockClear();
});

describe("ReportButton", () => {
  it("sends the report with the reason and thanks the reporter", async () => {
    vi.spyOn(window, "prompt").mockReturnValue("Stötande");
    render(<ReportButton type="comment" id={7} ownerId={2} />);
    fireEvent.click(screen.getByRole("button", { name: "Anmäl" }));
    await waitFor(() => expect(screen.getByText("Anmäld – tack!")).toBeTruthy());
    expect(reportContent).toHaveBeenCalledWith("t", "comment", 7, "Stötande");
  });

  it("does nothing when the prompt is cancelled", () => {
    vi.spyOn(window, "prompt").mockReturnValue(null);
    render(<ReportButton type="tour" id={7} ownerId={2} />);
    fireEvent.click(screen.getByRole("button", { name: "Anmäl" }));
    expect(reportContent).not.toHaveBeenCalled();
  });

  it("is hidden for your own things and when signed out", () => {
    const { container, rerender } = render(<ReportButton type="profile" id={1} ownerId={1} />);
    expect(container.textContent).toBe("");
    auth.user = null;
    auth.token = null;
    rerender(<ReportButton type="tour" id={7} ownerId={2} />);
    expect(container.textContent).toBe("");
  });
});
