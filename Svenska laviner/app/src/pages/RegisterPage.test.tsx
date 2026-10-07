import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import RegisterPage from "./RegisterPage";

const register = vi.fn().mockResolvedValue(undefined);
vi.mock("../auth/useAuth", () => ({ useAuth: () => ({ user: null, token: null, loading: false, register }) }));

function fill() {
  fireEvent.change(screen.getByLabelText(/Användarnamn/), { target: { value: "Anna" } });
  fireEvent.change(screen.getByLabelText(/E-post/), { target: { value: "anna@test.se" } });
  fireEvent.change(screen.getByLabelText(/Lösenord/), { target: { value: "ett-langt-losenord" } });
}

describe("RegisterPage", () => {
  it("asks you to accept the terms (and links to them) before an account is made", async () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );
    fill();
    expect(screen.getByRole("link", { name: "användarvillkoren" })).toHaveAttribute("href", "/om-appen#villkor");
    fireEvent.submit(screen.getByRole("button", { name: "Skapa konto" }).closest("form")!);
    expect(await screen.findByRole("alert")).toHaveTextContent(/godkänna användarvillkoren/);
    expect(register).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("checkbox", { name: /godkänner användarvillkoren/ }));
    fireEvent.submit(screen.getByRole("button", { name: "Skapa konto" }).closest("form")!);
    await vi.waitFor(() => expect(register).toHaveBeenCalledWith("anna@test.se", "ett-langt-losenord", "Anna", null));
  });
});
