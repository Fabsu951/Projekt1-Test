import { REGION_SOURCES } from "./regions";
import { parseForecastHtml, type ParsedForecast } from "./parse";
import { corsHeaders, error, HttpError, json } from "./http";
import {
  type CommunityEnv,
  currentUser,
  deleteAccount,
  forgotPassword,
  login,
  logout,
  register,
  resendVerification,
  resetPassword,
  verifyEmail,
} from "./auth";
import {
  createObservation,
  deleteObservation,
  listObservations,
  listReported,
  reportObservation,
  restoreObservation,
  serveImage,
} from "./observations";

export interface Env extends CommunityEnv {
  ALLOWED_ORIGIN?: string;
  LANTMATERIET_USER?: string;
  LANTMATERIET_PASSWORD?: string;
}

const SOURCE_BASE = "https://www.lavinprognoser.se/oversikt-alla-omraden";
const CACHE_TTL_SECONDS = 60 * 30;

const TOPOWEBB_BASE = "https://maps.lantmateriet.se/open/topowebb-ccby/v1/wmts";
const TOPOWEBB_CACHE_TTL_SECONDS = 60 * 60 * 24 * 30;

interface RegionForecastResponse extends ParsedForecast {
  regionId: string;
  sourceUrl: string;
  fetchedAt: string;
  fetchError: string | null;
}

function emptyForecast(
  regionId: string,
  sourceUrl: string,
  fetchedAt: string,
  fetchError: string
): RegionForecastResponse {
  return {
    regionId,
    sourceUrl,
    fetchedAt,
    fetchError,
    assessed: false,
    danger: null,
    seasonOver: false,
    notAssessed: false,
    confidence: "none",
    headline: null,
    publishedText: null,
  };
}

/** Tries each candidate slug in order; a 404 moves on to the next one. */
async function fetchRegion(regionId: string, slugs: string[]): Promise<RegionForecastResponse> {
  const fetchedAt = new Date().toISOString();
  let lastUrl = `${SOURCE_BASE}/${slugs[0]}/`;

  for (const slug of slugs) {
    const sourceUrl = `${SOURCE_BASE}/${slug}/`;
    lastUrl = sourceUrl;
    try {
      const res = await fetch(sourceUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "sv-SE,sv;q=0.9,en;q=0.8",
        },
        cf: { cacheTtl: CACHE_TTL_SECONDS, cacheEverything: true },
      });

      if (res.status === 404) continue;
      if (!res.ok) return emptyForecast(regionId, sourceUrl, fetchedAt, `HTTP ${res.status}`);

      const parsed = parseForecastHtml(await res.text());
      return { regionId, sourceUrl, fetchedAt, fetchError: null, ...parsed };
    } catch (err) {
      return emptyForecast(
        regionId,
        sourceUrl,
        fetchedAt,
        err instanceof Error ? err.message : "unknown fetch error"
      );
    }
  }

  return emptyForecast(regionId, lastUrl, fetchedAt, `HTTP 404 (tried: ${slugs.join(", ")})`);
}

// Proxies Lantmäteriet's topowebb-ccby WMTS endpoint so the Basic Auth
// credentials for our Geotorget account never reach the client bundle.
// Only the fixed upstream host is forwarded to (no user-controlled
// destination), and the free CC0 tile/capabilities data itself is public —
// the credentials are the only thing worth protecting here.
async function proxyTopowebb(request: Request, env: Env, origin: string): Promise<Response> {
  if (!env.LANTMATERIET_USER || !env.LANTMATERIET_PASSWORD) {
    return new Response("Map proxy not configured", { status: 500, headers: corsHeaders(origin) });
  }

  const reqUrl = new URL(request.url);
  const upstreamUrl = new URL(TOPOWEBB_BASE);
  upstreamUrl.search = reqUrl.search;

  const cache = caches.default;
  const cacheKey = new Request(upstreamUrl.toString(), request);
  const cached = await cache.match(cacheKey);
  if (cached) {
    return new Response(cached.body, {
      headers: { ...corsHeaders(origin), "Content-Type": cached.headers.get("Content-Type") ?? "image/png" },
    });
  }

  const auth = btoa(`${env.LANTMATERIET_USER}:${env.LANTMATERIET_PASSWORD}`);
  const upstream = await fetch(upstreamUrl.toString(), {
    headers: { Authorization: `Basic ${auth}` },
  });

  if (!upstream.ok) {
    return new Response(`Upstream error: HTTP ${upstream.status}`, {
      status: upstream.status,
      headers: corsHeaders(origin),
    });
  }

  const contentType = upstream.headers.get("Content-Type") ?? "image/png";
  const response = new Response(upstream.body, {
    headers: {
      ...corsHeaders(origin),
      "Content-Type": contentType,
      "Cache-Control": `public, max-age=${TOPOWEBB_CACHE_TTL_SECONDS}`,
    },
  });
  await cache.put(cacheKey, response.clone());
  return response;
}

/**
 * Accounts and user observations. Returns null for paths it doesn't own.
 * Auth is a bearer token (not a cookie), so it works cross-origin from
 * pages.dev and from the native Capacitor app alike.
 */
async function handleCommunity(request: Request, env: Env, origin: string): Promise<Response | null> {
  const { pathname } = new URL(request.url);
  const method = request.method;

  try {
    if (pathname === "/auth/register" && method === "POST") return json(await register(request, env), origin, 201);
    if (pathname === "/auth/login" && method === "POST") return json(await login(request, env), origin);
    if (pathname === "/auth/logout" && method === "POST") return json(await logout(request, env), origin);
    if (pathname === "/auth/me" && method === "GET") {
      const user = await currentUser(request, env);
      return user ? json({ user }, origin) : error("Du är inte inloggad.", origin, 401);
    }
    if (pathname === "/auth/me" && method === "DELETE") return json(await deleteAccount(request, env), origin);
    if (pathname === "/auth/verify" && method === "POST") return json(await verifyEmail(request, env), origin);
    if (pathname === "/auth/resend-verification" && method === "POST")
      return json(await resendVerification(request, env), origin);
    if (pathname === "/auth/forgot" && method === "POST") return json(await forgotPassword(request, env), origin);
    if (pathname === "/auth/reset" && method === "POST") return json(await resetPassword(request, env), origin);

    if (pathname === "/observations" && method === "GET") return json(await listObservations(request, env), origin);
    if (pathname === "/observations" && method === "POST")
      return json(await createObservation(request, env), origin, 201);
    if (pathname === "/admin/reported" && method === "GET") return json(await listReported(request, env), origin);

    const obsMatch = pathname.match(/^\/observations\/(\d+)(\/report|\/restore)?$/);
    if (obsMatch) {
      const id = Number(obsMatch[1]);
      if (obsMatch[2] === "/report" && method === "POST") return json(await reportObservation(request, env, id), origin);
      if (obsMatch[2] === "/restore" && method === "POST")
        return json(await restoreObservation(request, env, id), origin);
      if (!obsMatch[2] && method === "DELETE") return json(await deleteObservation(request, env, id), origin);
    }

    if (pathname.startsWith("/images/") && method === "GET") {
      return await serveImage(env, pathname.slice("/images/".length), corsHeaders(origin));
    }
  } catch (err) {
    if (err instanceof HttpError) return error(err.message, origin, err.status);
    console.error(err);
    return error("Något gick fel på servern. Försök igen.", origin, 500);
  }
  return null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = env.ALLOWED_ORIGIN ?? "*";
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    if (url.pathname === "/forecasts") {
      const cache = caches.default;
      const cacheKey = new Request(url.toString(), request);
      const cached = await cache.match(cacheKey);
      if (cached) {
        return new Response(cached.body, {
          headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
        });
      }

      const results = await Promise.all(
        REGION_SOURCES.map((r) => fetchRegion(r.id, r.slugs))
      );

      const response = new Response(JSON.stringify({ regions: results }), {
        headers: {
          ...corsHeaders(origin),
          "Content-Type": "application/json",
          "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS}`,
        },
      });
      await cache.put(cacheKey, response.clone());
      return response;
    }

    if (url.pathname === "/topowebb") {
      return proxyTopowebb(request, env, origin);
    }

    const community = await handleCommunity(request, env, origin);
    if (community) return community;

    if (url.pathname === "/health") {
      return new Response("ok", { headers: corsHeaders(origin) });
    }

    return new Response("Not found", { status: 404, headers: corsHeaders(origin) });
  },
};
