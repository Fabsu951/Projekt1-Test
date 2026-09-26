import { describe, expect, it, vi } from "vitest";
import { verifyTurnstile } from "./turnstile";

const reply = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

describe("verifyTurnstile", () => {
  it("does nothing until a secret is configured", async () => {
    const fetcher = reply({ success: false });
    await expect(verifyTurnstile({}, undefined, "1.2.3.4", fetcher)).resolves.toBeUndefined();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("requires a token once configured", async () => {
    await expect(verifyTurnstile({ TURNSTILE_SECRET_KEY: "s" }, undefined, "1.2.3.4", reply({}))).rejects.toMatchObject({
      status: 400,
    });
  });

  it("accepts a token Cloudflare confirms, sending secret, token and IP", async () => {
    const fetcher = reply({ success: true });
    await verifyTurnstile({ TURNSTILE_SECRET_KEY: "s" }, "tok", "1.2.3.4", fetcher);
    const body = (fetcher.mock.calls[0] as unknown as [string, RequestInit])[1].body as FormData;
    expect([body.get("secret"), body.get("response"), body.get("remoteip")]).toEqual(["s", "tok", "1.2.3.4"]);
  });

  it("rejects a token Cloudflare doesn't confirm", async () => {
    await expect(
      verifyTurnstile({ TURNSTILE_SECRET_KEY: "s" }, "tok", "1.2.3.4", reply({ success: false }))
    ).rejects.toMatchObject({ status: 400 });
  });

  it("reports an outage as temporary rather than blaming the user", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("network");
    });
    await expect(verifyTurnstile({ TURNSTILE_SECRET_KEY: "s" }, "tok", "1.2.3.4", fetcher)).rejects.toMatchObject({
      status: 503,
    });
  });
});
