import { REGION_SOURCES } from "./regions";
import { parseForecastHtml, type ParsedForecast } from "./parse";

export interface Env {
  ALLOWED_ORIGIN?: string;
}

const SOURCE_BASE = "https://www.lavinprognoser.se/oversikt-alla-omraden";
const CACHE_TTL_SECONDS = 60 * 30;

interface RegionForecastResponse extends ParsedForecast {
  regionId: string;
  sourceUrl: string;
  fetchedAt: string;
  fetchError: string | null;
}

function corsHeaders(origin: string): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

async function fetchRegion(regionId: string, slug: string): Promise<RegionForecastResponse> {
  const sourceUrl = `${SOURCE_BASE}/${slug}/`;
  const fetchedAt = new Date().toISOString();

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

    if (!res.ok) {
      return {
        regionId,
        sourceUrl,
        fetchedAt,
        fetchError: `HTTP ${res.status}`,
        assessed: false,
        danger: null,
        seasonOver: false,
        notAssessed: false,
        confidence: "none",
        headline: null,
        publishedText: null,
      };
    }

    const html = await res.text();
    const parsed = parseForecastHtml(html);

    return { regionId, sourceUrl, fetchedAt, fetchError: null, ...parsed };
  } catch (err) {
    return {
      regionId,
      sourceUrl,
      fetchedAt,
      fetchError: err instanceof Error ? err.message : "unknown fetch error",
      assessed: false,
      danger: null,
      seasonOver: false,
      notAssessed: false,
      confidence: "none",
      headline: null,
      publishedText: null,
    };
  }
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
        REGION_SOURCES.map((r) => fetchRegion(r.id, r.slug))
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

    if (url.pathname === "/health") {
      return new Response("ok", { headers: corsHeaders(origin) });
    }

    return new Response("Not found", { status: 404, headers: corsHeaders(origin) });
  },
};
