/// <reference types="node" />
import { beforeEach, describe, expect, it } from "vitest";
import type { CommunityEnv } from "./auth";
import { createObservation } from "./observations";
import { migratedD1 } from "./testing/sqliteD1";

let env: CommunityEnv;

async function sha256(value: string) {
  return Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))).toString("base64");
}

function send(clientId?: string) {
  const form = new FormData();
  form.set("type", "sprickor");
  form.set("lat", "67.9");
  form.set("lon", "18.5");
  form.set("observedAt", new Date(Date.now() - 3600e3).toISOString());
  form.set("description", "Snabbobservation: Skjutsprickor.");
  if (clientId) form.set("clientId", clientId);
  return createObservation(
    new Request("https://worker.test/observations", { method: "POST", headers: { Authorization: "Bearer tok" }, body: form }),
    env
  );
}

beforeEach(async () => {
  env = { DB: migratedD1(), IMAGES: { put: async () => {} } } as unknown as CommunityEnv;
  await env.DB.prepare(
    "INSERT INTO users (id, email, display_name, password_hash, email_verified, created_at) VALUES (1, 'a@test', 'Anna', 'x', 1, '2026-01-01')"
  ).run();
  await env.DB.prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, 1, '2026-01-01', '2999-01-01')")
    .bind(await sha256("tok"))
    .run();
});

describe("observations sent again after lost coverage", () => {
  it("stores one observation per client id and answers the resend with it", async () => {
    const id = "0b9c6f1e-5c1a-4f37-9d41-2a1f8f3c7e55";
    const first = await send(id);
    const again = await send(id);
    expect(again).toMatchObject({ duplicate: true, observation: { id: first.observation.id } });
    await send();
    await send();
    const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM observations").first<{ n: number }>();
    expect(n?.n).toBe(3);
  });
});
