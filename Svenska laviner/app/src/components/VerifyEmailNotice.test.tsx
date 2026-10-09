import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import VerifyEmailNotice from "./VerifyEmailNotice";

const { auth } = vi.hoisted(() => ({
  auth: {
    user: { email: "a@b.se", canPost: false } as { email: string; canPost: boolean } | null,
    resendVerification: vi.fn(async () => {}),
    refreshUser: vi.fn(async () => {}),
  },
}));
vi.mock("../auth/useAuth", () => ({ useAuth: () => auth }));

beforeEach(() => {
  auth.user = { email: "a@b.se", canPost: false };
  auth.refreshUser.mockClear();
});

describe("VerifyEmailNotice", () => {
  it("checks again when the person comes back to the tab", () => {
    render(<VerifyEmailNotice />);
    expect(screen.getByText(/Bekräfta din e-postadress/)).toBeTruthy();
    fireEvent(window, new Event("focus"));
    expect(auth.refreshUser).toHaveBeenCalledTimes(1);
  });

  it("shows nothing and doesn't poll once the email is confirmed", () => {
    auth.user = { email: "a@b.se", canPost: true };
    const { container } = render(<VerifyEmailNotice />);
    expect(container.textContent).toBe("");
    fireEvent(window, new Event("focus"));
    expect(auth.refreshUser).not.toHaveBeenCalled();
  });
});
