// Builds src/data/ortnamn.json: place names for the map search, from
// OpenStreetMap through the Overpass API (cloud sessions can't reach it, so
// .github/workflows/ortnamn.yml runs this and commits the file).
//
// Covers the Swedish mountains and the Norwegian side of the border:
// peaks, passes, glaciers, huts, mountain stations and shelters, villages,
// stations, valleys, ridges, border cairns and named lakes. Each entry: [name, lat, lon, kind, ele, alts]
// (ele 0 = unknown, alts = other names such as Sami or Swedish forms).
// OSM data is ODbL: the app credits "© OpenStreetMap-bidragsgivare (ODbL)"
// next to the results, and this file is itself public.

import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "data", "ortnamn.json");

const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

// south, west, north, east – in bands, so no single query gets too big.
const BANDS = [
  [61.0, 11.0, 62.5, 24.5],
  [62.5, 11.0, 64.0, 24.5],
  [64.0, 11.0, 65.5, 24.5],
  [65.5, 11.0, 67.0, 24.5],
  [67.0, 11.0, 68.2, 24.5],
  [68.2, 11.0, 69.5, 24.5],
];

const ALT_KEYS = ["name:sv", "name:se", "name:smj", "name:sma", "name:sju", "name:nb", "name:no", "name:fi", "alt_name", "official_name", "loc_name", "old_name"];

function query([s, w, n, e]) {
  const b = `${s},${w},${n},${e}`;
  return `[out:json][timeout:600];
(
  node["natural"~"^(peak|volcano|saddle)$"]["name"](${b});
  node["mountain_pass"="yes"]["name"](${b});
  nwr["natural"="glacier"]["name"](${b});
  nwr["natural"~"^(valley|ridge|arete)$"]["name"](${b});
  node["place"~"^(city|town|village|hamlet|locality)$"]["name"](${b});
  nwr["tourism"~"^(alpine_hut|wilderness_hut|hostel|hotel|chalet|guest_house)$"]["name"](${b});
  nwr["natural"="mountain_range"]["name"](${b});
  node["historic"="boundary_stone"]["name"](${b});
  nwr["amenity"="shelter"]["name"](${b});
  nwr["railway"~"^(station|halt)$"]["name"](${b});
  way["natural"="water"]["name"](${b});
  relation["natural"="water"]["name"](${b});
);
out tags center;`;
}

function kindOf(tags) {
  if (tags.natural === "peak" || tags.natural === "volcano") return "p";
  if (tags.natural === "saddle" || tags.mountain_pass === "yes") return "m";
  if (tags.natural === "glacier") return "g";
  if (tags.historic) return "b"; // border cairns such as Treriksröset
  if (tags.tourism) return "h"; // huts, mountain stations, hostels
  if (tags.amenity === "shelter") return "s";
  if (tags.railway) return "t";
  if (tags.place) return "v";
  if (tags.natural === "water") return "l";
  if (tags.natural === "valley") return "d";
  return "r"; // ridge, arete, mountain range
}

function elevation(tags) {
  const m = /^(-?\d+(?:[.,]\d+)?)/.exec(tags.ele ?? "");
  if (!m) return 0;
  const v = Math.round(Number(m[1].replace(",", ".")));
  return v > 0 && v < 2600 ? v : 0;
}

async function overpass(q) {
  let lastError;
  for (let round = 0; round < 3; round++) {
    for (const url of MIRRORS) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Snolage/1.0 (+https://snolage.se)" },
          body: new URLSearchParams({ data: q }),
          signal: AbortSignal.timeout(700_000),
        });
        if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
        const json = await res.json();
        if (json.remark && /runtime error|timed out|out of memory/i.test(json.remark)) throw new Error(`${url}: ${json.remark}`);
        return json.elements ?? [];
      } catch (err) {
        lastError = err;
        console.warn(String(err));
        await new Promise((r) => setTimeout(r, 15_000));
      }
    }
  }
  throw lastError;
}

// Only the mountains: from 2.5° of longitude west of the Swedish–Norwegian
// border (roughly 100 km into Norway) to just east of where the Swedish
// mountains end. Without this, farms and forest lakes far from any fjäll made
// up most of the 110 000 names (seen 2026-11-13).
const BORDER = [[61.0, 12.3], [62.5, 12.1], [63.5, 12.2], [64.5, 13.9], [65.5, 14.6], [66.5, 15.6], [67.5, 16.5], [68.2, 17.9], [68.5, 18.6], [69.1, 20.6], [69.5, 21.5]];
const MOUNTAIN_EDGE = [[61.0, 13.6], [62.0, 13.6], [63.0, 14.3], [64.0, 15.3], [65.0, 16.3], [66.0, 17.3], [67.0, 19.0], [68.0, 21.0], [69.0, 22.5], [69.5, 23.0]];
function along(line, lat) {
  if (lat <= line[0][0]) return line[0][1];
  for (let i = 1; i < line.length; i++) {
    const [a, x] = line[i - 1];
    const [b, y] = line[i];
    if (lat <= b) return x + ((y - x) * (lat - a)) / (b - a);
  }
  return line[line.length - 1][1];
}
const inMountains = (lat, lon) => lon >= along(BORDER, lat) - 2.5 && lon <= along(MOUNTAIN_EDGE, lat) + 0.5;

const round5 = (v) => Math.round(v * 1e5) / 1e5;
const seen = new Map();
const places = [];

for (const band of BANDS) {
  const elements = await overpass(query(band));
  console.log(`band ${band.join(",")}: ${elements.length} elements`);
  for (const el of elements) {
    const tags = el.tags ?? {};
    const name = (tags.name ?? "").trim();
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (!name || typeof lat !== "number" || typeof lon !== "number" || !inMountains(lat, lon)) continue;
    const kind = kindOf(tags);
    // Same name and kind within ~1 km (a lake as both way and relation, a band edge): keep one.
    const key = `${kind}|${name.toLowerCase()}|${Math.round(lat * 100)}|${Math.round(lon * 50)}`;
    if (seen.has(key)) continue;
    seen.set(key, true);
    const alts = [...new Set(ALT_KEYS.flatMap((k) => (tags[k] ?? "").split(";").map((s) => s.trim())).filter((s) => s && s !== name))];
    const entry = [name, round5(lat), round5(lon), kind, elevation(tags)];
    if (alts.length) entry.push(alts);
    places.push(entry);
  }
}

places.sort((a, b) => a[0].localeCompare(b[0], "sv"));
const counts = {};
for (const p of places) counts[p[3]] = (counts[p[3]] ?? 0) + 1;

const body = JSON.stringify({
  source: "© OpenStreetMap-bidragsgivare, ODbL 1.0 (https://www.openstreetmap.org/copyright)",
  fetched: new Date().toISOString().slice(0, 10),
  places,
});
writeFileSync(OUT, body);
console.log(`places: ${places.length}`, counts);
console.log(`size: ${(body.length / 1e6).toFixed(2)} MB, gzip ${(gzipSync(body).length / 1e6).toFixed(2)} MB`);
