// A stand-in for the worker while the demo video is recorded in an Android
// emulator (.github/workflows/play-video.yml): sample answers from
// mockApi.mjs, a working "Dela position", and real map tiles fetched from
// kartor.snolage.se. Listens on 8787 (the emulator reaches it as 10.0.2.2).
import http from "node:http";
import { API, respond } from "./mockApi.mjs";

const PORT = 8787;
const iso = (minutes) => new Date(Date.now() + minutes * 60_000).toISOString();
const person = (id, displayName, companion, xp) => ({ id, displayName, avatarPath: null, xp, isAdmin: false, companion });

let share = null;
let lingering = null;

const friends = () => [
  { ...person(3, "Anna", false, 900), startedAt: iso(-40), endsAt: iso(200), ended: false, keptUntil: null, position: { lat: 67.904, lon: 18.53, accuracy: 15, at: iso(-2) } },
];

function location(path, method, body) {
  if (path === "/location/share" && method === "GET") {
    return { share, lingering, candidates: [person(3, "Anna", true, 900), person(2, "Bertil", false, 420)] };
  }
  if (path === "/location/share" && method === "POST") {
    const hours = Number(body?.hours) || 2;
    share = { startedAt: iso(0), endsAt: iso(hours * 60), position: null, viewers: [person(3, "Anna", true, 900), person(2, "Bertil", false, 420)].filter((p) => (body?.viewerIds ?? []).includes(p.id)) };
    return { share };
  }
  if (path === "/location/share" && method === "DELETE") {
    share = null;
    lingering = null;
    return { ok: true };
  }
  if (path === "/location/position") {
    if (!share) return { status: 404, error: "Du delar inte din position just nu." };
    share.position = { lat: body?.lat, lon: body?.lon, accuracy: body?.accuracy ?? null, at: iso(0) };
    console.log("position", body?.lat, body?.lon);
    return { endsAt: share.endsAt };
  }
  if (path === "/location/shared-with-me") return { people: friends() };
  return null;
}

const server = http.createServer(async (req, res) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  };
  if (req.method === "OPTIONS") {
    res.writeHead(204, headers);
    return res.end();
  }
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;
  let raw = "";
  for await (const chunk of req) raw += chunk;
  let body = null;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    body = null;
  }
  const send = (status, data) => {
    res.writeHead(status, { ...headers, "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  };

  const tile = path.match(/^\/tiles\/topowebb\/(\d+)\/(\d+)\/(\d+)\.png$/);
  if (tile) {
    try {
      const r = await fetch(`https://kartor.snolage.se/topowebb/${tile[1]}/${tile[2]}/${tile[3]}.png`);
      if (r.ok) {
        res.writeHead(200, { ...headers, "Content-Type": "image/png", "Cache-Control": "max-age=3600" });
        return res.end(Buffer.from(await r.arrayBuffer()));
      }
    } catch {
      // Fall through to OpenStreetMap.
    }
    res.writeHead(302, { ...headers, Location: `https://tile.openstreetmap.org/${tile[1]}/${tile[2]}/${tile[3]}.png` });
    return res.end();
  }
  if (path === "/auth/login" && req.method === "POST") {
    const me = respond(`${API}/auth/me`, "GET");
    return send(200, { token: "demo-token", user: me.json.user });
  }
  const loc = location(path, req.method, body);
  if (loc) return loc.status ? send(loc.status, { error: loc.error }) : send(200, loc);

  const answer = respond(`${API}${path}${url.search}`, req.method);
  if (!answer) return send(404, { error: "Finns inte." });
  // As it is out of season now: no danger levels at all in the video.
  if (path === "/forecasts") {
    for (const r of answer.json.regions) {
      Object.assign(r, { danger: null, seasonOver: true, notAssessed: false, headline: "Prognossäsongen är avslutad", mainMessage: null, problems: [] });
    }
  }
  if (path.startsWith("/forecasts/history")) for (const d of answer.json.days) Object.assign(d, { danger: null, problems: [] });
  return send(answer.status ?? 200, answer.json ?? {});
});

server.listen(PORT, "0.0.0.0", () => console.log(`Demo server on ${PORT}`));
