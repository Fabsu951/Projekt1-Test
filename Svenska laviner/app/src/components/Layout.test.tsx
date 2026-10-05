import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const auth = { user: null as unknown };
vi.mock("../auth/useAuth", () => ({ useAuth: () => auth }));

import Layout from "./Layout";
import NotFoundPage from "../pages/NotFoundPage";
import { usePageTitle } from "./pageTitle";

function Named() {
  usePageTitle("Kebnekaisefjällen");
  return <h1>Område</h1>;
}

function app(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/karta" element={<h1>Karta</h1>} />
          <Route path="/omrade/:id" element={<Named />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe("Layout", () => {
  it("shows your framed picture instead of your name when signed in", () => {
    auth.user = { id: 1, displayName: "Fabian Sund", avatarPath: null, xp: 750 };
    app("/karta");
    const link = screen.getByRole("link", { name: "Min profil (Fabian Sund)" });
    expect(link).toHaveAttribute("href", "/profil");
    expect(link).not.toHaveTextContent("Fabian Sund");
    expect(link.querySelector("svg.avatar")).not.toBeNull();
  });

  it("offers log-in when signed out", () => {
    auth.user = null;
    app("/karta");
    expect(screen.getByRole("link", { name: "Logga in" })).toHaveAttribute("href", "/logga-in");
  });

  it("names each page in the browser tab, specific pages more precisely", () => {
    auth.user = null;
    const { unmount } = app("/karta");
    expect(document.title).toBe("Karta – Turkoll");
    unmount();
    app("/omrade/kebnekaisefjallen");
    expect(document.title).toBe("Kebnekaisefjällen – Turkoll");
  });

  it("shows a not-found page for unknown addresses", () => {
    auth.user = null;
    app("/finns-inte");
    expect(screen.getByRole("heading", { name: "Sidan finns inte" })).toBeInTheDocument();
    expect(document.title).toBe("Sidan finns inte – Turkoll");
  });

  it("opens and closes the phone menu", () => {
    auth.user = null;
    app("/karta");
    const button = screen.getByRole("button", { name: "Meny" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
  });
});
