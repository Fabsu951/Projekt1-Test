import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("AuthProvider", () => {
  it("signs out on this device when the server no longer accepts the session", async () => {
    vi.stubEnv("VITE_MAP_PROXY_URL", "https://w.example");
    vi.resetModules();
    const { default: AuthProvider } = await import("./AuthProvider");
    const { useAuth } = await import("./useAuth");
    const { api } = await import("../services/api");
    localStorage.setItem("CapacitorStorage.fjallkoll:auth-token", "tok");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.endsWith("/auth/me")
          ? Response.json({ user: { id: 1, email: "a@test", displayName: "Anna", isAdmin: false, emailVerified: true, canPost: true, lang: "sv" } })
          : Response.json({ error: "Du behöver logga in." }, { status: 401 })
      )
    );
    function Who() {
      const { user, loading } = useAuth();
      return <p>{loading ? "…" : (user?.displayName ?? "utloggad")}</p>;
    }
    render(
      <AuthProvider>
        <Who />
      </AuthProvider>
    );
    await screen.findByText("Anna");
    await act(async () => {
      await api("/notifications", { token: "tok" }).catch(() => {});
    });
    await waitFor(() => expect(screen.getByText("utloggad")).toBeInTheDocument());
    expect(localStorage.getItem("CapacitorStorage.fjallkoll:auth-token")).toBeNull();
  });
});
