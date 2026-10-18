import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Preferences } from "@capacitor/preferences";
import { api, ApiError } from "../services/api";
import { cached, clearUserCache, USER_SCOPE } from "../services/cache";
import { stopNativeAccountPush } from "../services/nativePush";
import { stopSharing } from "../services/locationShare";
import type { User } from "../types/observation";
import { AuthContext, type AuthState } from "./authContext";
import { lang } from "../i18n";

const TOKEN_KEY = "fjallkoll:auth-token";

async function saveToken(token: string | null) {
  try {
    if (token) await Preferences.set({ key: TOKEN_KEY, value: token });
    else await Preferences.remove({ key: TOKEN_KEY });
  } catch {
    // Storage unavailable (private browsing) — the session just won't persist.
  }
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let saved: string | null = null;
      try {
        saved = (await Preferences.get({ key: TOKEN_KEY })).value;
      } catch {
        saved = null;
      }
      if (!saved) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        // Offline, the account as last seen is used, so you stay signed in
        // and can read what was saved on the device.
        const { user } = await cached(`${USER_SCOPE}me`, () => api<{ user: User }>("/auth/me", { token: saved }));
        if (!cancelled) {
          setUser(user);
          setToken(saved);
        }
      } catch (err) {
        // Only forget the token when the server says it's invalid — not when offline.
        if (err instanceof ApiError && err.status === 401) {
          await saveToken(null);
          await clearUserCache();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const start = useCallback(async (result: { token: string; user: User }) => {
    // Nothing saved for a previous account may show up for this one.
    await clearUserCache();
    await saveToken(result.token);
    setToken(result.token);
    setUser(result.user);
    // Login answers don't include the picture; fetch it for the menu.
    cached(`${USER_SCOPE}me`, () => api<{ user: User }>("/auth/me", { token: result.token }))
      .then(({ user }) => setUser(user))
      .catch(() => {});
  }, []);

  // Notifications and emails follow the language the app is read in.
  useEffect(() => {
    if (!token || !user?.lang || user.lang === lang()) return;
    const next = lang();
    api("/auth/lang", { method: "POST", token, json: { lang: next } })
      .then(() => setUser((u) => (u ? { ...u, lang: next } : u)))
      .catch(() => {});
  }, [token, user?.lang]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      token,
      loading,
      async login(email, password) {
        await start(await api("/auth/login", { method: "POST", json: { email, password } }));
      },
      async register(email, password, displayName, turnstileToken) {
        await start(
          await api("/auth/register", {
            method: "POST",
            // Only reachable after ticking "Jag godkänner användarvillkoren" on the form.
            json: { email, password, displayName, turnstileToken: turnstileToken ?? undefined, acceptTerms: true, lang: lang() },
          })
        );
      },
      async logout() {
        // This phone stops getting the account's push notices (area notices stay).
        await stopNativeAccountPush();
        // Nobody keeps seeing a position after its owner has logged out.
        await stopSharing(token).catch(() => {});
        try {
          await api("/auth/logout", { method: "POST", token });
        } catch {
          // Logging out locally is what matters.
        }
        await saveToken(null);
        await clearUserCache();
        setToken(null);
        setUser(null);
      },
      async deleteAccount() {
        await api("/auth/me", { method: "DELETE", token });
        await stopNativeAccountPush();
        await stopSharing(null);
        await saveToken(null);
        await clearUserCache();
        setToken(null);
        setUser(null);
      },
      async refreshUser() {
        if (!token) return;
        const { user } = await cached(`${USER_SCOPE}me`, () => api<{ user: User }>("/auth/me", { token }));
        setUser(user);
      },
      async resendVerification() {
        await api("/auth/resend-verification", { method: "POST", token });
      },
      async resetPassword(resetToken, password) {
        await start(await api("/auth/reset", { method: "POST", json: { token: resetToken, password } }));
      },
    }),
    [user, token, loading, start]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
