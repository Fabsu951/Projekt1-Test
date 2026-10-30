import { afterEach, describe, expect, it, vi } from "vitest";
import { proxyTopowebbFile, TOPOWEBB_GPKG, type TilesEnv } from "./tiles";

const env = { TILE_UPLOAD_TOKEN: "hemlig", LANTMATERIET_USER: "u@x.se", LANTMATERIET_PASSWORD: "pw" } as unknown as TilesEnv;
const ask = (headers: Record<string, string>) =>
  proxyTopowebbFile(new Request("https://w.test/admin/lantmateriet/topowebb-3857.gpkg", { headers }), env);

afterEach(() => vi.unstubAllGlobals());

describe("GeoPackage range proxy", () => {
  it("refuses without the upload token, so the login can't be used by others", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect((await ask({ Range: "bytes=0-99" })).status).toBe(401);
    expect((await ask({ Authorization: "Bearer fel", Range: "bytes=0-99" })).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("only passes on bounded ranges", async () => {
    vi.stubGlobal("fetch", vi.fn());
    expect((await ask({ Authorization: "Bearer hemlig" })).status).toBe(400);
    expect((await ask({ Authorization: "Bearer hemlig", Range: "bytes=0-" })).status).toBe(400);
    expect((await ask({ Authorization: "Bearer hemlig", Range: `bytes=0-${32 * 1024 * 1024}` })).status).toBe(400);
  });

  it("fetches the range from Lantmäteriet with the worker's login", async () => {
    const fetchMock = vi.fn(async () => new Response(new Uint8Array(100), { status: 206, headers: { "Content-Range": "bytes 0-99/1000" } }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await ask({ Authorization: "Bearer hemlig", Range: "bytes=0-99" });
    expect(res.status).toBe(206);
    expect(res.headers.get("Content-Range")).toBe("bytes 0-99/1000");
    expect((await res.arrayBuffer()).byteLength).toBe(100);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(TOPOWEBB_GPKG);
    const headers = init.headers as Record<string, string>;
    expect(headers.Range).toBe("bytes=0-99");
    expect(headers.Authorization).toBe(`Basic ${btoa("u@x.se:pw")}`);
  });
});
