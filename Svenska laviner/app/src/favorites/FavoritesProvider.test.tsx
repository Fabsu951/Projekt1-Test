import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthState } from "../auth/authContext";
import FavoritesProvider from "./FavoritesProvider";
import { useFavorites } from "./useFavorites";

const { api } = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("../services/api", () => ({ api }));

function Show() {
  const { favorites, toggleFavorite } = useFavorites();
  return (
    <>
      <p data-testid="favs">{favorites.join(",")}</p>
      <button onClick={() => toggleFavorite("vastra-vindelfjallen")}>stjärna</button>
    </>
  );
}

function renderAs(token: string | null) {
  const auth = { token } as AuthState;
  return render(
    <AuthContext.Provider value={auth}>
      <FavoritesProvider>
        <Show />
      </FavoritesProvider>
    </AuthContext.Provider>
  );
}

const favs = () => screen.getByTestId("favs").textContent;

beforeEach(() => {
  localStorage.clear();
  api.mockReset();
});

describe("FavoritesProvider", () => {
  it("merges the account's favourites with this device's on login and saves the result", async () => {
    // Starred on the computer (saved to the account) …
    api.mockImplementation(async (_path: string, opts?: { method?: string }) =>
      opts?.method === "POST" ? {} : { favorites: ["riksgransfjallen"] }
    );
    // … and something else on the phone before logging in there.
    localStorage.setItem("CapacitorStorage.fjallkoll:favorites", JSON.stringify(["kebnekaisefjallen"]));

    renderAs("t");
    await waitFor(() => expect(favs()).toBe("riksgransfjallen,kebnekaisefjallen"));
    expect(api).toHaveBeenCalledWith("/auth/favorites", {
      method: "POST",
      token: "t",
      json: { favorites: ["riksgransfjallen", "kebnekaisefjallen"] },
    });
  });

  it("saves each change to the account while logged in", async () => {
    api.mockImplementation(async (_path: string, opts?: { method?: string }) =>
      opts?.method === "POST" ? {} : { favorites: [] }
    );
    renderAs("t");
    await waitFor(() => expect(api).toHaveBeenCalledWith("/auth/favorites", { token: "t" }));
    fireEvent.click(screen.getByRole("button", { name: "stjärna" }));
    expect(favs()).toBe("vastra-vindelfjallen");
    expect(api).toHaveBeenLastCalledWith("/auth/favorites", {
      method: "POST",
      token: "t",
      json: { favorites: ["vastra-vindelfjallen"] },
    });
  });

  it("keeps working on the device alone when logged out or offline", async () => {
    renderAs(null);
    fireEvent.click(screen.getByRole("button", { name: "stjärna" }));
    expect(favs()).toBe("vastra-vindelfjallen");
    expect(api).not.toHaveBeenCalled();

    api.mockRejectedValue(new Error("offline"));
    renderAs("t");
    await waitFor(() => expect(api).toHaveBeenCalled());
  });
});
