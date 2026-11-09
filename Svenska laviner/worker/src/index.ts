import { dismissContentReports, listContentReports, removeReportedContent, reportContent } from "./reports";
import { REGION_SOURCES } from "./regions";
import { parseForecastHtml, type ParsedForecast } from "./parse";
import {
  API_AREA_IDS,
  currentSeasonYear,
  currentUrl,
  seasonSummary,
  mergeForecasts,
  seasonUrls,
  forecastFromApi,
  forecastInForce,
  historyRowsFromApi,
  readForecasts,
  recentUrl,
  type ApiForecast,
  type SpecialRisk,
} from "./forecastApi";
import { findChanges, historyRow, readHistory, recordHistory, type HistoryRow } from "./history";
import { getFavorites, saveFavorites } from "./favorites";
import { createTour, deleteTour, getTour, importedSources, listTours, tourLinesBody, updateTour } from "./tours";
import { createRoute, deleteRoute, getRoute, listMyRoutes, updateRoute } from "./routes";
import { badgesOf, removeAvatar, uploadAvatar } from "./profile";
import {
  listNotifications,
  markRead,
  subscribeUserPush,
  unread,
  unsubscribeUserPush,
  userPushStatus,
} from "./notifications";
import {
  addComment,
  deleteComment,
  feed,
  follow,
  getPerson,
  listComments,
  myBlocks,
  myFollows,
  searchPeople,
  setLike,
  unfollow,
} from "./social";
import { block, unblock } from "./blocks";
import { parseTerrainPath, serveTerrain } from "./terrain";
import { cleanupOldTiles, migrateTiles, parseSlopePath, proxyTopowebbFile, parseTilePath, saveSlopeMeta, serveSlopeTile, serveTile, slopeMeta, uploadTiles, type TilesEnv } from "./tiles";
import { publicKey, setPushLanguage, subscribe, unsubscribe, type PushEnv } from "./push";
import { DRAIN_PATH, drainKey, drainOutbox, queueChanges, sendQueued } from "./outbox";
import { registerDevice, setDeviceLanguage, unregisterDevice } from "./nativePush";
import type { NotifyEnv } from "./notifications";
import { createTrip, deleteTrip, listTrips, notifyTrips, type PublishedDay } from "./trips";
import { answerInvitation, inviteToTrip } from "./tripInvites";
import { myShare, notifyEndedShares, pruneShares, sharedWithMe, startShare, stopShare, updatePosition } from "./locationShare";
import { adminStats } from "./adminStats";
import { checkForecastHealth } from "./health";
import { seasonStartReport } from "./seasonReport";
import { runBackup } from "./backup";
import { fetchWarnings, WARNINGS_PAGE } from "./warnings";
import { fetchSnowModel, SNOW_CELLS } from "./snowModel";
import { fcmConfigured, type FcmEnv } from "./fcm";
import { stockholmDate } from "./model";
import type { VapidEnv } from "./webpush";
import { corsHeaders, error, HttpError, json } from "./http";
import {
  type CommunityEnv,
  currentUser,
  deleteAccount,
  pruneAuth,
  forgotPassword,
  login,
  logout,
  register,
  resendVerification,
  resetPassword,
  setLanguage,
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

export interface Env extends CommunityEnv, VapidEnv, TilesEnv, FcmEnv {
  /** This worker itself (service binding), for sending queued push in runs of their own. */
  SELF?: Fetcher;
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
  /** "api" (Naturvårdsverket's open API) or "page" (read from lavinprognoser.se). */
  source?: "api" | "page";
  /** Risk 6 "Vårförhållanden" / 7 "Ingen lavinfara": a real answer, but not a level 1–5. */
  special?: SpecialRisk | null;
  riskLabel?: string | null;
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
    mainMessage: null,
    problems: [],
    validUntil: null,
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
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
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

/** Naturvårdsverket's API and pages: an answer within this, or the next fallback. */
const UPSTREAM_TIMEOUT_MS = 10_000;

const API_HEADERS = { "User-Agent": "Snolage/1.0 (https://snolage.se; fabian.n.sund@gmail.com)" };

/** One API answer; if the server dislikes our property list, asks again for everything. */
async function apiForecasts(urlWith: string, urlWithout: string): Promise<ApiForecast[]> {
  for (const url of [urlWith, urlWithout]) {
    // A hung API must not hold the forecasts up: the page scraper takes over.
    const res = await fetch(url, {
      headers: API_HEADERS,
      cf: { cacheTtl: CACHE_TTL_SECONDS, cacheEverything: true },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    }).catch(() => null);
    if (!res?.ok) continue;
    try {
      return readForecasts(await res.json());
    } catch {
      continue;
    }
  }
  throw new Error("Prognos-API:et svarade inte som väntat.");
}

interface RegionResult {
  forecast: RegionForecastResponse;
  /** Recent days' levels from the API, to fill gaps in the stored history. */
  pastRows: HistoryRow[];
}

/** An area's forecast from Naturvårdsverket's API, or null when the API can't be used. */
async function fetchRegionFromApi(regionId: string, sourceUrl: string, now: Date): Promise<RegionResult | null> {
  const areaId = API_AREA_IDS[regionId];
  if (!areaId) return null;
  try {
    const recent = await apiForecasts(recentUrl(areaId, now), recentUrl(areaId, now, false));
    // Off-season there's no daily forecast; the record covering now says why.
    const current = forecastInForce(recent, now)
      ? []
      : await apiForecasts(currentUrl(areaId), currentUrl(areaId, false));
    const parsed = forecastFromApi(recent, current, now);
    return {
      forecast: { regionId, sourceUrl, fetchedAt: now.toISOString(), fetchError: null, source: "api", ...parsed },
      pastRows: historyRowsFromApi(regionId, recent, now),
    };
  } catch (err) {
    console.error(`Forecast API failed for ${regionId}, reading the page instead`, err);
    return null;
  }
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
/** New heatmap lines show up within this many seconds. */
const LINES_CACHE_SECONDS = 300;

/**
 * The heatmap's 500 lines are the largest answer we send, and every map
 * visit asks for them; keep them in Cloudflare's cache for a few minutes.
 * Signed-in requests (which hide blocked people) are always built fresh.
 */
async function tourLinesResponse(request: Request, env: Env, ctx: ExecutionContext | undefined, origin: string): Promise<Response> {
  const headers = { ...corsHeaders(origin), "Content-Type": "application/json" };
  const cache = typeof caches === "undefined" || request.headers.has("Authorization") ? null : caches.default;
  const key = new Request(new URL(request.url).toString());
  const hit = cache ? await cache.match(key) : undefined;
  if (hit) return new Response(hit.body, { headers });
  const body = await tourLinesBody(request, env);
  if (cache) {
    const stored = cache.put(key, new Response(body, { headers: { "Content-Type": "application/json", "Cache-Control": `public, max-age=${LINES_CACHE_SECONDS}` } }));
    if (ctx) ctx.waitUntil(stored);
    else await stored;
  }
  return new Response(body, { headers });
}

async function handleCommunity(request: Request, env: Env, origin: string, ctx?: ExecutionContext): Promise<Response | null> {
  const defer = ctx ? (work: Promise<unknown>) => ctx.waitUntil(work) : undefined;
  const { pathname } = new URL(request.url);
  const method = request.method;

  try {
    if (pathname === "/auth/register" && method === "POST") return json(await register(request, env), origin, 201);
    if (pathname === "/auth/login" && method === "POST") return json(await login(request, env), origin);
    if (pathname === "/auth/logout" && method === "POST") return json(await logout(request, env), origin);
    if (pathname === "/auth/me" && method === "GET") {
      const user = await currentUser(request, env);
      if (!user) return error("Du är inte inloggad.", origin, 401);
      // Picture and experience too, for the avatar in the app's menu.
      const badge = (await badgesOf(env, [user.id]))[user.id];
      return json({ user: { ...user, ...badge } }, origin);
    }
    if (pathname === "/auth/me" && method === "DELETE") return json(await deleteAccount(request, env), origin);
    if (pathname === "/auth/favorites" && method === "GET") return json(await getFavorites(request, env), origin);
    if (pathname === "/auth/favorites" && method === "POST") return json(await saveFavorites(request, env), origin);
    if (pathname === "/auth/verify" && method === "POST") return json(await verifyEmail(request, env), origin);
    if (pathname === "/auth/resend-verification" && method === "POST")
      return json(await resendVerification(request, env), origin);
    if (pathname === "/auth/lang" && method === "POST") return json(await setLanguage(request, env), origin);
    if (pathname === "/auth/forgot" && method === "POST") return json(await forgotPassword(request, env), origin);
    if (pathname === "/auth/reset" && method === "POST") return json(await resetPassword(request, env), origin);

    if (pathname === "/observations" && method === "GET") return json(await listObservations(request, env), origin);
    if (pathname === "/observations" && method === "POST")
      return json(await createObservation(request, env), origin, 201);
    if (pathname === "/admin/stats" && method === "GET") return json(await adminStats(request, env), origin);
    if (pathname === "/admin/reported" && method === "GET") return json(await listReported(request, env), origin);
    if (pathname === "/reports" && method === "POST") return json(await reportContent(request, env, defer), origin);
    if (pathname === "/admin/content-reports" && method === "GET")
      return json(await listContentReports(request, env), origin);
    if (pathname === "/admin/content-reports/dismiss" && method === "POST")
      return json(await dismissContentReports(request, env), origin);
    if (pathname === "/admin/content-reports/remove" && method === "POST")
      return json(await removeReportedContent(request, env, defer), origin);

    const obsMatch = pathname.match(/^\/observations\/(\d+)(\/report|\/restore)?$/);
    if (obsMatch) {
      const id = Number(obsMatch[1]);
      if (obsMatch[2] === "/report" && method === "POST") return json(await reportObservation(request, env, id, defer), origin);
      if (obsMatch[2] === "/restore" && method === "POST")
        return json(await restoreObservation(request, env, id), origin);
      if (!obsMatch[2] && method === "DELETE") return json(await deleteObservation(request, env, id), origin);
    }

    if (pathname === "/feed" && method === "GET") return json(await feed(request, env), origin);
    if (pathname === "/people" && method === "GET") return json(await searchPeople(request, env), origin);
    if (pathname === "/people/me/follows" && method === "GET") return json(await myFollows(request, env), origin);
    if (pathname === "/people/me/blocks" && method === "GET") return json(await myBlocks(request, env), origin);
    const blockMatch = pathname.match(/^\/people\/(\d+)\/block$/);
    if (blockMatch && method === "POST") return json(await block(request, env, Number(blockMatch[1])), origin);
    if (blockMatch && method === "DELETE") return json(await unblock(request, env, Number(blockMatch[1])), origin);
    if (pathname === "/auth/avatar" && method === "POST") return json(await uploadAvatar(request, env), origin);
    if (pathname === "/auth/avatar" && method === "DELETE") return json(await removeAvatar(request, env), origin);
    const avatarMatch = pathname.match(/^\/people\/(\d+)\/avatar$/);
    if (avatarMatch && method === "DELETE") return json(await removeAvatar(request, env, Number(avatarMatch[1])), origin);
    const personMatch = pathname.match(/^\/people\/(\d+)(\/follow)?$/);
    if (personMatch) {
      const id = Number(personMatch[1]);
      if (!personMatch[2] && method === "GET") return json(await getPerson(request, env, id), origin);
      if (personMatch[2] && method === "POST") return json(await follow(request, env, id, defer), origin);
      if (personMatch[2] && method === "DELETE") return json(await unfollow(request, env, id), origin);
    }
    if (pathname === "/comments" && method === "GET") return json(await listComments(request, env), origin);
    if (pathname === "/comments" && method === "POST") return json(await addComment(request, env, defer), origin, 201);
    const commentMatch = pathname.match(/^\/comments\/(\d+)$/);
    if (commentMatch && method === "DELETE") return json(await deleteComment(request, env, Number(commentMatch[1])), origin);
    if (pathname === "/likes" && method === "POST") return json(await setLike(request, env, defer), origin);
    if (pathname === "/notifications" && method === "GET") return json(await listNotifications(request, env), origin);
    if (pathname === "/notifications/unread" && method === "GET") return json(await unread(request, env), origin);
    if (pathname === "/notifications/read" && method === "POST") return json(await markRead(request, env), origin);
    if (pathname === "/notifications/push" && method === "POST") return json(await subscribeUserPush(request, env), origin);
    if (pathname === "/notifications/push/off" && method === "POST") return json(await unsubscribeUserPush(request, env), origin);
    if (pathname === "/notifications/push/status" && method === "POST") return json(await userPushStatus(request, env), origin);

    if (pathname === "/trips" && method === "GET") return json(await listTrips(request, env), origin);
    if (pathname === "/trips" && method === "POST") return json(await createTrip(request, env), origin, 201);
    const tripMatch = pathname.match(/^\/trips\/(\d+)$/);
    if (tripMatch && method === "DELETE") return json(await deleteTrip(request, env, Number(tripMatch[1])), origin);
    const inviteMatch = pathname.match(/^\/trips\/(\d+)\/invites$/);
    if (inviteMatch && method === "POST") return json(await inviteToTrip(request, env, Number(inviteMatch[1]), defer), origin);
    const answerMatch = pathname.match(/^\/trips\/invitations\/(\d+)$/);
    if (answerMatch && method === "POST") return json(await answerInvitation(request, env, Number(answerMatch[1]), defer), origin);

    if (pathname === "/location/share" && method === "GET") return json(await myShare(request, env), origin);
    if (pathname === "/location/share" && method === "POST") return json(await startShare(request, env, defer), origin);
    if (pathname === "/location/share" && method === "DELETE") return json(await stopShare(request, env), origin);
    if (pathname === "/location/position" && method === "POST") return json(await updatePosition(request, env), origin);
    if (pathname === "/location/shared-with-me" && method === "GET") return json(await sharedWithMe(request, env), origin);

    if (pathname === "/routes" && method === "GET") return json(await listMyRoutes(request, env), origin);
    if (pathname === "/routes" && method === "POST") return json(await createRoute(request, env), origin, 201);
    const routeMatch = pathname.match(/^\/routes\/(\d+)$/);
    if (routeMatch) {
      const id = Number(routeMatch[1]);
      if (method === "GET") return json(await getRoute(request, env, id), origin);
      if (method === "POST") return json(await updateRoute(request, env, id), origin);
      if (method === "DELETE") return json(await deleteRoute(request, env, id), origin);
    }

    if (pathname === "/tours" && method === "GET") return json(await listTours(request, env), origin);
    if (pathname === "/tours" && method === "POST") return json(await createTour(request, env), origin, 201);
    if (pathname === "/tours/lines" && method === "GET") return tourLinesResponse(request, env, ctx, origin);
    if (pathname === "/tours/sources" && method === "GET") return json(await importedSources(request, env), origin);
    const tourMatch = pathname.match(/^\/tours\/(\d+)$/);
    if (tourMatch) {
      const id = Number(tourMatch[1]);
      if (method === "GET") return json(await getTour(request, env, id), origin);
      if (method === "POST") return json(await updateTour(request, env, id), origin);
      if (method === "DELETE") return json(await deleteTour(request, env, id), origin);
    }

    if (pathname.startsWith("/images/") && method === "GET") {
      return await serveImage(env, pathname.slice("/images/".length), corsHeaders(origin));
    }
  } catch (err) {
    if (err instanceof HttpError) return error(err.message, origin, err.status, err.extra);
    console.error(err);
    return error("Något gick fel på servern. Försök igen.", origin, 500);
  }
  return null;
}

/** Every area: from the official API when it answers, otherwise from lavinprognoser.se's page. */
async function fetchAllRegions(): Promise<RegionResult[]> {
  const now = new Date();
  return Promise.all(
    REGION_SOURCES.map(async (r) => {
      const fromApi = await fetchRegionFromApi(r.id, `${SOURCE_BASE}/${r.slugs[0]}/`, now);
      if (fromApi) return fromApi;
      return { forecast: { ...(await fetchRegion(r.id, r.slugs)), source: "page" as const }, pastRows: [] };
    })
  );
}

/**
 * Saves today's published levels and notifies subscribers of any change;
 * never lets a database or push problem break forecasts.
 */
async function recordAll(env: Env, results: RegionResult[]): Promise<void> {
  if (!env.DB) return;
  const rows = results
    .map((r) => historyRow(r.forecast.regionId, r.forecast))
    .filter((r): r is HistoryRow => r !== null);
  // Earlier days from the API fill gaps (days nobody opened the app), but
  // only today's forecasts may trigger notifications.
  const current = new Set(rows.map((r) => `${r.regionId}|${r.date}`));
  const past = results.flatMap((r) => r.pastRows).filter((r) => !current.has(`${r.regionId}|${r.date}`));
  try {
    const now = new Date();
    const changes = await findChanges(env.DB, rows);
    await recordHistory(env.DB, [...past, ...rows], now);
    if (await queueChanges(env, changes, stockholmDate(now))) await sendQueued(env);
  } catch (err) {
    console.error("Could not record forecast history or send notifications", err);
  }
  try {
    // Ended position shares are also deleted whenever someone looks; this
    // catches the rest.
    await pruneShares(env);
  } catch (err) {
    console.error("Could not prune position shares", err);
  }
  try {
    await checkForecastHealth(
      env,
      results.map((r) => ({
        regionId: r.forecast.regionId,
        source: r.forecast.source,
        fetchError: r.forecast.fetchError,
        danger: r.forecast.danger,
        seasonOver: r.forecast.seasonOver,
        special: r.forecast.special ?? null,
      }))
    );
  } catch (err) {
    console.error("Could not check the forecast health", err);
  }
  try {
    await seasonStartReport(env, results.map((r) => r.forecast));
  } catch (err) {
    console.error("Could not send the season-start report", err);
  }
  try {
    const published: PublishedDay[] = results.flatMap((r) => {
      const row = historyRow(r.forecast.regionId, r.forecast);
      if (!row) return [];
      const problems = r.forecast.problems.map((p) => ({
        type: p.type,
        name: p.name,
        aspects: p.aspects,
        elevations: p.elevations,
        metersAbove: p.metersAbove,
        metersBelow: p.metersBelow,
      }));
      return [{ regionId: row.regionId, date: row.date, danger: row.danger, problems }];
    });
    await notifyTrips(env as unknown as NotifyEnv, published, new Date(), undefined, () => fetchWarnings());
  } catch (err) {
    console.error("Could not send trip forecasts", err);
  }
}

const WARNINGS_CACHE_TTL_SECONDS = 60 * 10;

/** GET /warnings: SMHI's weather warnings per forecast area, cached ten minutes. */
async function warningsResponse(request: Request, ctx: ExecutionContext, origin: string): Promise<Response> {
  const cache = caches.default;
  const key = new Request(new URL("/warnings", request.url).toString());
  const hit = await cache.match(key);
  if (hit) return new Response(hit.body, { headers: { ...corsHeaders(origin), "Content-Type": "application/json" } });
  try {
    const regions = await fetchWarnings();
    const response = new Response(JSON.stringify({ regions, source: WARNINGS_PAGE, fetchedAt: new Date().toISOString() }), {
      headers: { ...corsHeaders(origin), "Content-Type": "application/json", "Cache-Control": `public, max-age=${WARNINGS_CACHE_TTL_SECONDS}` },
    });
    ctx.waitUntil(cache.put(key, response.clone()));
    return response;
  } catch (err) {
    console.error("SMHI warnings failed", err);
    return error("SMHI:s varningar kunde inte hämtas just nu.", origin, 502);
  }
}

/** seNorge updates once a day; a few hours keeps NVE's server out of every page view. */
const SNOW_MODEL_CACHE_TTL_SECONDS = 60 * 60 * 3;

/** GET /snow/model?region=<id>: modelled snow depth (seNorge) at three heights in the area. */
async function snowModelResponse(request: Request, ctx: ExecutionContext, origin: string): Promise<Response> {
  const regionId = new URL(request.url).searchParams.get("region") ?? "";
  if (!SNOW_CELLS[regionId]) return error("Okänt område.", origin, 404);
  const cache = caches.default;
  const key = new Request(new URL(`/snow/model?region=${encodeURIComponent(regionId)}&v=1`, request.url).toString());
  const hit = await cache.match(key);
  if (hit) return new Response(hit.body, { headers: { ...corsHeaders(origin), "Content-Type": "application/json" } });
  try {
    const model = await fetchSnowModel(regionId);
    if (!model || model.cells.length === 0) return error("Snödata från seNorge kunde inte hämtas just nu.", origin, 502);
    const response = new Response(JSON.stringify(model), {
      headers: { ...corsHeaders(origin), "Content-Type": "application/json", "Cache-Control": `public, max-age=${SNOW_MODEL_CACHE_TTL_SECONDS}` },
    });
    ctx.waitUntil(cache.put(key, response.clone()));
    return response;
  } catch (err) {
    console.error("seNorge failed", err);
    return error("Snödata från seNorge kunde inte hämtas just nu.", origin, 502);
  }
}

/** The weekly backup's cron in wrangler.toml; the others fetch forecasts. */
const BACKUP_CRON = "37 2 * * 1";
/** Every quarter of an hour: position shares that ran out without being stopped, and queued push. */
const SHARES_CRON = "*/15 * * * *";

const HISTORY_CACHE_TTL_SECONDS = 60 * 10;
/** Finished seasons never change; the current one grows twice a day. */
const PAST_SEASON_TTL_SECONDS = 60 * 60 * 24 * 7;
const CURRENT_SEASON_TTL_SECONDS = 60 * 60;
const FIRST_SEASON = 2016;

/** A whole season's daily levels and problems for one area, from the official API. */
async function forecastSeason(request: Request, url: URL, origin: string): Promise<Response> {
  const regionId = url.searchParams.get("region") ?? "";
  const areaId = API_AREA_IDS[regionId];
  if (!areaId) return error("Okänt område.", origin, 400);
  const now = new Date();
  const current = currentSeasonYear(now);
  const season = Number(url.searchParams.get("season") ?? current);
  if (!Number.isInteger(season) || season < FIRST_SEASON || season > current) {
    return error("Okänd säsong.", origin, 400);
  }
  const cache = caches.default;
  // v=2: answers cached before the season was fetched in pieces only covered its last weeks.
  const cacheKey = new Request(`${url.origin}/forecasts/season?region=${regionId}&season=${season}&v=2`, request);
  const hit = await cache.match(cacheKey);
  if (hit) return new Response(hit.body, { headers: { ...corsHeaders(origin), "Content-Type": "application/json" } });
  try {
    // Only with the property list: a season's worth of area polygons would be tens of MB.
    // In two-week pieces: one request for the whole season only returned its last weeks.
    const withProps = seasonUrls(areaId, season);
    const lists = await Promise.all(withProps.map((u) => apiForecasts(u, u)));
    const list = mergeForecasts(lists);
    const body = JSON.stringify({ regionId, season, ...seasonSummary(list, now) });
    const ttl = season === current ? CURRENT_SEASON_TTL_SECONDS : PAST_SEASON_TTL_SECONDS;
    const response = new Response(body, {
      headers: { ...corsHeaders(origin), "Content-Type": "application/json", "Cache-Control": `public, max-age=${ttl}` },
    });
    await cache.put(cacheKey, response.clone());
    return response;
  } catch (err) {
    console.error(err);
    return error("Kunde inte hämta säsongen från Naturvårdsverket just nu.", origin, 502);
  }
}

async function forecastHistory(url: URL, env: Env, origin: string): Promise<Response> {
  const regionId = url.searchParams.get("region") ?? "";
  if (!REGION_SOURCES.some((r) => r.id === regionId)) return error("Okänt område.", origin, 400);
  const days = Math.min(30, Math.max(1, Number(url.searchParams.get("days")) || 7));
  try {
    const history = await readHistory(env.DB, regionId, new Date(), days);
    return new Response(JSON.stringify({ regionId, days: history }), {
      headers: {
        ...corsHeaders(origin),
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${HISTORY_CACHE_TTL_SECONDS}`,
      },
    });
  } catch (err) {
    console.error(err);
    return error("Kunde inte läsa prognoshistoriken.", origin, 500);
  }
}

export default {
  /**
   * Runs shortly after forecasts are published (08:00 and 18:00 Swedish
   * time, see wrangler.toml) so history builds up even on days nobody
   * opens the app.
   */
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    if (controller.cron === SHARES_CRON) {
      if (env.DB) {
        ctx.waitUntil(
          notifyEndedShares(env, new Date(), (p) => ctx.waitUntil(p))
            .then(() => pruneShares(env))
            // Danger-level notices left over from a big round.
            .then(() => sendQueued(env))
            .catch((err) => console.error("Position share check failed", err))
        );
      }
      return;
    }
    if (controller.cron === BACKUP_CRON) {
      ctx.waitUntil(runBackup(env).catch((err) => console.error("Backup failed", err)));
      return;
    }
    ctx.waitUntil(fetchAllRegions().then((results) => recordAll(env, results)));
    if (env.DB) ctx.waitUntil(pruneAuth(env).catch((err) => console.error("Session pruning failed", err)));
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const origin = env.ALLOWED_ORIGIN ?? "*";
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    if (url.pathname === "/forecasts") {
      const cache = caches.default;
      // One key whatever the query string, so ?x=1 can't skip the cache (and a fetch of every area).
      const cacheKey = new Request(`${url.origin}/forecasts`);
      const cached = await cache.match(cacheKey);
      if (cached) {
        return new Response(cached.body, {
          headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
        });
      }

      const results = await fetchAllRegions();
      ctx.waitUntil(recordAll(env, results));

      const response = new Response(JSON.stringify({ regions: results.map((r) => r.forecast) }), {
        headers: {
          ...corsHeaders(origin),
          "Content-Type": "application/json",
          "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS}`,
        },
      });
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
      return response;
    }

    if (url.pathname === DRAIN_PATH && request.method === "POST") {
      if (!env.DB || request.headers.get("X-Drain-Key") !== (await drainKey(env))) return new Response("Not found", { status: 404 });
      return Response.json({ sent: await drainOutbox(env) });
    }

    if (url.pathname === "/warnings" && request.method === "GET") return warningsResponse(request, ctx, origin);
    if (url.pathname === "/snow/model" && request.method === "GET") return snowModelResponse(request, ctx, origin);

    const tile = request.method === "GET" ? parseTilePath(url.pathname) : null;
    if (tile) return serveTile(request, env, ctx, origin, tile);
    const terrain = request.method === "GET" ? parseTerrainPath(url.pathname) : null;
    if (terrain) return serveTerrain(request, ctx, origin, terrain);
    if (url.pathname === "/admin/tiles/topowebb" && request.method === "POST") {
      return uploadTiles(request, env, origin);
    }
    if (url.pathname === "/admin/tiles/slope" && request.method === "POST") return uploadTiles(request, env, origin, "slope");
    if (url.pathname === "/admin/tiles/slope/meta" && request.method === "POST") return saveSlopeMeta(request, env, origin);
    if (url.pathname === "/admin/tiles/migrate" && request.method === "POST") return migrateTiles(request, env, origin);
    if (url.pathname === "/admin/tiles/cleanup" && request.method === "POST") return cleanupOldTiles(request, env, origin);
    if (url.pathname === "/admin/lantmateriet/topowebb-3857.gpkg" && request.method === "GET") return proxyTopowebbFile(request, env);
    if (url.pathname === "/tiles/slope/meta" && request.method === "GET") return slopeMeta(env, origin);
    const slopeTile = request.method === "GET" ? parseSlopePath(url.pathname) : null;
    if (slopeTile) return serveSlopeTile(request, env, ctx, origin, slopeTile);

    if (url.pathname === "/native/status" && request.method === "GET") {
      return json({ enabled: fcmConfigured(env) }, origin);
    }
    if (url.pathname.startsWith("/native/") && request.method === "POST") {
      try {
        if (url.pathname === "/native/register") return json(await registerDevice(request, env), origin);
        if (url.pathname === "/native/unregister") return json(await unregisterDevice(request, env), origin);
        if (url.pathname === "/native/lang") return json(await setDeviceLanguage(request, env), origin);
      } catch (err) {
        if (err instanceof HttpError) return error(err.message, origin, err.status, err.extra);
        console.error(err);
        return error("Något gick fel på servern. Försök igen.", origin, 500);
      }
    }

    if (url.pathname.startsWith("/push/")) {
      try {
        if (url.pathname === "/push/key" && request.method === "GET") return json(publicKey(env as PushEnv), origin);
        if (url.pathname === "/push/subscribe" && request.method === "POST")
          return json(await subscribe(request, env as PushEnv), origin);
        if (url.pathname === "/push/unsubscribe" && request.method === "POST")
          return json(await unsubscribe(request, env as PushEnv), origin);
        if (url.pathname === "/push/lang" && request.method === "POST")
          return json(await setPushLanguage(request, env as PushEnv), origin);
      } catch (err) {
        if (err instanceof HttpError) return error(err.message, origin, err.status, err.extra);
        console.error(err);
        return error("Något gick fel på servern. Försök igen.", origin, 500);
      }
    }

    if (url.pathname === "/forecasts/season" && request.method === "GET") {
      return forecastSeason(request, url, origin);
    }

    if (url.pathname === "/forecasts/history" && request.method === "GET") {
      return forecastHistory(url, env, origin);
    }

    if (url.pathname === "/topowebb") {
      return proxyTopowebb(request, env, origin);
    }

    const community = await handleCommunity(request, env, origin, ctx);
    if (community) return community;

    if (url.pathname === "/health") {
      return new Response("ok", { headers: corsHeaders(origin) });
    }

    return new Response("Not found", { status: 404, headers: corsHeaders(origin) });
  },
};
