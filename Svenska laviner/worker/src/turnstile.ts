import { HttpError } from "./http";

export interface TurnstileEnv {
  /** Cloudflare Turnstile secret; signup is unprotected until it is set. */
  TURNSTILE_SECRET_KEY?: string;
}

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Checks a Turnstile token from the signup form. A no-op while no secret is
 * configured, so the site keeps working before Turnstile is set up.
 */
export async function verifyTurnstile(
  env: TurnstileEnv,
  token: string | undefined,
  ip: string,
  fetcher: typeof fetch = fetch
): Promise<void> {
  if (!env.TURNSTILE_SECRET_KEY) return;
  if (!token) throw new HttpError(400, "Bekräfta att du inte är en robot och försök igen.");

  const body = new FormData();
  body.set("secret", env.TURNSTILE_SECRET_KEY);
  body.set("response", token);
  if (ip !== "unknown") body.set("remoteip", ip);

  let ok = false;
  try {
    const res = await fetcher(SITEVERIFY, { method: "POST", body });
    ok = res.ok && ((await res.json()) as { success?: boolean }).success === true;
  } catch {
    throw new HttpError(503, "Kunde inte kontrollera robotskyddet just nu. Försök igen om en stund.");
  }
  if (!ok) throw new HttpError(400, "Robotkontrollen gick inte igenom. Ladda om sidan och försök igen.");
}
