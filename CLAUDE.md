# Snöläge (formerly Turkoll / Toppkoll / Fjällkoll) — project state

> **Current name: "Snöläge"** (Fabian's choice 2026-10-05, after
> `toppkoll.se` turned out to be taken; "Turkoll" lasted one commit).
> Branding only, same rules as below (Cloudflare names and `fjallkoll:*`
> keys unchanged). appId **`se.snolage.app`** (Android package dir
> `java/se/snolage/app/`), SW app cache `snolage-app-<version>` (older
> `turkoll-app-`/`toppkoll-app-`/`fjallkoll-app-` caches deleted on
> activate). Domain to register: `snolage.se` (+ `snöläge.se` as an alias
> if free) — `Svenska laviner/DOMAN.md`. ASCII `snolage` in ids/domains,
> "Snöläge" (possessive "Snöläges") in text.

> **Renamed 2026-10-05 from "Fjällkoll" to "Toppkoll"** (user's choice after
> a name check; Fjällklar AB is a nearby competitor name). Only user-visible
> branding changed (UI, titles, manifest, Capacitor appName, Android/iOS
> display names, emails, push titles, GPX creator, docs). **Deliberately
> unchanged:** every Cloudflare resource (`fjallkoll` Pages/D1,
> `fjallkoll-worker`, `fjallkoll-images`), the URL `fjallkoll.pages.dev`,
> and all internal storage keys/caches (`fjallkoll:*` localStorage and
> Preferences, `fjallkoll-tiles-*` caches) so nobody loses saved data.
> Optional later: a new Pages project `snolage` and domain `snolage.se`.

> **Renamed 2026-09-23 from "Fjällvarning" to "Fjällkoll"** (user's
> choice). All branding and Cloudflare resource names in the repo now use
> `fjallkoll`: Pages project `fjallkoll` (→ `fjallkoll.pages.dev`), worker
> `fjallkoll-worker`, D1 `fjallkoll`, R2 `fjallkoll-images`. The OLD
> deployments (`fjallvarning.pages.dev`, `fjallvarning-worker`) still exist
> in Fabian's Cloudflare account until he deletes them.
>
> **Set up 2026-09-25:** D1 `fjallkoll` (id `46459915-…`, jurisdiction
> **eu**, migrations 0001+0002 applied remotely) and R2 `fjallkoll-images`
> (jurisdiction **eu** — pass `--jurisdiction eu` to any `wrangler r2`
> command or it reports the bucket missing) both exist; `wrangler.toml`
> points at them. `fjallkoll-worker` deployed with both `LANTMATERIET_*`
> secrets (`/topowebb` GetCapabilities verified). Pages project
> `fjallkoll` created with production branch `production` and first
> deployed from `claude/bold-lamport-juktha`. Not renamed on purpose:
> the local folder `fjallvarning-repo` and branch `svenska-laviner`.
> Capacitor appId is **`se.snolage.app`** since 2026-10-05 (was
> `com.fabsu951.projekt1`, briefly `se.toppkoll.app`/`se.turkoll.app`; changed
> before any store upload — never change it once published). Domain: Fabian
> is to register `snolage.se` — steps in `Svenska laviner/DOMAN.md`
> (buy at a Swedish registrar, DNS to Cloudflare, Pages custom domain); not
> confirmed bought yet. When done: update `APP_URL`, `VITE_PUBLIC_SITE_URL`,
> store URLs.
> **Bought 2026-10-07 at Loopia:** `snolage.se`, `snöläge.se`, `snolage.online`,
> `snöläge.online` (renew 7 Oct 2027). `snolage.se` added to Cloudflare
> (Free) and its name servers switched to Cloudflare's the same day. Code
> now uses `https://snolage.se` (`APP_URL`, `VITE_PUBLIC_SITE_URL`, Android
> `privacy_policy_url`) — deploy only once the Pages custom domain works.
> Turnstile hostnames `snolage.se` + `www` added; Resend domain `snolage.se`
> (eu-west-1) created; `EMAIL_FROM = "Snöläge <noreply@snolage.se>"` is in
> `wrangler.toml` (inert until the `RESEND_API_KEY` secret exists — set it
> only after Resend says Verified). **Live 2026-10-09:** Pages custom domains
> `snolage.se` + `www` active; Resend domain verified (eu-west-1, `rsend-euw1`;
> a first try landed in Tokyo `apne1` and was redone); `RESEND_API_KEY` set as an
> encrypted worker secret (a first key was pasted as a plain-text var, shown
> in chat, then revoked in Resend and deleted); verification emails work and
> are now enforced. **Redirect domains (2026-10-09):** `snolage.online`,
> `snöläge.online` (`xn--snlge-ira8j.online`) and `snöläge.se` (`xn--snlge-ira8j.se`)
> added to Cloudflare (Free), name servers switched at Loopia (the .online
> ones first needed Loopia's registrant e-mail verification). Each zone: A `@`
> and `www` → 192.0.2.1 proxied, TXT `v=spf1 -all`, `_dmarc` `p=reject`,
> Redirect Rule "Till snolage.se" (all requests → `concat("https://snolage.se",
> http.request.uri.path)`, 301, keep query). Works once each zone is Active.

Swedish avalanche forecast/safety app ("Snöläge") for backcountry skiers,
inspired by Varsom, Rusk, and Skiguide. TypeScript, packaged as both a website
and native iOS/Android apps (Capacitor) from one codebase.

User: Fabian Sund (fabian.n.sund@gmail.com). Dev machine: Windows/PowerShell,
repo cloned locally at `C:\Users\fabia\Documents\fjallvarning-repo`.

## Layout

- All app code lives under `Svenska laviner/app/` (note the **literal space** —
  quote it in shell commands: `cd "Svenska laviner/app"`).
- Cloudflare Worker (map tile proxy + forecast scraper) lives under
  `Svenska laviner/worker/`.
- Git branch: **`svenska-laviner`** (branch names can't contain spaces, hence
  the mismatch with the folder name). Cloud sessions develop on a
  `claude/...` branch and fast-forward `svenska-laviner` when Fabian asks;
  always deploy from `svenska-laviner`.

## Deployment (IMPORTANT — has bitten us before)

- **Site**: Cloudflare Pages project `fjallkoll`. Stable production URL:
  `https://fjallkoll.pages.dev`.
  - Deploy from `Svenska laviner/app` after `npm run build`:
    ```powershell
    npx wrangler pages deploy dist --project-name=fjallkoll --branch=production --commit-dirty=true
    ```
  - **`--branch=production` is required.** Without it, wrangler infers the
    branch from git (`svenska-laviner`), which creates a random-subdomain
    *preview* deployment that never updates `fjallkoll.pages.dev`. This
    caused a real confusion earlier — always redeploy with that flag, and
    always verify on `fjallkoll.pages.dev` itself, never a bookmarked
    preview URL.
  - Must build with `VITE_MAP_PROXY_URL` set (see below) or the map falls
    back to plain OpenStreetMap tiles instead of the Lantmäteriet basemap.
- **Worker**: `fjallkoll-worker`, deployed at
  `https://fjallkoll-worker.fabian-n-sund.workers.dev`. Deploy from
  `Svenska laviner/worker`:
    ```powershell
    npx wrangler deploy
    ```
  - Secrets `LANTMATERIET_USER` / `LANTMATERIET_PASSWORD` are already set
    (Fabian's Geotorget account: email + Geotorget password). Set via
    `npx wrangler secret put <NAME>` if they ever need rotating.
  - Proxies Lantmäteriet's free "Topografisk webbkarta Visning, översiktlig"
    WMTS product at `/topowebb` so those credentials never reach the client
    bundle (this was a deliberate choice over embedding them client-side —
    see commit history around "Add Lantmäteriet topo basemap via Worker
    proxy"). Also has a `/forecasts` route: Naturvårdsverket's open API since 2026-10-06 (see "Official forecast API"), lavinprognoser.se page scraping as fallback.
    The app reads it via `loadForecasts()` in `avalancheService.ts` (same
    `VITE_MAP_PROXY_URL` base). The old synthetic placeholder forecasts are
    **gone on purpose** — anything not fetched/parsed confidently shows as
    "Ingen prognos"/"Säsongen slut"/"Ej bedömd" plus a link to the official
    page; never reintroduce guessed danger levels.
  - **Forecast parsing (2026-09-25):** each lavinprognoser.se page embeds its
    data as `window.__model = {...}`; `worker/src/model.ts` reads the danger
    level, headline, main message and every avalanche problem (aspects,
    elevation bands kalfjäll/trädgräns/under trädgräns, optional metres,
    sensitivity, size, "här finns"). Validated against 30 real in-season
    pages from 2025/26 in `worker/src/fixtures/lavinprognoser/`, fetched by
    Fabian with `worker/scripts/fetch-fixtures.ps1` (the site serves past
    forecasts via `?forecast_date=YYYY-MM-DD`; cloud sessions can't reach
    it). Safety rules in `parse.ts`: a level is shown only if the forecast
    is in force now, valid ≤ 48 h, and not published after today (the
    archive had a two-month "Måttlig" record for Södra Jämtland);
    `risk: 0` = "Ej bedömd"; `forecast: null` = no forecast. The old text
    regex parser is only a fallback for pages without the model. All six
    slugs are verified (`abisko_riksgransfjallen` for Riksgränsfjällen).
    Still worth a glance at `https://fjallkoll-worker.fabian-n-sund.workers.dev/forecasts`
    on the first forecast day of the season (mid-December) to confirm the
    live page matches the archive.
  - **Problem names follow lavinprognoser.se**, not EAWS English:
    Nysnöflak, Drevsnöflak, Bestående flak, Våta laviner, Glidlaviner,
    Hängdrivor. Internal ids stay `nysno`, `vindpack`, `gammal_svag_lagring`,
    `vatsno`, `glidlavin`, `hangdrivor`; `SITE_PROBLEM_TYPES` in
    `app/src/data/avalancheProblems.ts` maps the site's slugs to them.
    Region pages show the problems right under the official forecast
    (`ForecastProblems.tsx`, with `AspectRosette` + `ElevationIcon`).
  - **Danger-level history (2026-09-25):** D1 table `forecast_history`
    (migration `0003`, one row per region + Swedish date the forecast is
    valid until). Written by a cron trigger (`[triggers]` in
    `wrangler.toml`, 06/07/16/17:20 UTC = just after the 08:00 and 18:00
    publications) and on every `/forecasts` cache miss (`ctx.waitUntil`).
    `GET /forecasts/history?region=<id>&days=7` → `{ days: [{date, danger,
    problems}] }`, gaps as null, window ends tomorrow once tomorrow's
    forecast is out. Region pages show it as "Senaste dagarna"
    (`DangerHistory.tsx`), hidden until at least one day has a level. Needs
    `npx wrangler d1 migrations apply fjallkoll --remote` + `wrangler
    deploy` before it records anything; history only exists from then on.
- **Automatic deploy (GitHub Actions, 2026-10-09):** `.github/workflows/deploy.yml`
  runs on every push to `claude/bold-lamport-juktha` or `svenska-laviner`
  that touches `Svenska laviner/app|worker/**` (and on manual dispatch):
  worker typecheck + tests, app tests + build, then
  `wrangler d1 migrations apply fjallkoll --remote`, `wrangler deploy`,
  `wrangler pages deploy dist --project-name=fjallkoll --branch=production`.
  Fabian asked (2026-10-09) that Claude handle all code + deploys so he never
  opens VS Code: pushing a finished, tested change **is** the deploy — check
  the run at github.com/Fabsu951/Projekt1-Test/actions (via `gh api
  repos/Fabsu951/Projekt1-Test/actions/runs`) and fix any red run. Needs
  repo secret `CLOUDFLARE_API_TOKEN` (custom token: Workers Scripts, D1,
  Pages, R2 Edit + Account Settings, User Details Read; steps in
  `Svenska laviner/AUTODEPLOY.md`); account id is in the workflow (not
  secret). A new cloud session on another branch must add its branch to the
  workflow's `branches` list (or push to `svenska-laviner` with Fabian's OK).
  **Android APK in CI (2026-10-10):** `.github/workflows/android.yml` builds
  `assembleDebug` on every app push and replaces the prerelease
  `android-senaste` (asset `snolage.apk`; Fabian installs it from the phone,
  steps in APPAR.md "Ny version utan dator"). Debug builds are signed with
  `android/app/snolage-debug.keystore` (committed, password `android`, test
  builds only — never for Play) so CI and Android Studio builds replace each
  other; `versionCode` = git commit count. Optional secret
  `GOOGLE_SERVICES_JSON` (else no push).
  **iPhone in CI (2026-10-10):** `.github/workflows/ios.yml` (macos-15, only
  on `ios/**`, package.json/lock, capacitor.config.ts changes or manual run —
  macOS minutes count 10×): `cap sync ios` + unsigned simulator
  `xcodebuild -scheme App` as a compile check; when secrets `ASC_KEY_ID`,
  `ASC_ISSUER_ID`, `ASC_KEY_P8` (App Store Connect API key, Admin) and
  `APPLE_TEAM_ID` exist it also archives with automatic cloud signing and
  uploads to TestFlight (build number = commit count). Optional
  `GOOGLE_SERVICE_INFO_PLIST` → the "Copy Firebase settings" build phase
  copies `App/App/GoogleService-Info.plist` (gitignored) into the bundle if
  present. A non-blocking step then boots an iPhone simulator, launches
  the app for 45 s and prints its console (first run 2026-10-10: starts fine,
  BackgroundImport plugin answers, Firebase skips without the plist). `App.entitlements` (HealthKit + background delivery, aps)
  is wired via `CODE_SIGN_ENTITLEMENTS`; `UIRequiredDeviceCapabilities` is
  arm64. Fabian's steps (Apple Developer Program, App ID, App Store Connect
  app, API key, secrets, TestFlight) in APPAR.md § 3; not done yet.
- **One-command deploy:** `Svenska laviner/deploy.ps1` (pull, worker npm
  install + D1 migrations + deploy, app build + Pages deploy; stops at the
  first failing step). Fabian runs it with
  `powershell -ExecutionPolicy Bypass -File "C:\Users\fabia\Documents\fjallvarning-repo\Svenska laviner\deploy.ps1"`.
  If `wrangler` OAuth login times out in the VS Code terminal, run
  `npx wrangler login` from a plain PowerShell window instead (worked 2026-09-26).
- Full rebuild+redeploy sequence when app code changes:
    ```powershell
    cd C:\Users\fabia\Documents\fjallvarning-repo
    git pull origin svenska-laviner
    cd "Svenska laviner\app"
    $env:VITE_MAP_PROXY_URL="https://fjallkoll-worker.fabian-n-sund.workers.dev"
    npm run build
    npx wrangler pages deploy dist --project-name=fjallkoll --branch=production --commit-dirty=true
    ```
  - `npm install` can fail on Windows the first time (`sharp`/`@capacitor/assets`
    postinstall downloading `libvips` from a GitHub release times out) — this
    is transient, just retry `npm install`.

## Front-end design

Fabian (2026-10-13): all UI/design work follows the **frontend-design**
skill (`.claude/skills/frontend-design/SKILL.md`, copied from Anthropic's
official plugin; source in `SOURCE.md` there). Load it before changing how
anything looks. The brief's own words win: keep the danger-scale colours,
Swedish en dash, sentence case etc. from "Design + themes" below.

## Feature priority (user's explicit order: E → C+D → B → A)

- **E** — source citations everywhere: **done**. `SourceList` component,
  `Source` type on regions/danger-scale/problems/safety-guide sections.
- **C** — expanded per-region content: **done**. `src/data/regions.ts` has
  real descriptions + sources per region.
- **D** — deeper avalanche education content: **done**. `SafetyGuide.tsx`
  expanded with weather factors, snowpack basics, steepness bands, terrain
  traps, field rules, "reading the forecast" section.
- **B** — better map (real topo basemap): **done**. Lantmäteriet
  `topowebb` layer (id confirmed via GetCapabilities — NOT `topowebb-ccby`,
  that's only part of the URL path) via the Worker proxy, `TopoLayer.tsx`,
  falls back to OSM when `VITE_MAP_PROXY_URL` is unset.
  **Confirmed end date 2026-12-31** (Lantmäteriet's own notice,
  "Avveckling av produkten Topografisk webbkarta Visning, översiktlig").
  The paid alternatives (Visning 83 000 kr/år, Visning cache) are out; the
  free (CC BY 4.0 — credit "©Lantmäteriet", the product name and the licence, done in `mapTiles.ts` + About) replacement is **Topografisk webbkarta Nedladdning, raster**
  (GeoPackage/PNG, EPSG:3857 zoom 0–17, updated quarterly). Built
  2026-09-26: the app now loads `${VITE_MAP_PROXY_URL}/tiles/topowebb/{z}/{x}/{y}.png`
  (`TopoLayer.tsx`, maxNativeZoom 15); the worker (`worker/src/tiles.ts`)
  serves from R2 (`IMAGES` bucket, keys `maptiles/topowebb/z/x/y`), else
  fetches from the old WMTS and writes the tile to R2 (read-through, so
  viewed tiles survive the shutdown), else 302s to OpenStreetMap.
  Bulk import: `worker/scripts/import-tiles.ts` (run with `npx tsx`,
  uses `node:sqlite`, maps GeoPackage levels onto z/x/y via
  `gpkgTiles.ts`, uploads 40-tile / ≤ 1 MB batches (was 200: hit Cloudflare 1102 "Worker exceeded resource limits" on the free plan after ~25k tiles, 2026-10-07; a 1102/413 answer now splits the batch in half) in `tileBatch.ts` format to
  `POST /admin/tiles/topowebb`, authorised by a fresh random
  `TILE_UPLOAD_TOKEN` secret it sets each run). Fabian's step-by-step
  (~270k tiles ≈ 7 GB) is in `Svenska laviner/KARTBYTE.md`. **Ordered
  2026-10-06** (Geotorget ärende LM2026/152399, type "Behörighet"): it is
  delivered via the STAC API `https://api.lantmateriet.se/stac-karta/v1`
  with Geotorget Basic auth, not a download link.
  Collection `topowebb` holds **one file per variant for all of Sweden**
  (`topowebb-3006/3857.gpkg`, `topowebb_nedtonad-3006/3857.gpkg`,
  ~130–160 GB each; seen 2026-10-06). `worker/scripts/fetch-topowebb.ps1`
  picks `topowebb-3857.gpkg`, probes HTTP Range, checks disk space and
  downloads with `curl.exe -C -` (`-Download`, `-OutDir`), auth header via
  a temp file deleted afterwards. `import-tiles.ts` therefore reads only
  `MOUNTAIN_BOXES` (`gpkgTiles.ts`, via the tile table's index) plus
  everything up to zoom 7 (`OVERVIEW_MAX_ZOOM`); `--all` for the whole file.
  Fabian's C: had 117 GB free, so **no download**: the server answers
  Range requests (206), and `import-tiles.ts <https URL>` reads the
  GeoPackage remotely — `scripts/remoteSqlite.ts` (read-only SQLite
  b-tree reader over HTTP Range: schema, index range scans, rowid lookups,
  overflow pages; leaf + overflow pages fetched in merged runs ≈ 1 request
  per 12 tiles) + `scripts/remoteGpkg.ts`; auth header from env `LM_AUTH`,
  which `fetch-topowebb.ps1 -DryRun | -Import` sets for the child process
  only. `--skip <n>` resumes (`fetch-topowebb.ps1 -Import -Skip <n>`).
  **Seasonal update (2026-10-07):** the script prints Lantmäteriet's
  edition (asset/item `updated`/`datetime`) and compares it with
  `Downloads\topowebb\senast-importerad.txt` (written after `-Import`;
  `-MarkImported` registers the first import). KARTBYTE.md §4: check early
  Nov + early Feb, `-Import` overwrites tiles in place. Routine
  `trig_01CQtBTPht3u5mTKtQViVra4` ("Snöläge: uppdatera kartan", 3 Nov +
  3 Feb 08:49 Stockholm, fresh session, push + email) reminds Fabian. **Live dry run OK 2026-10-06:** file `https://dl1.lantmateriet.se/karta/topowebb/data/topowebb-3857.gpkg`, table `topowebb`, zoom 0–15 used (16–17 skipped), 285 892 tiles (z15 211 242), ~2.8 GB, sample 12/12 valid PNGs, index scan ≈ 2 700 requests / 3.4 min. Tested against real SQLite files served
  locally (`scripts/remoteSqlite.test.ts`: identical tiles and bytes, plus a GDAL-style file; also checked against a real GDAL 3.10 GPKG). First live `-DryRun` (2026-10-06) failed with "Filen innehåller inga tiles": tile tables are now found case-insensitively (GDAL may write `TOPOWEBB` in the schema), via gpkg_contents → gpkg_tile_matrix_set → tile columns, and the CREATE TABLE parser skips comments/quoted text; if none is found the schema is printed. **Import done by Fabian 2026-10-11** (`fetch-topowebb.ps1 -Import`; he confirmed on snolage.se/karta) — the map no longer depends on the WMTS that closes 2026-12-31; whether `-MarkImported` was run is unconfirmed (ATT-GORA.docx asks him to). The old `/topowebb` WMTS proxy route is kept for old app
  builds. Worker only fetches/stores on demand for z ≤ 15 inside a box
  around Sweden (`fetchable()`), so it can't be used to crawl.
  **Map tiles straight from R2 (2026-10-18, `Svenska laviner/KARTOR.md`):**
  tiles now live in their own public bucket **`snolage-kartor`** (eu, binding
  `TILES`; keys `topowebb/z/x/y.png`, `slope/z/x/y.png`, `slope/meta.json`,
  `cacheControl` 7 days) served at **`https://kartor.snolage.se`** (R2 custom
  domain) — so tiles don't use the 100k/day worker requests. **Never store
  anything private in it; `fjallkoll-images` (backups, full tracks) must never
  be public.** Worker `tiles.ts`: reads TILES, else the old `maptiles/…` keys in
  IMAGES (copied over on read), writes uploads/WMTS read-through to TILES;
  `POST /admin/tiles/migrate {cursor, limit}` (upload token) copies a page.
  `deploy.yml` creates the bucket + CORS (`worker/kartor-cors.json`, GET/HEAD
  `*`) before `wrangler deploy`; `.github/workflows/kartor.yml` (dispatch) moves
  the tiles (`scripts/migrate-tiles.ts`, fresh TILE_UPLOAD_TOKEN), tries
  `wrangler r2 bucket domain add` (needs the zone id; the token may lack zone
  access → Fabian adds the custom domain in the dashboard, KARTOR.md) and curls
  the domain. App: `VITE_TILE_DIRECT_URL` (.env.production); `mapTiles.ts`
  `directTilesReady()` probes `/topowebb/0/0/0.png` once per visit (retry after
  5 min), `hostedTile()` = z ≤ 7 or inside `HOSTED_BOXES` (= MOUNTAIN_BOXES,
  checked by a worker test), `networkTileUrl()`; `OfflineTileLayer` loads the
  direct URL and falls back to the worker URL once on error; offline downloads
  (`fetchTile` in `offlineMap.ts`) fetch direct but **cache under the worker
  URL** (the tile's identity, so old saves still match); `DetailedSlopeLayer`
  uses `DIRECT_SLOPE_URL` when the probe succeeds. Terrain (NV) tiles and
  `/tiles/slope/meta` still go through the worker.
  **Done 2026-10-19:** domain connected by the workflow itself, all ~286k tiles
  moved (third run: worker lists both buckets, `scripts/migrate-tiles.ts`
  copies the missing keys 10 per request, 8 in parallel, `copyBody` streams via
  `FixedLengthStream` – buffering 25 tiles per request hit Cloudflare 503s).
  The domain answered `cf-cache-status: DYNAMIC` (not edge-cached; optional
  Cache Rule in KARTOR.md). `kartor.yml` has its own concurrency group and runs
  when the file changes (dispatch 404s on non-default branches).
  **Offline maps (feature 5, 2026-09-27):** "Karta offline" section on
  region pages (`OfflineMapCard.tsx`, `services/offlineMap.ts`): saves a
  ~60×60 km square around the region at z8–13 ("Översikt", ~30–40 MB) or
  z8–14 ("Detaljerad", ~110–150 MB) into Cache Storage, one cache per
  region (`fjallkoll-tiles-<id>`), metadata in Preferences
  (`fjallkoll:offline-maps`). `TopoLayer` uses `OfflineTileLayer`
  (`offlineTileLayer.ts`), which shows a saved tile before hitting the
  network. Tile URLs live in `services/mapTiles.ts` and must match exactly
  between download and display. Hidden where Cache Storage is missing or
  without a worker URL. **iOS app checked 2026-10-10:** the `capacitor://`
  web view does have `caches` (simulator smoke test in ios.yml logs
  "[Snöläge] start ios, offline-kartor: ja"); saving tiles there not yet
  tried on a real iPhone.
  **Official terrain maps (2026-10-07):** Petter (Naturvårdsverket) OK'd
  showing their WMS layers `slope_inclination` / `slope_aspect` with them as
  the source + their legends; he also warned of possible future rate limits
  at peak times. So the app never calls their GeoServer: worker
  `src/terrain.ts` serves `/terrain/{lutning|riktning}/{z}/{x}/{y}.png`
  (WMS 1.1.1 GetMap, EPSG:3857 bbox per tile, only `fetchable()` tiles,
  non-images → 502) and `/terrain/<layer>/legend.png` (GetLegendGraphic),
  cached 30 days. App: "Naturvårdsverkets terrängkartor" fieldset in
  Kartlager (Lutning / Sluttningsriktning, one at a time,
  `OfficialTerrainLayer` opacity 0.85 + CSS `mix-blend-mode: multiply` (their slope tiles draw < 25° as light grey; multiply keeps the topo map readable), `OfficialTerrainLegend` shows their
  legend image), notice "visar terrängen, inte lavinfaran"; our own
  ~30 m slope layer stays as "Terränglutning, egen beräkning". Fabian checked
  their live server 2026-10-07: GetMap tile over Kebnekaise and the
  slope legend (25–30° green … > 50° dark brown) both work. Avalanche size
  codes confirmed by Jan Granlund (NV) 2026-10-08: `size_meter_value` 5/40/85/130/165
  = size 1–5 (`SIZE_TEXTS`; 4–5 worded from EAWS since the archive never had them);
  other values still show no size.
  Slope: "Markhöjdmodell Visning" is paid; "Markhöjdmodell Nedladdning,
  grid 1+" is free (CC BY 4.0, STAC API, access must be applied for).
  **Detailed slope map built 2026-10-10, waiting for Fabian's access
  (`Svenska laviner/LUTNING.md`):** `worker/scripts/fetch-hojd.ps1` (STAC
  base default `https://api.lantmateriet.se/stac-hojd/v1` — a guess, `-Base`
  overrides; picks the grid 1+ collection or `-Collection`; items for the
  three `MOUNTAIN_BOXES` → `Downloads\hojd\stac-items-hojd.json`; `-DryRun`
  / `-Import` / `-Skip` / `-Box`; login only in env `LM_AUTH` for the child)
  → `import-slope.ts` (z12 blocks; `dem.ts` `HeightModel` fetches each
  GeoTIFF whole with the login, `geotiff` + `proj4` EPSG:3006, ≤ 24 files in
  memory, bilinear; `slopeRender.ts` z15 tiles: projection on a 17×17 grid,
  slope from heights ±max(2 m, pixel) apart, bands 30/35/40/45 = app
  `SLOPE_BANDS` colours, < 30° transparent, palette PNG via node:zlib;
  z14–12 = steepest of each 2×2; tiles with nothing ≥ 30° are skipped) →
  `uploadClient.ts` (shared with import-tiles.ts) `POST /admin/tiles/slope`
  → R2 `maptiles/slope/z/x/y`, then `POST /admin/tiles/slope/meta`
  (`maptiles/slope/_meta.json`). Worker: `GET /tiles/slope/{z}/{x}/{y}.png`
  (z 12–15; missing → 1×1 transparent PNG), `GET /tiles/slope/meta` (404
  until imported). App: "Lutning, detaljerad" in Kartlager → Terräng only
  when the meta exists (`detailedSlopeAvailable()`), `DetailedSlopeLayer`
  opacity 0.7, minZoom 12, maxNativeZoom 15, legend + notice ("visar
  terrängen, inte lavinfaran"), About credits Lantmäteriet. Dry run on a
  synthetic 2.5 km cone: 2 z12 blocks in 2.5 s, bands correct.
  **Min position (2026-09-26):** "Visa min position" on `/karta` turns on
  `MyPosition.tsx` (Capacitor `Geolocation.watchPosition`, blue dot +
  accuracy circle ≤ 2 km, jumps to zoom ≥ 13 on the first fix only, stops
  watching when turned off). The Android manifest had **no location
  permissions** until then (so geolocation never worked in the Android
  app); ACCESS_COARSE/FINE_LOCATION are now declared, and the iOS
  `NSLocationWhenInUseUsageDescription` covers map + observations.
- **A** — design/layout (ski-focused visual identity): **done**.
  User asked for **"Äventyrlig/utomhus"** (Gaia GPS / onX spirit, not
  photorealistic) with simple SVG graphics, no photos. Implemented:
  - "Granite & ice" palette tokens in `index.css` (`--bg`, `--bg-elevated`,
    `--bg-raised`, `--accent` ice-blue, `--signal` orange, `--snow`).
  - (Fonts and palette replaced 2026-10-10 — see "Design + themes" below.)
  - Header with SVG brand mark + ridgeline silhouette (`Layout.tsx`).
  - Original SVG pictograms per avalanche problem (`ProblemIcon.tsx`) —
    deliberately NOT copies of EAWS's own artwork.
  - **Danger scale colors are intentionally unchanged** — user explicitly
    said "behåll skalan" when level 5 (black) was hard to see; the fix is a
    snow-white ring (`box-shadow: 0 0 0 2px var(--snow)`) on badges,
    scale swatches, and map markers instead.
  - Compass icons (`CompassIcons.tsx`): `WindArrow` (points where wind
    blows TO) in the weather table, and `AspectRosette` (8-sector aspect
    pictogram, affected aspects in orange) next to the wind-loading
    summary — reusable for avalanche-problem aspects if those get scraped.

## Community observations (user accounts) — added 2026-09-23

Users register (email + password + display name), then post observations
(type, map point, time, description, optional photo) that everyone sees.
User chose: own accounts, publish immediately + report button, photos from
the start, exact map point.

- **Backend** (worker): `auth.ts`, `observations.ts`, `http.ts`, schema in
  `worker/migrations/`. D1 binding `DB` (database `fjallkoll`), R2
  binding `IMAGES` (bucket `fjallkoll-images`). Bearer-token sessions
  (SHA-256 of token stored), PBKDF2 passwords. Hidden after 3 reports;
  admins (`users.is_admin = 1`, set by hand via `wrangler d1 execute`)
  see `/admin` in the app to restore/delete.
- **App**: `auth/` (AuthProvider + useAuth, token in Capacitor
  Preferences), pages `/logga-in`, `/registrera`, `/profil`,
  `/observationer`, `/observationer/ny` (lazy, Leaflet picker), `/admin`;
  pins on `/karta`; latest 5 per region on region pages. Photos are
  downscaled + re-encoded client-side (`utils/image.ts`) which strips EXIF
  GPS data.
- **Test locally**: in `worker/`, `npx wrangler d1 migrations apply
  fjallkoll --local` then `npx wrangler dev --local`; build the app with
  `VITE_MAP_PROXY_URL=http://127.0.0.1:8787`.
- **Email** (`worker/src/email.ts`, migration `0002`): verification on
  signup + "glömt lösenord" reset links, sent via **Resend**. Needs a domain
  Fabian owns verified in Resend, `EMAIL_FROM` in `wrangler.toml` and the
  `RESEND_API_KEY` secret. Until both are set, emails are only logged
  (`wrangler tail`) and verification is **not enforced** (`canPost` is true
  for everyone) — otherwise nobody could ever post. Once configured, posting
  and reporting require a verified email (`requirePoster`). Tokens are
  single-use, stored hashed, max 3 emails/hour/user/purpose; a password
  reset logs out all sessions and also verifies the email.
- **Privacy policy** on `/om-appen#integritet`. `PRIVACY_CONTACT_EMAIL` in
  `app/src/data/contact.ts` is `fabian.n.sund@gmail.com` (Fabian's choice,
  2026-09-26; may move to a Fjällkoll address/domain later).
- **Admin:** Fabian's account (`fabian.n.sund@gmail.com`) has `is_admin = 1`
  (set 2026-09-26). The admin page is reached via "Anmälda inlägg" on
  `/profil`, not from the main nav.
- **Favorites ("Mina områden", 2026-09-26):** star button
  (`FavoriteButton.tsx`) on region cards and the region page title;
  `favorites/` (FavoritesProvider + useFavorites) keeps starred region ids
  on the device in Capacitor Preferences (`fjallkoll:favorites`), no
  account needed. When signed in they also sync to the account (migration
  `0007` `users.favorites`, `GET/POST /auth/favorites` in
  `worker/src/favorites.ts`): on login the account's and the device's
  lists are merged (account order first) and saved back; every star
  change is POSTed while signed in. Added 2026-09-26 after Fabian's
  computer favourites didn't show up on his phone. The region list shows "Mina områden" first, then
  "Övriga områden". `RegionCard` is now a div with a link + the star
  (a button can't sit inside a link). Notifications for favorites: see
  "Web push" below (browsers only; native apps would need Firebase + APNs).
- **Richer observations (2026-09-26, Regobs-style):** migration `0004`
  adds `danger_signs` (JSON array; ids in `DANGER_SIGNS` in
  `worker/src/observations.ts` and `app/src/data/dangerSigns.ts`, which must
  match: farska_laviner, skjutsprickor, wumpf, snodrev, mycket_nysno,
  snabb_uppvarmning) and optional `snow_depth_cm` (0–1000). The form has
  "Varningstecken" checkboxes + "Snödjup"; cards show them as chips;
  `/observationer` filters by område, typ and tid (`?type=&days=`, default
  30 days). Older rows default to no signs / no depth.
- **Rate limits (2026-09-26):** migration `0005` `rate_limit_events`
  (SHA-256 of keys like `login-email:<email>` / `login-ip:<ip>` /
  `register-ip:<ip>`, pruned after 24 h; see `worker/src/rateLimit.ts`).
  Login: 5 failures per email + 100 per IP per 15 min (success clears the
  email counter). Signup: 100 accounts per IP per hour (raised from 20/5 on
  2026-10-17 – shared wifi and mobile CGNAT; Turnstile stops bots). The
  notification bell polls every 5 min (was 1 min + every navigation) to
  save Workers free-plan requests (100k/day). Mentioned in the
  privacy policy.
- **Turnstile (built, OFF until configured):** `worker/src/turnstile.ts`
  verifies `turnstileToken` on signup only when the worker secret
  `TURNSTILE_SECRET_KEY` is set; the app shows the widget
  (`TurnstileWidget.tsx`) only when `VITE_TURNSTILE_SITE_KEY` in
  `app/.env.production` is non-empty. To turn on: create a Turnstile widget
  in the Cloudflare dashboard (hostnames `fjallkoll.pages.dev` + `localhost`
  for the Capacitor apps), put the site key in `.env.production`,
  `npx wrangler secret put TURNSTILE_SECRET_KEY`, deploy. Set both or
  neither — secret without site key blocks all signups.
  **Widget created 2026-10-07** ("Snöläge registrering", Managed, no
  pre-clearance, hostnames `fjallkoll.pages.dev` + `localhost`; add
  `snolage.se` when the domain is live). Site key
  `0x4AAAAAAFP30ifEeD290W8o` is in `app/.env.production` (public). Order:
  deploy the site first, then `npx wrangler secret put TURNSTILE_SECRET_KEY`
  (Fabian has the secret; never in chat). **Secret set 2026-10-07 —
  Turnstile is ON** (after the deploy).
- **Web push (built, OFF until keys exist):** "Notis när farograden ändras i
  mina områden" checkbox under "Mina områden" (`PushToggle.tsx`,
  `services/push.ts`, `public/sw.js`), shown only in browsers with push
  support (not in the Capacitor apps) and once `/push/key` returns a key.
  Worker: `webpush.ts` (VAPID + aes128gcm with WebCrypto, no library),
  `push.ts` (`/push/key`, `/push/subscribe`, `/push/unsubscribe`, delivery
  only to Google/Mozilla/Apple/Microsoft push hosts), migration `0006`
  `push_subscriptions`. `recordAll` in `index.ts` runs `findChanges`
  (level differs from the latest stored forecast within 3 days; the very
  first record never notifies) → `recordHistory` → `notifyChanges`.
  Deployed 2026-09-26 (`d6e510f`); `deploy.ps1` runs the key setup step,
  confirm with `GET /push/key`. Turn on manually: from `worker/`, `node scripts/setup-push.mjs` (creates and
  stores `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` as secrets, refuses to
  overwrite; `VAPID_SUBJECT` is in `wrangler.toml`). Never rotate the keys
  casually — every subscription is bound to the public key. iPhones only
  get web push after "Lägg till på hemskärmen".
- **Native app push (built 2026-10-07, OFF until Firebase is set up):**
  FCM HTTP v1 for both apps (Firebase forwards to APNs for iOS), so the
  worker only talks to Google. Worker `fcm.ts` (service-account JWT RS256
  via WebCrypto → OAuth token cached ~1 h; `UNREGISTERED`/404 → "gone"),
  `nativePush.ts` (`GET /native/status`, `POST /native/register` {token,
  platform, regions, account — account only with a valid bearer},
  `/native/unregister`; `notifyNativeChanges` next to web `notifyChanges`;
  `sendNativeToUser` from `notifications.ts`), migration `0015`
  `native_devices` (token PK, platform, regions JSON, user_id SET NULL;
  account deletion unlinks). Secret `FCM_SERVICE_ACCOUNT` (whole JSON,
  piped into `wrangler secret put`). App: `@capacitor-firebase/messaging`
  8.5 (+ `firebase` peer), `services/nativePush.ts` (state in Preferences
  `fjallkoll:native-push` {regions, account}; re-registers on
  `tokenReceived`; taps open `data.url` only if it's an in-app path),
  `PushToggle` + `AccountPushToggle` pick native vs web, `NativePushBridge`
  in Layout, logout/delete → `stopNativeAccountPush`. Native: AppDelegate
  APNs forwarding, `UIBackgroundModes remote-notification`, Android
  `POST_NOTIFICATIONS`, white `ic_stat_snolage` + `notification_accent`;
  `capacitor.config.ts` FirebaseMessaging presentationOptions + SPM
  `symlink` option (the generated `CapApp-SPM/symlinks/` is gitignored —
  absolute path; `npx cap sync` recreates it). Fabian's steps (Firebase
  project, google-services.json, GoogleService-Info.plist, APNs .p8, Xcode
  Push capability, service-account secret) in `Svenska laviner/NOTISER.md`.
  Privacy policy mentions Google/Firebase + Apple. Not compiled here.
  **Builds without Firebase settings (2026-10-12):** the CI APK has none until the
  `GOOGLE_SERVICES_JSON` secret exists; Firebase's "Default FirebaseApp is not
  initialized" is turned into `NativePushMissingError` (friendly text) and
  remembered per app build (`fjallkoll:native-push-missing`), so the toggles hide.
  **Set up 2026-10-07:** Firebase project `snolage-1ce89` (Spark, no
  Analytics), Android app `se.snolage.app` with `google-services.json` on
  Fabian's PC (not in git), `FCM_SERVICE_ACCOUNT` secret uploaded. iOS
  (plist, APNs key, Xcode capability) still to do — needs a Mac.
- **Turdagbok (tour diary, 2026-09-27, idea from Fabian's parents):**
  users upload GPX/FIT files from their watch (`app/src/utils/trackImport.ts`,
  FIT via our own `utils/fitDecoder.ts` since 2026-10-17 – Garmin's FIT SDK licence
  forbids distributing it and safety-critical use, so `@garmin/fitsdk` is only a
  devDependency for `fitDecoder.test.ts`, which checks our reader against theirs; simplified to ≥ 10 m spacing,
  max 5000 points `[lat, lon, ele|null, timeMs|null]`). Worker:
  `track.ts` (clean, stats with 5 m ascent hysteresis, `trimEnds`),
  `tours.ts`, migration `0008` `tours`; full track in R2 at
  `tracks/<uuid>.json`. Fabian's choices: **shared by default**, and each
  tour picks how much of the start/end to hide from others (0/200/500/1000 m,
  default 500) — trimmed server-side, the owner always gets the full track.
  Routes `GET/POST /tours` (`?region=&months=12,1,2&mine=1`),
  `GET/POST/DELETE /tours/:id`; 20 uploads/h/user; deleted with the account.
  App: `/turer` (region + season chips from `data/tourSeasons.ts`),
  `/turer/ny`, `/turer/:id` (owner settings, admin delete), "Mina turer" on
  `/profil`, "Turer i området" on region pages, "Turer" toggle on `/karta`.
  **Heatmap:** migration `0009` adds `tours.preview` (public line, hidden
  ends removed, ≤ 150 points, `previewLine()` in `track.ts`, recomputed
  when hide-ends changes); `GET /tours/lines?months=&region=` returns up to
  500 newest shared lines (`{id, title, startedAt, points}`); `/karta`
  "Värmekarta över turer" (`TourHeatmap.tsx`, one canvas) colours each
  stretch by how many *different* tours pass there: `utils/heatGrid.ts`
  counts tour ids per 12-screen-pixel Web Mercator square (recomputed on
  zoom), bands 1 / 2–3 / 4–9 / 10+ in one orange hue light→dark plus
  thicker lines, legend `HeatLegend` bottom left; tapping a line lists the
  tours there (up to 5, links). Season chips
  (`SeasonFilter.tsx`); `/karta?turer=varmekarta` opens it directly. The layer toggles on `/karta` sit in a foldable "Kartlager (n på)" panel (open/closed remembered in localStorage `fjallkoll:map-layers-open`; first visit: open on wide screens, closed ≤ 640 px); the slope disclaimer stays outside it on purpose. "Helskärm" makes the map cover the whole window (fixed, above the site header; Esc or "Stäng helskärm" leaves) with the buttons, layer panel and notices floating on top; icon-only buttons under 600 px; `FitToContainer` calls `invalidateSize()` on the switch.
  Later (native only, needs plugins/Apple account): Health Connect /
  Apple Health import.
- **Ruttplanering (route planning, step 1, 2026-10-05):** "Planera rutt" on
  `/karta` (works in full screen too). Click to add points, drag to move,
  Ångra/Rensa; straight legs (no path routing — deliberately, no automatic
  route finding). Draft kept in localStorage `fjallkoll:route-draft`, map
  frames it when planning opens. `utils/elevation.ts` `ElevationSampler`
  reads the same Mapterhorn Terrarium tiles as the slope layer (z13,
  decoded via canvas, cached, bilinear across tile borders) for height,
  slope and aspect (±30 m differences); `utils/routePlan.ts` samples every
  25 m: distance, up/down (5 m hysteresis), highest point, Munter time
  (uphill (km + hm/100)/4, downhill (km + hm/200)/10), metres per slope
  band (same colours as the slope layer), `routeToGpx`. UI:
  `RoutePlanner.tsx` (map: points, slope-coloured line, hover dot, credits
  Mapterhorn), `RoutePanel.tsx` (stats, foldable, "Spara som GPX",
  disclaimer that ~30 m data misses short steep bits and slopes above the
  route), `ElevationProfile.tsx` (SVG, hover syncs to map).
  **Saved routes (step 2, 2026-10-05):** migration `0010` `routes`
  (waypoints JSON in D1, ≤ 300 points, stats from the app; ≤ 300 routes
  and 120 saves/h per user), `worker/src/routes.ts`: `GET/POST /routes`
  (own list only — no public listing), `GET/POST/DELETE /routes/:id`;
  **private by default**, optional "Dela via länk" (`shared`), anyone
  with the link can open it. Deleted with the account; in the privacy
  policy. App: `hooks/useRouteDraft.ts` (draft `{points, id, title,
  shared, savedPoints, savedTitle}` in localStorage, still reads the old
  plain-array draft), `RouteSaveBox.tsx` in the panel (name, "Spara i
  mitt konto"/"Spara ändringar", "Ny rutt", share + copy link; log-in
  link when signed out), `/karta?rutt=<id>` opens a route (own → edit,
  someone else's shared → unsaved copy), "Mina rutter" on `/profil`.
  **Forecast check (step 3, 2026-10-05):** `utils/routeForecast.ts`:
  the route's area = nearest region to its middle sample (≤ 80 km); only
  with a *published* forecast, every sample on ground ≥ 30° (`STEEP_DEG`)
  is matched against each problem's aspects (8 sectors; none listed = all)
  and heights (forecaster's metre limits if given, else bands around a
  rough per-area treeline `TREELINE_M`, 600–900 m, ±100 m zone, edges
  widened 50 m so borderline cases are flagged, not missed).
  `RouteForecastCheck.tsx` in the panel lists per problem the metres,
  sectors and bands hit; matches are white dashes on the map
  (`RoutePlanner` `flagged`) and shaded in the profile. Wording never says
  "safe"; without a published forecast it compares nothing and says so.
- **Profile lists fold (2026-10-05):** "Mina observationer/turer/rutter"
  on `/profil` are `CollapsibleSection`s (folded by default, count beside
  the heading, open/closed remembered in localStorage
  `fjallkoll:section-open:<id>`); open lists show 5 items + "Visa alla"
  (`ShowMore`).
- **Social / "som Strava" (2026-10-05):** Fabian's choices: follow
  one-way without approval, feed of tours + observations + shared routes,
  comments + likes, tours get "Bara de som följer mig". Migration `0011`:
  `follows`, `comments` / `likes` (`item_type` tour|observation|route),
  `tours.followers_only` (visibility = `shared` 0 → private; 1 + 0 →
  public; 1 + 1 → followers). `worker/src/social.ts`: `GET /feed?before=`
  (followees + self, 20 per page, merged by created_at), `GET /people?q=`
  (signed in, LIKE escaped), `GET /people/:id`, `POST/DELETE
  /people/:id/follow`, `GET /people/me/follows`, `GET/POST /comments`,
  `DELETE /comments/:id` (author, item owner, admin), `POST /likes`.
  Comments/likes require the same access as the item (`itemOwner`); tour
  visibility via `visibleTourSql`/`canSeeTour` in `tours.ts`; followers-only
  tours never in the heatmap. `socialCleanup.ts` removes an item's
  comments/likes on delete; account deletion removes follows/comments/likes.
  Tested against real SQLite with all migrations (`src/testing/sqliteD1.ts`,
  `social.test.ts`). App: `/flode` (FeedPage + people search), `/person/:id`,
  `FeedCard` (TrackSketch SVG instead of maps), `Reactions` (like +
  comment thread, also on TourPage), `FollowButton`, visibility select
  (`data/tourVisibility.ts`) on new/edit tour, "Följer"/"Följare" on
  `/profil`, author names link to `/person/:id`. Route "Dela" now also
  puts the route in followers' feeds. Comment notifications and comment
  reports came later (see Notifications and Reporting below).
- **Profile pictures + experience frames (2026-10-05, "lite som
  Overwatch"):** migration `0012` `users.avatar_key` (R2 `avatar/<uuid>`,
  served by `/images/` like observation photos). `worker/src/profile.ts`:
  `POST/DELETE /auth/avatar`, admin `DELETE /people/:id/avatar`;
  `experienceOf` = 20/tour + 1 per 100 hm (≤ 3000 hm per tour) + 30 per
  non-hidden observation — **deliberately never steepness/risk**. Person,
  search, follow lists include `avatarPath` + `xp`; `/feed` and
  `/comments` return a `people` map of badges. App: `data/levels.ts`
  (Nykomling 0, Spårare 100, Turåkare 300, Fjällvan 700, Fjällkunnig 1500,
  Fjällveteran 3000 — XP_RULES must match the worker), `Avatar.tsx`
  (original SVG frames: ring → notches → mountain crest → stars → double
  ring + snowflakes; initials fallback), `LevelCard.tsx` (progress bar),
  `prepareAvatar` (square crop 512 px JPEG, strips EXIF) on `/profil`.
- **Site review (2026-10-05):** automated sweep of every route at 390 and
  1280 px, signed in and out, with mocked worker/SMHI (console errors,
  overflow, unlabeled controls, missing alt, duplicate ids) was clean
  except unknown URLs → added `NotFoundPage` (`path="*"`). Also: per-page
  tab titles (`components/pageTitle.ts`: Layout default by path,
  `usePageTitle` overrides for region/tour/person), phone header collapses
  into a "Meny" button (≤ 640 px), the menu shows your framed `Avatar`
  instead of your name (`/auth/me` now adds `avatarPath` + `xp`; login
  refetches it), Swedish `FilePicker` instead of the browser's English
  file input, friendly SMHI error notices instead of raw HTTP errors,
  "Om området"/"Karta offline"/"Lavinskalan" fold on region pages, map
  tour pins include followers-only tours you may see.
- **Notifications (2026-10-05):** migration `0013`: `notifications`
  (kind follow|comment|reply|like, actor, item, read_at; pruned after 90
  days) + `user_push_subscriptions` (account-linked push, opt-in only).
  `worker/src/notifications.ts`: `notify()` (skips self, no repeat
  follow/like notice within 24 h, push sent via `ctx.waitUntil` — `defer`
  threaded through `handleCommunity`), `GET /notifications`,
  `GET /notifications/unread`, `POST /notifications/read`,
  `POST /notifications/push|push/off|push/status`. Comments notify the
  owner ("comment") and earlier commenters ("reply"). App:
  `NotificationBell` in the menu (polls every 60 s and on tab focus),
  `/notiser` (marks read on open, "Skicka notiserna till den här
  enheten" toggle). `services/push.ts` now keeps per-purpose flags
  (`fjallkoll:push-regions` / `fjallkoll:push-account`) because danger
  notices and account notices share the browser's one subscription; it is
  only cancelled when neither uses it. Native apps: bell only, no push.
  Name search folds case incl. Å/Ä/Ö (`foldSql` in `social.ts`).
- **Mobile-app readiness (2026-10-05):** step-by-step for Fabian in
  `Svenska laviner/APPAR.md` (Android Studio test, Play Console incl. data
  safety answers + 12-tester rule, App Store needs a Mac + Apple account,
  store texts). Done: new brand icon/splash in `app/assets/` →
  `npm run app:icons` (`--android --ios` only; it garbles the web manifest
  otherwise), old `resources/` removed, `public/favicon.svg`;
  `viewport-fit=cover` + `--safe-top/right/bottom/left` in `index.css`
  (max of `env()` and Capacitor's injected `--safe-area-inset-*`) on the
  header, pages and full-screen map; `capacitor.config.ts` SystemBars
  `insetsHandling: 'css'`, iOS `contentInset: 'never'`, dark background;
  `services/native.ts` (`initNativeApp` Android back button via
  `@capacitor/app`, `shareableUrl` → `VITE_PUBLIC_SITE_URL` in the apps,
  `saveTextFile` → Filesystem + Share sheet in the apps); Android CAMERA
  permission, iOS camera/photo usage strings + `ITSAppUsesNonExemptEncryption`;
  `VITE_MAP_PROXY_URL` now also in `.env.production`; npm scripts
  `app:sync`, `app:android`, `app:ios`; `/om-appen#radera-konto` for the
  stores. appId `se.snolage.app` (Android package
  `se.snolage.app`, `MainActivity` under `java/se/snolage/app/`, iOS bundle id
  the same). No Android SDK in cloud sessions, so APKs
  are built on Fabian's PC.
  **First native build OK 2026-10-07** (Android Studio, JBR 21, SDK API 36,
  Firebase messaging + capacitor-health compiled) on Fabian's Galaxy S22
  (Android 14); first-time setup hiccups are in APPAR.md §1.
  First run found a real bug: capacitor-health's types say
  `permissions` is a list, but Android and iOS return one object →
  "e.permissions.some is not a function"; `permissionGranted()` reads both.
  Second: the route permission never reads as granted on Android 14 (the
  plugin asks for `READ_EXERCISE_ROUTE`; other apps' routes come per
  session via HC's `ExerciseRouteRequestContract`, which capacitor-health
  doesn't implement — it only returns routes when `ExerciseRouteResult.Data`).
  So "connected" now needs only READ_WORKOUTS, and `scanWorkouts` reports
  `withoutRoute`. **Per-session route consent (2026-10-08, not compiled
  here):** own Capacitor plugin `HealthRoutesPlugin.java` (registered in
  `MainActivity` before `super.onCreate`) opens HC's
  `ExerciseRouteRequestContract` dialog via `startActivityForResult` +
  `@ActivityCallback` and returns `{granted, route: [{timestamp, lat, lng,
  alt}]}`; app module now depends on `connect-client:1.2.0-alpha01` (same as
  capacitor-health). Manifest also declares `READ_EXERCISE_ROUTES` (Android
  15 name). `scanWorkouts().withoutRoute` is now `RoutelessWorkout[]`;
  `/turer/halsa` lists them ("Pass där rutten saknas") with "Hämta rutten"
  (`requestWorkoutRoute`, Android + plugin present only) / "Hoppa över";
  elsewhere the old settings hint. `altitudeOf()` also reads
  capacitor-health's altitude, which arrives as Length text ("812.4 meters").
- **Offline (2026-10-05):** "Utan täckning" page `/offline`
  (`OfflinePage.tsx`: what works / needs a connection + what this device has
  saved + a before-the-tour checklist), `OfflineBanner` under the header
  (offline, or when a page fell back to saved data), linked from About and
  the map. Pieces: (1) `public/sw.js` precaches the built app (see Other
  notes); (2) `cached()` in `services/cache.ts` wraps every worker GET in
  the services (observations, tours, routes, feed, people, comments,
  notifications, `/auth/me`): saves fresh answers in Preferences (≤ 400 kB
  each), falls back to them only on network errors (status 0 / no status,
  never for 4xx/5xx) and fires `SHOWING_SAVED_EVENT`; account data uses
  `USER_SCOPE` keys and `clearUserCache()` runs on logout/401/new login;
  (3) offline map views (`OfflineViewBox` in Kartlager: "Spara det som
  syns", ≤ 4000 tiles, zoom lowered to fit, ≤ 15, key
  `fjallkoll:offline-views`) and offline routes (`services/offlineRoutes.ts`,
  `RouteOfflineBox` + `OfflineRouteList` in the route panel: 1.5 km
  corridor z8–15 via `corridorTiles`, plus the analysis snapshot so profile,
  slope and forecast check work without elevation tiles; key
  `fjallkoll:offline-routes`). Writes, drawing new routes (elevation tiles),
  slope layer and heatmap still need a connection.
- **Admin label + grouped menu (2026-10-05):** everyone sees an "Admin"
  pill (`AdminBadge.tsx`) next to admins' names: `Badge.isAdmin` from
  `experienceOf` (person, search, follows, feed/comments/notification
  `people` maps) and `authorIsAdmin` on observations/tours
  (`u.is_admin AS author_is_admin` in `SELECT_OBSERVATIONS`/`SELECT_TOURS`).
  Main menu is `NAV_GROUPS` in `Layout.tsx`: Läget (Områden, Karta,
  Observationer) · Gemenskap (Flöde, Turer) · Lär dig mer
  (Säkerhetsguide, Om Snöläge) · bell + avatar; thin dividers on desktop,
  small group headings in the phone menu.
- **Start page "Idag i fjällen" (2026-10-05, replaces the old region
  list `RegionList`):** `pages/TodayPage.tsx` at `/` (menu label "Idag").
  Starred areas as `components/today/AreaForecastCard.tsx` (big level box,
  label, trend vs yesterday from `/forecasts/history`, headline, problem
  chips with `problemWhere`, 7-day spark, links); empty state + nearest
  area when nothing is starred; `QuickActions` (Planera rutt →
  `/karta?planera=1` opens the planner, Ny observation, Utan täckning);
  `RecentObservations` (last 7 days, favourites only when any, 4 rows);
  `OverviewMap` (SVG, real area centres, rough dashed Norway border, level
  colours, links); other areas as compact rows with `ForecastBadge`;
  off-season box. Two columns ≥ 900 px (`page--wide`, 1100 px). Helpers in
  `utils/today.ts` (Swedish dates, `recentDays` drops tomorrow,
  `trendSinceYesterday`). Never shows a level that isn't published.
- **Map performance (2026-10-05, "kartan laggar"):** panning blocked the
  page ~1.5 s per move: `OfflineViewBox` ran `viewPlan` on every `moveend`,
  which built tile arrays for z15…10 of the visible area (millions at
  country zoom). Now `tileCount()` counts arithmetically. Also: pins live
  in memoised `components/MapMarkers.tsx` (one cached icon per danger
  level, so MapPage re-renders on pan/profile hover don't touch them);
  `cachedTile` only searches `fjallkoll-tiles-*` caches, remembered until
  `forgetTileCaches()` (called on every save/remove), and
  `OfflineTileLayer` loads straight from the network once it knows
  nothing is saved; `TopoLayer` `keepBuffer 4`, `updateWhenZooming false`.
  Measured with Playwright (200 pins, 12 drags): long tasks ~17 s → 0.
- **Health Connect import (Android, 2026-10-06, step 1 of "automatic
  tours from Apple Health/Health Connect"):** plugin `capacitor-health`
  (mley, MIT, v8.4.0; Android minSdk raised 24 → 26 for it).
  `services/healthImport.ts`: READ_WORKOUTS + READ_ROUTE only, sessions
  from the last 30 days (`LOOKBACK_DAYS`; HC's default history limit),
  route ≥ 10 points and ≥ 300 m, `simplify()`d to our TrackPoint format;
  imported/skipped HC ids remembered in Preferences
  `fjallkoll:health-imported`, connection flag `fjallkoll:health-connected`.
  `/turer/halsa` (`HealthImportPage`, lazy): install/connect/denied states,
  checklist (winter types preselected), imports as **private** tours
  (hide ends 500 m) — Fabian agreed: auto-detect, never auto-publish.
  `HealthImportNotice` ("N nya pass från klockan") on Turer (+ invite) and
  the start page, only in the Android app when signed in. Manifest:
  READ_EXERCISE(_ROUTE), `<queries>` for HC, rationale activity + alias →
  `privacy_policy_url` string. Privacy policy + APPAR.md (Play Console
  Health Connect declaration) updated. iOS: plugin is in Package.swift and
  NSHealth*UsageDescription strings exist, but HealthKit (entitlement, UI)
  is **not** wired up yet; background import (WorkManager / HKObserverQuery)
  also not built. Not compiled here (no Android SDK) — Fabian must build.
  **Step 2 (2026-10-06):** migration `0014` `tours.source_ref` (unique per
  user, e.g. `hc:<session id>`); `POST /tours` with an existing
  `sourceRef` returns `{tour, duplicate: true}` before the rate limit;
  `GET /tours/sources?prefix=hc` lists your refs, so `findNewWorkouts(token)`
  skips sessions imported from another phone. Optional **automatic
  import** (Preferences `fjallkoll:health-auto`, toggle on `/turer/halsa`):
  `checkForNewWorkouts` (one shared run per moment) imports
  `suggested` (winter) sessions as private tours when the app is open;
  others wait. `HealthImportNotice` reports "N nya turer … lagts till som
  privata" + "N pass väntar". dl.google.com is blocked in cloud sessions,
  so no Android SDK — true background import (WorkManager +
  READ_HEALTH_DATA_IN_BACKGROUND) is left until it can be compiled.
  **Step 3 (2026-10-07): iPhone (Apple Hälsa) + resume.** Same code path on
  iOS via capacitor-health's HealthKit side (`queryWorkouts` with
  `includeRoute`, `openAppleHealthSettings`); `HEALTH_STORE_NAME`
  ("Health Connect" / "Apple Hälsa") in the texts, source refs `ah:<uuid>`
  on iOS (`hc:` on Android); type names normalised (`typeKey`: HealthKit's
  `downhillSkiing`/`crossCountrySkiing`/`snowSports`… and HC's `SKIING`…).
  `HealthImportNotice` also re-checks on `App` "resume". iOS needs the
  HealthKit capability in Xcode (APPAR.md) — not compiled here. Background
  import while the app is closed (Android WorkManager, iOS HKObserverQuery)
  is still not built: needs native code compiled on real devices, to do
  together with Fabian at Android Studio/Xcode.
  **Step 4 (2026-10-10): Android background reminder** (compiled by the CI
  APK build, not yet tried on a phone). On Android 14 another app's route
  needs a per-session yes, so the background part only *notifies*: Kotlin in
  `android/app/src/main/java/se/snolage/app/` — `BackgroundImport.kt`
  (prefs `snolage-background`, WorkManager unique periodic work 1 h,
  winter types = JS `WINTER_TYPES`, skips ids in its own list and in
  Capacitor Preferences `fjallkoll:health-imported`, only sessions ending
  after it was turned on; notification channel `watch-tours`, tap →
  MainActivity extra `se.snolage.app.PATH` = `/turer/halsa`),
  `HealthCheckWorker.kt`, `BackgroundImportPlugin.kt` (`status`, `enable` =
  POST_NOTIFICATIONS then HC `READ_HEALTH_DATA_IN_BACKGROUND` via
  `PermissionController.createRequestPermissionResultContract()`, `disable`,
  `takeLaunchPath`, event `openPath`). App module now applies Kotlin
  (2.2.20, same as capacitor-health; JVM 21) + `work-runtime-ktx`. JS:
  `services/backgroundImport.ts`, `BackgroundCheckToggle` on `/turer/halsa`
  ("Påminn mig om nya skidpass"), taps routed in `NativePushBridge`.
  Privacy policy (updated 10 Oct) + APPAR.md Play declaration mention it.
  **iPhone version (same day, compiled only by CI):** `ios/App/App/`
  `HealthReminder.swift` (HKObserverQuery + `enableBackgroundDelivery`
  `.immediate` for workouts, started from `AppDelegate`
  `didFinishLaunching`; UserDefaults `snolage.background.*`, skips ids in
  `CapacitorStorage.fjallkoll:health-imported`; local notification with
  userInfo `path`), `BackgroundImportPlugin.swift` (same JS API, registered
  in `MainViewController.capacitorDidLoad`; it is the bridge's
  `notificationRouter.localNotificationHandler`, taps → retained `openPath`
  event; `takeLaunchPath` returns nothing on iOS). On iPhone HealthKit gives
  the route directly, so no per-session consent is needed.
- **Official forecast API (2026-10-06):** Petter Palmgren
  (Lavinprognostjänsten, Naturvårdsverket) answered Fabian's API question
  with the PDF "Lavinprognoser – en guide till öppna API:er" (2026): open
  GeoServer WFS, no account, `https://nvgis.naturvardsverket.se/geoserver/lavinprognoser/ows`
  (`service=WFS&version=1.0.0&request=GetFeature&typeName=lavinprognoser:<layer>&outputformat=application/json&viewparams=lang:sv;location:<id>;valid_date:YYYY-MM-DD HH:MM`).
  Layers: `location`, `location_center` (current `risk`), `forecast_view`,
  `published_forecasts` (location, valid_date, lang), 
  `published_forecasts_by_interval` (start_date/end_date),
  `forecast_by_id` (old), `published_forecast_area_interval`. Fields incl.
  risk (0 ej bedömd, 1–5, **6 vårförhållanden, 7 ingen lavinfara**),
  risk_rubrik, assessment_title/content, trend_*, valid_from/to,
  published_date, `problems` JSON (problem_type_id, title, content,
  altitude_meter_above_treeline/treeline/below_treeline,
  direction_meter_north…north_west, sensitivity, spread, size_meter_value,
  position_content, above_meters/below_meters), snow_*/weather_*, peaks.
  Geometry in SWEREF99 (EPSG:3006). WMS raster layers `slope_aspect`,
  `slope_inclination` (official slope maps). He expects an updated
  version (view changes) for next season — ask lavinprognoser@naturvardsverket.se.
  Unreachable from cloud sessions: `worker/scripts/fetch-api-fixtures.ps1`
  saves real answers to `worker/src/fixtures/nvgis/` for Fabian to push;
  **Switched 2026-10-06:** fixtures pushed (112 files; only areas 1, 2, 3,
  7, 8, 9 have forecasts — the others are sub-areas). `worker/src/forecastApi.ts`:
  per area `published_forecasts_by_interval` from 3 days back (ISO UTC
  times, one record per version; morning corrections have later
  `change_date`, superseded ones carry `updated_forecast_id`), plus
  `published_forecasts` (Swedish wall-clock times) only when no daily
  forecast is in force (off-season note "Prognossäsongen är avslutad" /
  pre-season "Försäsongstips": long risk-0 record → `seasonOver`).
  Same rules as the scraper: level only for a ≤ 48 h forecast covering now
  and published by now, newest version wins; risk 0 → notAssessed; 6/7 →
  `special: "spring" | "no-danger"` (app statuses `spring` / `no-danger`,
  labels Vårförhållanden / Ingen lavinfara, never a level or colour). The
  `published_forecasts` layer's own dates can be bogus (a "Måttlig" record
  "valid" 1 Jan–2 Mar), so the interval layer is primary. Problems:
  title → site slug, `sensitivity_spread_content` → text, size slider
  5/40/85/130/165 → size 1–5 texts (other values → no size). Asks with
  `propertyName` (no polygons); retries without it, and falls back to the
  page scraper per area if the API fails (`source: "api" | "page"` in
  `/forecasts`). Recent days from the API also backfill `forecast_history`
  (only today's rows can trigger push). Tested in `forecastApi.test.ts`
  incl. "same level as the archived page" for every overlapping day.
  App label for season-over is now "Utanför säsong" (true before and after).
  **Verified live 2026-10-06** (deployed `0244832`): all six areas
  `"source":"api"`, `seasonOver: true`, headline "Prognossäsongen är avslutad".
  **Trend + field report + weather (2026-10-06):** the API's `trend_*`
  (→ `trend {date, danger 1–5 | null, label, text}`), `snow_*`
  ("Rapport från området") and `weather_*` ("Fjällväderprognos") →
  `{title, text, link, linkText}`, only with a forecast in force.
  `htmlToLines()` keeps the editor's paragraphs/bold headings as lines
  (Office XML comments dropped); links only http(s), "www.x" → https.
  App: `ForecastTrendLine` ("Förväntad utveckling lör 20 feb: [badge] ↑",
  arrow vs today, comment unless `compact`) in `OfficialForecast` and on
  start-page cards; `ForecastNotes` (two `<details>`, `white-space:
  pre-line`) under the official forecast on region pages. App-side
  `toTrend`/`toNote` in `avalancheService.ts` re-validate (level only 1–5).
  **Season overview (2026-10-06):** worker `GET /forecasts/season?region=&season=YYYY`
  (YYYY = start year; 2016 … `currentSeasonYear`, which before November is
  last season): `published_forecasts_by_interval` 1 Nov → 15 Jun in 14-day pieces (`seasonUrls`, merged by id — one call for the whole season only returned its last weeks, seen 2026-10-06; cache key `&v=2`)
  **with propertyName only** (polygons would be tens of MB), `seasonSummary`
  = latest version per day (validTo date), level only 1–5 else the label,
  level counts, problems by days; Cloudflare-cached 7 days (past) / 1 h
  (current). App `/omrade/:id/sasong` (`SeasonPage`, lazy; link card
  "Säsongen dag för dag" on region pages): season chips (5 back), tiles,
  month calendars (Mon-first, level number in each cell, hatched = no
  level, tap → day + problems), bars per level (danger colours, counts as
  text), problems bars (accent), "Visa som lista" table view.
  `fetchSeason` goes through `cached()` (offline). Months without any daily forecast are left out and a line gives the first–last level day: Kebnekaisefjällen only had "Försäsongstips" 25 Nov–19 Feb 2026, dailies from 20 Feb (not a bug).
- **Terms + privacy review (2026-10-07):** new "Användarvillkor" section
  `/om-appen#villkor` (operator = Fabian as a private person, decision
  support not a guarantee, age ≥ 13, content rules, limited licence,
  reports/removal, liability "to the extent the law allows", Swedish law);
  signup needs the "godkänner användarvillkoren och är minst 13 år"
  checkbox — the worker refuses without `acceptTerms: true` and stores
  `users.terms_accepted_at` (migration `0016`). Privacy policy now names
  the controller, has an "updated" date, 6.1 f for security/Turnstile/
  reports, all recipients (Cloudflare, Resend, Google/Firebase, Apple),
  directly contacted services (SMHI, Mapterhorn, OSM, Turnstile), full
  retention incl. ≤ 30-day backups, all GDPR rights. Open questions for a
  lawyer (liability/insurance, private person vs company, DSA, health data
  art. 9, age, DPAs, transfers) in `Svenska laviner/JURIDIK.md`. Name
  check 2026-10-07: no "Snöläge"/"Snolage" trademarks at PRV or TMview
  (only an unrelated vehicle patent) — free to use; registering is optional.
- **Reporting everything else (DSA, 2026-10-08):** migration `0017`
  `content_reports` (item_type tour|route|comment|profile, one row per
  reporter), `comments.hidden`, `notifications.note`. `worker/src/reports.ts`:
  `POST /reports` (requirePoster, not your own, only what you can see, 20/h),
  comments hidden at 3 reports (`listComments` + counts skip hidden for
  others); admin `GET /admin/content-reports` (drops reports on deleted
  items), `/dismiss`, `/remove` {reason from `REMOVAL_REASONS`, note} —
  deletes tour/route/comment, or resets a profile's name to "Användare <id>"
  + removes the avatar — and sends the owner a "moderation" notification
  with the reason (statement of reasons). Reports are cleaned up in
  `socialCleanup`, `deleteComment` and account deletion. App: `ReportButton`
  on TourPage, FeedCard routes, comments (Reactions) and PersonPage;
  `ContentReports` section on `/admin`; terms text updated.
- **Search engines + share previews (2026-10-09):** `index.html` has the
  site description, canonical `https://snolage.se/`, Open Graph/Twitter tags
  with `public/og-image.png` (1200×630, rendered from HTML with Playwright —
  brand mark, Barlow Condensed, ridgeline) and WebSite JSON-LD.
  `components/pageMeta.ts` (called from Layout next to the tab title) sets
  per-page description (area pages by name), canonical = snolage.se + path
  (so fjallkoll.pages.dev / www count as snolage.se), og:title/url, and
  `robots` noindex for everything but the public pages and real area pages
  (accounts, people, tours, feed, forms stay out of search). Static
  `public/sitemap.xml` (public pages + every `/omrade/<id>` and `/sasong`;
  `pageMeta.test.ts` checks it against `REGIONS`) and `public/robots.txt`.
  Social scrapers don't run JS, so the `pageHeads()` plugin in
  `vite.config.ts` (2026-10-10) writes `dist/<path>.html` (e.g. `karta.html`,
  `omrade/<id>.html`, `omrade/<id>/sasong.html`) for every sitemap page —
  index.html with that page's title/description/canonical/og tags from
  `components/pageHead.ts` (pure, shared with Layout; tsconfig.node includes
  it, moduleResolution bundler). Pages serves `karta.html` at `/karta`;
  static files beat the `_redirects` SPA rule. `pageHead.test.ts` runs every
  sitemap path against the real index.html.
  Area pages (and public tours) have a share icon next to the star (`ShareButton.tsx`,
  `sharePage()` in `services/native.ts`: Capacitor Share in the apps,
  `navigator.share` in browsers that have it, else copies the link and
  says "Länken är kopierad"); the shared text never includes a level.
- **"Prognos inför din tur" (2026-10-10):** migration `0018` `trip_plans`
  (user, region, date, notified_at; unique per user/region/date) +
  `notifications.url`. `worker/src/trips.ts`: `GET/POST /trips`
  (today … +14 days, ≤ 20 upcoming), `DELETE /trips/:id`; `notifyTrips()`
  runs at the end of `recordAll` (cron 06/07/16/17:20 UTC + cache misses):
  for each region whose newly fetched forecast has a level (`historyRow`),
  plans for that date get a "trip" notification (bell + account web push +
  native) with level + problem names, once; from 07:00 Swedish time on the
  day itself, plans still without one get "inte publicerat någon farograd"
  — never a guessed level. Plans older than 7 days are pruned; deleted with
  the account. App: `TripPlanCard` (folding section "Prognos inför din tur"
  on area pages: day chips today…+7, toggle = plan/unplan, log-in link when
  signed out), `services/tripService.ts`; trip notices use the neutral
  "Snöläge" avatar. Privacy policy lists it.
- **Snödjup (2026-10-10):** `services/snowDepthService.ts` — SMHI metobs
  parameter 8 (daily snow depth, metres; same direct-from-app API as the
  wind stations, shape from SMHI docs, not verified live from cloud):
  active stations ≤ 60 km, nearest first (≤ 6 tried), shown when the latest
  value is ≤ 3 days old (max 3 stations); change vs the value ~3 days
  earlier (±12 h). `cached("snow-depth:<region>")` for offline.
  `SnowDepthCard` (section "Snödjup" after Väder on area pages, hidden when
  nothing fresh; 0 cm → "Barmark"; note that valley stations ≠ mountain).
- **Snabbobservation (2026-10-10):** `/observationer/snabb`
  (`QuickObservationPage`, lazy): big toggle buttons from
  `data/quickObservation.ts` (`QUICK_CHOICES`: Färsk lavin → lavin,
  Skjutsprickor → sprickor, Wumpf → kollaps, Snödrev / Mycket nysnö /
  Värme eller regn → ovrigt, plus "Inga varningstecken", which never
  combines with a sign); type = first chosen in that order, description
  "Snabbobservation: <signs>. <note>" (meets the worker's ≥ 10 chars), time
  now, position from `Geolocation.getCurrentPosition` (map
  `LocationPicker` shown if it fails or accuracy > 500 m). Start page
  "Ny observation" and the primary button on `/observationer` go here; the
  full form stays at `/observationer/ny` ("+ Utförlig observation").
- **Observations without coverage (2026-10-10):** `services/observationQueue.ts`
  — `submitObservation()` (both forms) sends with a fresh `clientId`; on a
  connection error (ApiError status 0 / no ApiError) the observation is
  kept in Preferences `fjallkoll:observation-queue` (per user, ≤ 20, image
  as data URL, original `observedAt`). `flushObservationQueue()` (single
  run at a time) sends oldest first: offline/401/429/5xx → stop and retry
  later; other 4xx → `failed` message, kept until the user removes it.
  `ObservationQueueBridge` (Layout) flushes at start, on `online`, on
  `visibilitychange` → visible and every 60 s while something waits;
  `ObservationQueueBanner` under the header ("N observation(er) väntar på
  täckning…", then "Din observation är skickad." for 6 s);
  `QueuedObservationList` (`/observationer#vantar`, "Ta bort", "Försök
  skicka nu"); the list reloads on `QUEUE_CHANGED_EVENT` with sent > 0.
  Worker: migration `0019` `observations.client_id` + unique
  (user_id, client_id); a resend returns the stored one with
  `duplicate: true` before the rate limit and image upload. Checked in a
  browser (offline send → banner → online → sent once). Privacy policy
  mentions it.
- **Admin overview (2026-10-10):** `GET /admin/stats` (`worker/src/adminStats.ts`,
  admin only, counts only): totals (users, verified, active last week via
  sessions, observations/hidden, tours/shared, routes, comments, follows,
  upcoming trip plans, web push, app devices, open reports), 12 Swedish
  weeks (Mon-first) of new users/observations/tours, per area stars (from
  `users.favorites`), observations, tours. App `/admin/oversikt`
  (`AdminStatsPage`, button "Översikt" on `/profil` for admins): tiles,
  three single-series weekly bar charts (accent, hover titles, aria label
  with all values, "Visa som tabell"), area table.
- **English version (2026-10-10):** `app/src/i18n/`: gettext-style
  `t("<Swedish text>", {vars})` with `{name}` placeholders, `plural(n, one,
  many)`, `locale()` for display dates/numbers (keep `"sv-SE"` only for
  machine YYYY-MM-DD dates), `compass()` (O/V → E/W), `isEnglish()`.
  English lives in `i18n/en.ts` keyed by the Swedish text (~1 150 entries);
  a missing entry shows Swedish. `i18n.test.ts` fails if any literal
  `t(`/`plural(` argument lacks English or placeholders differ — so every new
  UI text must go through `t()` and get an `en.ts` entry. Language =
  saved choice (localStorage `fjallkoll:language`) else browser
  (sv/nb/nn/no/da → Swedish, others English); outside a browser (build →
  page heads) always Swedish. Switching (`LanguageSwitch` in the menu and
  `/om-appen#sprak`) reloads, so module-level `t()` in data files is fine.
  Stays Swedish: forecast texts from NV (note shown in English; problem
  names mapped to EAWS English via `problemName()`), user posts,
  worker-made notification/email texts, place names; terms/privacy are
  translated with a note that the Swedish text applies. Tests run in
  Swedish (`test/setup.ts`); `english.test.tsx` checks English rendering.
- **Forecast health alarm (2026-10-10):** `worker/src/health.ts`, run from
  `recordAll` (cron + cache misses): `forecastProblems()` flags an area read
  from the page because the API failed, an area not fetched at all, and
  (10 Jan–10 Apr) no level anywhere. Migration `0022` `service_alerts`
  (one row "forecasts": problems, first_seen, last_sent). Email to every
  verified admin (`users.is_admin`) once trouble has lasted 30 min, again
  every 24 h, and "fungerar igen" when it clears; a single bad fetch that
  fixes itself sends nothing. `/admin/stats` returns `forecastHealth`, shown
  at the top of `/admin/oversikt`.
- **Admin emails (2026-10-10):** `worker/src/adminMail.ts` `mailAdmins(env,
  subject, lines, {footer, except})` → every verified `is_admin` user (used by
  health, season report, backup, reports). **Season's first forecasts:**
  `seasonReport.ts` `seasonStartReport` (from `recordAll`) emails once per
  season (`service_alerts` row `season-report-<year>`, claimed with
  `ON CONFLICT DO NOTHING`) when the first level 1–5 appears: per area what
  was read (level/label, API or page, valid until, headline, problems, trend)
  + the lavinprognoser.se link to compare by eye. Routine
  `trig_01GcbHBWKLYsHBRMxwxiUAAG` (one-shot 16 Dec 2026 07:47 UTC, fresh
  session, push + email) reminds Fabian to check. **Reports:**
  `reportMail.ts` `tellAdminsAboutReport` (via `defer` from
  `reportObservation` / `reportContent`): ≤ 1 email per 30 min (row
  `report-mail`), always when something was just auto-hidden; never to the
  admin who reported; includes the open-report count + `/admin` link.
- **Weekly D1 backup (2026-10-10):** cron `37 2 * * 1` (`BACKUP_CRON` in
  `index.ts` `scheduled`) → `backup.ts` `runBackup`: every table except
  d1_migrations/sessions/email_tokens/rate_limit_events/service_alerts,
  paged by rowid, gzipped JSON in R2 `IMAGES` at `backups/d1/<date>.json.gz`,
  kept 28 days; failure emails the admins. `/admin/stats` `backup`
  {latestAt, bytes, count} shown on `/admin/oversikt`. Restore:
  `worker/scripts/restore-backup.ts` → SQL (`PRAGMA defer_foreign_keys`);
  steps (Time Travel first) in `Svenska laviner/BACKUP.md`. Not yet run live
  (free-plan CPU limits are the risk; a failure emails).
- **Route on a tour day (2026-10-10):** migration `0021` trip_plans
  `route_id/route_title/route_steep`. `TripPlanCard` has "Jämför en sparad
  rutt med prognosen" (your saved routes, this area's first); the app runs
  `analyseRoute` and sends `steepProfile()` (`utils/routeForecast.ts`:
  `[sector 0–7, height per 10 m, metres]` for ground ≥ 30°) with
  `POST /trips {regionId, date, routeId|null, steep}` (re-POST updates,
  null removes; only your own routes). `notifyTrips` → `checkRoute()` in
  `worker/src/trips.ts` ports the app's matching (aspects, metre limits or
  treeline bands, 50 m margin, `TREELINE_M`) and adds "Din rutt ”X” går
  över brant mark … där prognosen anger: Drevsnöflak ca 400 m (NO)" or "ingen
  brant mark … – det betyder inte att den är säker". A snapshot: deleting
  the route clears it (`socialCleanup`). Privacy policy updated.
- **Notifications/emails in English (2026-10-10):** migration `0020`
  `lang` on users, push_subscriptions, native_devices (default 'sv').
  `worker/src/lang.ts` (`toLang`, `DANGER_NAMES`, `dangerText`,
  `problemName` slug → EAWS English, `dayName`, `compass`). Account:
  `POST /auth/lang` (AuthProvider sends it when `user.lang` ≠ app language;
  register sends `lang`); notification texts are built at read/push time in
  the reader's language (`describe(…, lang)`), trip and moderation notes at
  creation in the recipient's; verification/reset emails per account.
  Danger pushes per subscription/device: `lang` on `/push/subscribe` and
  `/native/register`, plus `POST /push/lang` / `/native/lang` sent by
  `syncPushLanguage`/`syncNativeLanguage` (NativePushBridge, on start) after
  a language switch. Admin alarm emails stay Swedish.
- **Duplicate tours (2026-10-10):** `POST /tours` with a timed track looks
  for one of your tours starting within 15 min with a length within
  max(30 %, 1 km); then 409 `{error, similarTo: {id, title, startedAt}}`
  (`HttpError.extra` → `error(…, extra)`), unless `allowDuplicate: true`.
  App: `ApiError.data`, `SimilarTourError` from `createTour`;
  `NewTourPage` shows "Visa den befintliga" / "Spara ändå"; health import
  marks such a workout imported and skips it silently.
- **SMHI weather warnings (2026-10-10):** `worker/src/warnings.ts` reads
  `https://opendata-download-warnings.smhi.se/ibww/api/version/1/warning.json`
  (shape confirmed via an open-source reader; cloud sessions can't reach
  SMHI — worth one live look at `/warnings` when SMHI has a warning out):
  alerts → `warningAreas` (`warningLevel.code` YELLOW/ORANGE/RED/MESSAGE,
  `eventDescription`, `areaName`, `approximateStart/End`, `descriptions`,
  `affectedAreas`, `area` GeoJSON). An area is warned when an outline
  covers its centre or a point ~20 km out, else (no outline) when its
  county is named (`COUNTY`). Ended warnings dropped. `GET /warnings` →
  `{regions: {id: Warning[]}}`, Cloudflare-cached 10 min, 502 on failure.
  App: `services/warningService.ts` (one shared request, `cached()`, ended
  ones filtered), `hooks/useWarnings.ts`, `WeatherWarnings` section after
  the official forecast on area pages (chip with icon + words, period, area,
  SMHI text, link, "säger inget om lavinfaran"), `WarningLines` on
  start-page cards. Tour-day notices append `warningSentence()` for warnings
  covering the day (`coversDay`). Test fixture `fixtures/smhi/warning-example.json`.
- **Tour-day offline map (2026-10-10):** `services/tripOffline.ts`
  `prepareTripOffline()`: planning a day (or choosing its route) saves the
  area's "Översikt" map unless already saved and the route corridor +
  analysis via `saveRouteOffline` when new or changed (`savedAt` vs
  `updatedAt`). Switch "Spara kartan offline när jag planerar en dag"
  (localStorage `fjallkoll:trip-offline`, default on), progress + Avbryt in
  `TripPlanCard`.
- **Google Play build (2026-10-10):** `.github/workflows/android-release.yml`
  (manual "Run workflow", input version name validated `1.0.0`-style, passed
  via env, never inlined): tests, build, `cap sync`, `bundleRelease` signed
  with the upload key from secrets `ANDROID_UPLOAD_KEYSTORE_BASE64`,
  `ANDROID_UPLOAD_STORE_PASSWORD`, `ANDROID_UPLOAD_KEY_ALIAS`,
  `ANDROID_UPLOAD_KEY_PASSWORD` (build.gradle `signingConfigs.release` only
  when `SNOLAGE_UPLOAD_STORE_FILE` is set; `SNOLAGE_VERSION_NAME`), .aab kept
  as an artifact 90 days, optional upload to the internal track with
  `PLAY_SERVICE_ACCOUNT_JSON` (first upload by hand). Steps in APPAR.md § 2.
  Not run yet (no key).
- **Tour days together (2026-10-10):** migration `0023` `trip_invites`
  (trip_id, from_user, to_user, status pending/accepted/declined,
  joined_trip_id). `worker/src/tripInvites.ts`: `POST /trips/:id/invites
  {userIds}` (your own upcoming day, only people you follow, ≤ 20 per trip,
  40/day; notification kind `trip_invite`), `POST /trips/invitations/:id
  {accept}` (yes → plans the same day for the invitee with the inviter's
  route snapshot (`route_title/steep`, `route_id` null), notifies the
  inviter `trip_join`). `GET /trips` adds per trip `invites` and `company`
  plus top-level `invitations`. Leaving a joined day → declined; invites go
  with the day, pruning and the account. App: `components/TripCompany.tsx`
  (`TripInvitations` Gå med/Tacka nej, `TripInviteBox` "Bjud in kompisar"
  from your follows) in `TripPlanCard`; notification links go to
  `/omrade/<id>#turdag` (`CollapsibleSection anchor` opens + scrolls).
- **Review 2026-10-10:** worker routes checked for auth/ownership (tours,
  routes, comments, images, admin, tiles, trips, invites, lang endpoints) —
  no gaps; D1's 100-values-per-query limit now respected (`experienceOf`
  in chunks of 90, invite lists capped), trip saves rate-limited 120/h.
  Browser sweep (27 routes × signed in/out × 390/1280 px × sv/en, mocked
  worker/SMHI; `pages-server.cjs`-style static server that serves
  `x.html` for `/x`): no console errors, overflow, unlabelled controls or
  stray Swedish in English. Fixed: warning line placement on start-page
  cards, bold helper text, heading hidden under the sticky header after a
  notification link, a lint warning in `ObservationQueueBanner`.
- **Usability round (2026-10-10, Fabian picked 1, 2, 4, 5, 6, 7):**
  welcome guide on the first visit (`WelcomeGuide.tsx`, only on `/` when
  nothing is starred, not signed in and `fjallkoll:welcome-done` unset —
  helpers in `services/welcome.ts`; steps: what Snöläge is + Svenska/English,
  pick areas (stars), notifications ticked by default and turned on by "Klar" (the browser permission needs that tap; `hooks/useRegionPush.ts` shared with `PushToggle`, stays open with the reason if refused); "Hoppa över"/Esc mark it done; decided
  once per visit so starring inside it doesn't close it; `FavoritesState.loaded`).
  "Vad betyder det för mig?" (`data/dangerAdvice.ts` `LEVEL_ADVICE` per
  published level, `DangerAdvice.tsx` under the official forecast; never
  says safe — tested) and per problem "Vad är …? / Så hanterar du det"
  (`PROBLEM_ADVICE`, `<details>` in `ForecastProblems`). Area pages: sticky
  `JumpNav` (Prognos · Lavinproblem · Turdag · Väder · Observationer ·
  Turer; `--header-h` set by Layout's ResizeObserver; opening a folded
  section via `OPEN_SECTION_EVENT`), problems moved right under the forecast,
  observations before tours, Om området/Karta offline near the end. Map
  presets (`map-presets` on `/karta`: Läget nu / Planera tur — slope:
  detailed if imported, else NV's lutning, else our own — / Turer; pressed
  state derived from the layer state; hidden in full screen so the map gets the room — Fabian's ask 2026-10-11). Start page `TodayTrip` leads with a
  planned day today or tomorrow (`cached(USER_SCOPE + "trips")`; tomorrow's
  level only from `/forecasts/history`, else "publiceras runt kl 18").
- **Design + themes (2026-10-10, "så att man inte ser att den är gjord av
  Claude"):** fonts Familjen Grotesk (headings, Swedish foundry) + Instrument
  Sans (text), `@fontsource-variable/*` (Barlow removed; Atkinson tried and
  dropped — slashed zeros; Familjen as body dropped — i-dots vanish).
  Tokens in `index.css`: night theme default, paper-map light theme under
  `[data-theme="light"]` and `prefers-color-scheme: light` unless
  `[data-theme="dark"]`; status colours as tokens (`--warn-*`, `--danger-*`,
  `--ok-*`, `--info-bg`, `--up/--down`, `--sign-*`) — no hard-coded UI colours
  in App.css except map/danger/warning chips. `services/appearance.ts`
  (`fjallkoll:theme` auto|light|dark, `fjallkoll:field-mode`; sets
  `data-theme`/`data-field` on `<html>`, theme-color meta, Capacitor
  `SystemBars.setStyle`; an inline script in index.html applies them before
  first paint). `ThemeButton` (sun/moon) in the menu, `AppearanceSettings` on
  `/om-appen#utseende`. Fältläge: root font 112.5 %, `--tap` 52 px, muted
  text brighter. Style rules: sentence-case headings (no uppercase except tiny
  labels), no coloured left/top stripes on cards, `--radius` 8 / `--radius-lg`
  12, text links without "→"/"←" — use `<Icon name="arrowRight|arrowLeft|external"
  className="icon--link">` (`components/Icon.tsx`, own 24 px line icons),
  Swedish spaced en dash " – " in UI text (never " — "), `Contours.tsx`
  height-curve backdrop on the start page and area headers. New mark: a peak
  with a stepped slab crown (`BrandMark` in Layout; blue #1c5d99 square in the
  icons). Icons/splash/og-image regenerated (scratchpad scripts: sharp for
  `assets/*.png` + `public/icons/*.webp` + `favicon.svg`, then
  `npm run app:icons` with the new colours; og-image rendered with Playwright).
- **Design pass "Fjällkartan" (2026-10-13, frontend-design skill, Fabian
  approved before/after):** colour means danger – only EAWS colours carry
  hue; chrome is paper/ink/lake blue + brown contour lines (`--contour-line`,
  `--divider`). Day `#f6f7f6` bg, `#17222b` ink, `#1c5d99` accent; night
  polar-night `#0b1722`/`#112231`/`#1a2d3d`. `--signal` now = ink (`var(--text)`),
  the old orange is retired (it competed with level 3); bell count and XP bar
  use accent. **One family:** Instrument Sans `wdth.css` (Familjen Grotesk
  removed); headings and numbers at `font-stretch: var(--display-stretch)`
  (78 %), `--font-display` = body family. **Signature:** `DangerHero` at the
  top of area pages (band in the danger colour, big narrow numeral, label,
  `DangerStair` = the scale as five rising steps, today's filled; neutral band
  with `forecastLabel` when no published level); the stair is only there (and
  in the og-image) – restraint. No all-caps labels; no "A · B · C" meta
  strings (commas; `problemWhere` → "N/NO/O, kalfjället och trädgränsen");
  observation/tour lists are rows with contour dividers, not cards; start
  page date sits in the lead line, the "Imorgon" label only shows with two
  trips. og-image re-rendered (scratchpad `og/og.html`). theme-color, manifest,
  Capacitor background `#0b1722`.
- **Phone tab bar (2026-10-10):** ≤ 640 px (`hooks/usePhoneLayout.ts`)
  `TabBar.tsx` fixed at the bottom: Idag (also active on `/omrade/*`) ·
  Karta · Observera (raised accent button → `/observationer/snabb`) · Flöde
  (also `/person/*`) · Turer — Fabian asked for Flöde in the bar too. On
  phones the header shows bell + avatar (`app-shell__quick`) and "Meny"
  holds only the rest (`tab: true` items filtered out of `NAV_GROUPS`, empty
  groups dropped, language + theme). Desktop unchanged. z-index 30 (the
  full-screen map at 50 covers it); `main` gets bottom padding.
- **Warning signs on tours (2026-10-11, Fabian: "Inga varningstecken" belongs
  to the tour, not an observation):** migration `0024` `tours.danger_signs`
  (NULL = not answered, `'[]'` = none seen, else sign ids as in
  `DANGER_SIGNS`); `dangerSigns` on create/update (`readSigns`, undefined on
  update keeps it) and in `Tour`. App: `TourSignsPicker` (chips + "Inga
  varningstecken", exclusive; `data/tourSigns.ts` `toggleTourSign` —
  unticking the last sign returns to "not answered") on `/turer/ny` and the
  owner's settings on `TourPage`; `TourSignsList` on TourPage, TourCard and
  FeedCard. The quick observation no longer offers "Inga varningstecken" —
  a hint links to Turer instead. Health-imported tours start unanswered.
- **App Store readiness (2026-10-12, Fabian: "allt du kan så att bara mina
  steg är kvar"):** **Blocking** (App Store guideline 1.2): migration `0025`
  `blocks` (blocker_id, blocked_id); `worker/src/blocks.ts` (`notBlockedSql`
  — bind the viewer twice, `blockedBetween`, `POST/DELETE /people/:id/block`;
  blocking removes follows both ways, notices between them and pending trip
  invites), `GET /people/me/blocks` (`myBlocks` in social.ts). Works both
  ways: tours/observations/heatmap lists, comments, people search hide the
  other; follow/comment/like → 403; `notify` skips; `getTour` 404s; person has
  `blocked`/`blockedByMe`; deleted with the account. App: `BlockButton` on
  PersonPage (confirm; only the blocker can unblock), "Blockerade" list on
  `/profil`; terms + privacy policy (updated 12 Oct). **iOS project:**
  `PrivacyInfo.xcprivacy` (no tracking, collected types = App Privacy answers,
  UserDefaults CA92.1, FileTimestamp C617.1), permission texts English in
  Info.plist + `en.lproj`/`sv.lproj` `InfoPlist.strings`, `CFBundleLocalizations`
  en/sv, `TARGETED_DEVICE_FAMILY = 1` (iPhone only → no iPad screenshots);
  CI build + simulator start OK. **Store screenshots:** workflow
  `store-screenshots.yml` ("Butiksbilder", on changes to
  `app/scripts/store-screenshots.mjs` or by hand via the API) builds the site,
  takes 1320×2868 shots (sv + en, sample forecasts/people, real tiles and
  Mapterhorn heights) and commits them to `Svenska laviner/app-store/`
  (artifacts can't be downloaded from cloud sessions). **`Svenska
  laviner/APPSTORE.docx`** (Word since 2026-10-14; markdown source in git history before `8310272`): every App Store Connect field (sv + en texts with
  checked lengths, keywords, URLs, App Privacy table, age 13+, review notes
  incl. demo account `fabian.n.sund+apple@gmail.com` that Fabian creates).
  Workflows on non-default branches have no "Run workflow" button (default
  branch is `main`) — start them with `gh api -X POST
  repos/Fabsu951/Projekt1-Test/actions/workflows/<file>/dispatches -f
  ref=claude/bold-lamport-juktha`.
- **Google Play (2026-10-14):** Fabian's Play Console account is verified.
  `Svenska laviner/GOOGLEPLAY.docx` (Word, Fabian's wish; built from markdown with scratchpad `word/build.cjs` – the markdown source is in git history, commit `027ae43`) has every step and answer (upload key +
  4 secrets, release build via API dispatch of `android-release.yml` with
  input `version_name`, create app + Play App Signing, internal test, listing
  sv/en with checked lengths, App content incl. Data safety and the Health
  Connect declaration text, 12 testers × 14 days, production). Assets in
  `Svenska laviner/google-play/` (`ikon-512.png`, `funktionsbild-1024x500.jpg`
  from scratchpad `og/feature.html`, `skarmbilder/` 1080×1920 from the
  Butiksbilder workflow – Play allows at most 2:1). Reviewer account
  `fabian.n.sund+google@gmail.com` (Fabian creates it).
  **First Play upload 2026-10-14/15:** 1.0.0 (207) on internal testing; 1.0.1 (209)
  drops the Health Connect permissions capacitor-health declares but we never use
  (`tools:node="remove"` in the app manifest: steps, heart rate, weight, nutrition…),
  so Play only asks about exercise, routes and background read. Internal app sharing
  refuses until the app is published (store listing + App content done).
  **Pre-launch review (2026-10-17):** offline downloads (`downloadTiles`) fetch with
  `redirect: "manual"` and skip tiles the worker redirects to openstreetmap.org (OSM's
  tile policy forbids offline prefetch); privacy policy now says Health Connect data
  is only used for the tour diary, never sold/ads (Play's Limited Use), updated 17 Oct.
  **Stress test (2026-10-18):** monkey test (random taps/typing/back-forward on 23
  pages, phone/desktop, sv/en), layout sweeps (320/390/768/1280 px, landscape,
  light/dark, field mode), worst-case content (30-char names and 100-char titles
  without spaces, 300 observations, 500 tours, 5000-point track), rapid taps
  (double submits send once), axe (WCAG 2.1 AA) and a worker timing probe with
  3000 users/6000 observations/4000 tours. Fixed: Leaflet's zoom-end timer on a
  removed map (`components/leafletFixes.ts`, imported by `offlineTileLayer.ts`),
  long words overflowing (`main { overflow-wrap: anywhere }`, `select { max-width:
  100% }`, `.form__field { min-width: 0 }`), comment form/steepness table at
  320 px, inline links underlined (`main p a`, `main li > a:not([class])`), avatar
  initials and overview-map labels `aria-hidden`; `/tours/lines` now built as
  text around the stored preview JSON (`tourLinesBody`) and edge-cached 5 min
  for anonymous requests (the app never sends a token there) – 39 → 6 ms.
  Known/accepted: PBKDF2 100k ≈ 18 ms CPU per login/signup (free plan nominally
  10 ms; works in practice), axe "label in name" on the avatar link and overview
  map. Scripts in the scratchpad (`monkey.mjs`, `sweepS.mjs`, `extreme.mjs`,
  `rapid.mjs`, `axe.mjs`, shared `mock.mjs`).
  **Compact phone chrome (2026-10-15, Fabian approved a before/after):** header
  and tab bar about half as tall (`.app-shell--tabs` rules, tab bar after
  `.tab-bar`). Android app: `data-native="android"` (inline script + `initNativeApp`)
  makes `--safe-*` use only Capacitor's `--safe-area-inset-*`, and
  `insetsFromSystem()` (screen.height − innerHeight > 20 px → `data-insets="system"`)
  zeroes them when Android already laid the page out between the bars – the
  S22 got the status/navigation bar height twice from env().
- **Dela position (2026-10-19, idea from Fabian's dad):** time-limited sharing
  of your latest position with people you pick: today's tour company
  (accepted `trip_invites` for a trip dated today, either direction or fellow
  invitees) or people you follow; blocked people never. Migration `0026`
  `location_shares` (one row per user: started/ends_at, lat/lon/accuracy/
  position_at – **only the latest point, no trail**) + `location_share_viewers`.
  `worker/src/locationShare.ts`: `GET/POST/DELETE /location/share` ({viewerIds,
  hours 1–12}; ≤ 20 viewers, 20 starts/h; restart replaces viewers and clears the
  point; newly added viewers get notification kind `location_share` → url
  `/karta?kompisar=1`), `POST /location/position` (404 when no running share),
  `GET /location/shared-with-me`. Ended shares are deleted (`pruneShares` on
  every shared-with-me call + in `recordAll`); excluded from backups; removed on
  block and account deletion. App: `services/locationShare.ts` (API, device state
  Preferences `fjallkoll:location-share` {userId, endsAt}, `shouldSend`: first
  fix, then ≥ 50 m and ≥ 60 s, or every 5 min), `LocationShareBridge` (Layout;
  `Geolocation.watchPosition` while the app is open – **no background
  sending**, needs a native foreground service + Play declaration if ever
  wanted), `LocationShareBanner` under the header while sharing,
  `/dela-position` (`SharePositionPage`: warning "ersätter inte
  sändare/mottagare … Vid en olycka: ring 112", people with today's company
  pre-ticked, 2/4/8/12 h, status + stop, "Delar med dig"), map layer
  `FriendPositions` (initials in ink discs, accuracy circle, polls every 60 s while
  visible, `?kompisar=1` frames them), quick action "Dela position" on the start
  page, link from today's tour day in `TripPlanCard`; logout/account deletion
  stop sharing. Privacy policy + terms (not a rescue service) updated 19 Oct;
  iOS location usage strings mention sharing. Deliberately **not** built:
  showing your position to strangers nearby (stalking risk) and any SOS/alarm.
  **Last known point (2026-10-19, Fabian: 24 h + a calm notice):** stopping
  deletes at once; a share that **runs out without being stopped** keeps its
  last point for `LINGER_HOURS` = 24 (migration `0027`
  `expired_notified_at`; `pruneShares` deletes no-position shares at the end
  and the rest after 24 h). Cron `*/15 * * * *` (`SHARES_CRON`) →
  `notifyEndedShares`: once per share, kind `location_share_ended` to the
  viewers ("Delningen från X tog slut kl. … utan att stoppas. Senast kända
  position (kl. …) syns på kartan i 24 timmar.") and to the owner (self-notice
  allowed for this kind, url `/dela-position`). `/location/shared-with-me`
  rows carry `ended` + `keptUntil`; `/location/share` returns `lingering`.
  App: hollow dashed `friend-pin--ended` pins + "Ingen kontakt? Ring 112.",
  "Din senaste position syns fortfarande" + "Ta bort min position",
  banner via Preferences `fjallkoll:location-share-left` (`shareRanOut`,
  also derived from an expired `fjallkoll:location-share` when the app was
  closed). Privacy policy says so.
  **Background sending (2026-10-19, Fabian asked):** in the apps a native
  sender takes over from `LocationShareBridge` (which now only watches the
  position itself in browsers): `services/nativeShare.ts` (`registerPlugin
  ("ShareLocation")`: `start({token, url, endsAt, text, stopText})`, `stop`,
  `status`, events `sent` / `stopped` {reason ended|stopped|gone}).
  Android: `ShareLocationService.kt` = foreground service
  `foregroundServiceType="location"` (manifest `FOREGROUND_SERVICE` +
  `FOREGROUND_SERVICE_LOCATION`, no ACCESS_BACKGROUND_LOCATION – it is started
  while the app is open), `LocationManager` GPS + network every 60 s, same
  throttle as `shouldSend`, POSTs with HttpURLConnection, ongoing notification
  channel `share-position` with "Stoppa" (DELETEs the share) and tap →
  `/dela-position`; stops at the end time or on 404/401; on stop/gone it
  removes `fjallkoll:location-share` from `CapacitorStorage` so the app won't
  restart it. `ShareLocationPlugin.kt` registered in MainActivity. iPhone:
  `ShareLocationPlugin.swift` (CLLocationManager, background updates +
  blue indicator, `UIBackgroundModes` `location` in Info.plist, added to the
  pbxproj by hand with ids `A1…09`/`A1…19` – check ids are unused before adding more, registered in MainViewController).
  **Play Console needs a "Foreground service permissions" declaration
  (location, with a short video) before a release with this goes out.**
  **Bug found by the video (2026-10-19):** Capacitor's `PluginCall.getDouble`
  returns null for a JS number that arrives as a Java Long (ms timestamps), so
  `endsAt` was 0 and the service refused every start – 1.0.5 (228) has this bug,
  fixed from 1.0.6. The plugin reads `(call.data.opt(key) as? Number)`; never use
  getDouble/getInt for big numbers. `LocationShareBridge` now falls back to
  page sending when the native start fails or returns `started: false`.
  **Demo video:** `.github/workflows/play-video.yml` (runs when it or
  `app/scripts/play-video/**` changes) builds a demo APK against
  `scripts/play-video/server.mjs` (made-up people, no levels), records the real
  app in an API 34 **default (no Google services – the google_apis image's GMS
  crashed and killed the app)** emulator with Playwright `_android` + adb
  screenrecord (`drive.mjs`; frees runner disk first; no map step – swiftshader
  crashed the emulator; fails if the "Stoppa" notification is missing) and
  commits `Svenska laviner/google-play/dela-position.mp4`; deploy.yml copies it
  to `https://snolage.se/play/dela-position.mp4` (the bot's commit doesn't
  trigger a deploy – dispatch deploy.yml). Verified 2026-10-19: notification
  "Snöläge delar din position till kl. …" + STOPPA shows, tapping it ends the
  share. Not yet tried on a real phone.
- **Known gaps**: not yet reviewed by a lawyer (see JURIDIK.md).

 (context for why some code looks the way it does)

1. **EAWS terminology**: "flaklavin" was wrongly used as one of the 5
   avalanche-problem categories; correct EAWS term is "glidlavin" (gliding
   snow). Fixed across `types/avalanche.ts`, `avalancheService.ts`,
   `avalancheProblems.ts`.
2. **SMHI forecast API migration**: SMHI retired the old `pmp3g` point
   forecast API on **2026-03-31**, replaced by `snow1g` — renamed
   `validTime`→`time`, and the `{name,values}` parameter array became a flat
   `data` object with renamed keys (`t`→`air_temperature`, `ws`→`wind_speed`,
   `wd`→`wind_from_direction`, `gust`→`wind_speed_of_gust`,
   `Wsymb2`→`symbol_code`, `pmean`→`precipitation_amount_mean`). This broke
   `weatherService.ts` silently (404s) until fixed. If SMHI ever changes
   their API again, this is the file to check first — verify against a live
   response (`https://opendata-download-metfcst.smhi.se/api/category/snow1g/version/1/geotype/point/lon/{lon}/lat/{lat}/data.json`).
3. **Wind rose showing all zeros**: not a bug — `computeWindLoading` only
   counts wind ≥ 6 m/s (`TRANSPORT_THRESHOLD_MS` in `windAnalysis.ts`) as
   "significant transport", so genuinely calm readings show all-zero
   sectors, indistinguishable from broken data. Fixed by adding
   `rawWindSummary()` and surfacing the actual max measured speed/direction
   in `WindRose.tsx`'s summary text when load is zero.

4. **Forecast wind rose "empty"** (reported end of previous session):
   was a stale deploy, not a code bug — `RegionDetail.test.tsx` reproduces
   the user's exact values and passes. Follow-up UX changes in
   `WindRose.tsx` (now takes raw `readings`): calm periods draw wind-FROM
   directions in grey with "Ingen transport" in the hub; a note appears at
   5–6 m/s (`NEAR_THRESHOLD_MS`); loaded view says "Vind från V → mest
   vindlastat: O-vända sluttningar" with an arrow, because users read the
   lee-side wedges as the wind direction.

## Other notes

- Cloud (claude.ai/code) sessions cannot reach SMHI, Cloudflare, or
  fjallkoll.pages.dev (network policy), so deploys and live checks are
  done by Fabian locally; screenshots in-session use mocked SMHI data.
- Fabian pasted a live `CLOUDFLARE_API_TOKEN` into chat earlier in this
  project's history. **Resolved 2026-10-07:** he deleted both user API
  tokens ("Edit Cloudflare Workers" and an auto-created "Cloudflare Agent
  Token - 2026-09-23"), and no `CLOUDFLARE_API_TOKEN` env var is set;
  wrangler uses its OAuth login (`npx wrangler login`).
- `app/public/sw.js` (push since 2026-09-26, **offline app shell since
  2026-10-05** — replaces the old "push only, no caching" rule): the
  `offlineAppShell()` plugin in `vite.config.ts` writes a content-hash
  VERSION and the list of built files into `dist/sw.js`; install precaches
  them in `snolage-app-<version>`, activate deletes older app caches
  (never tile caches). Navigations are **network-first** (offline → saved
  `/`), so a new deploy always shows when online — that is what keeps the
  old stale-content confusion away; `/assets/` (hashed) cache-first.
  Registered in `main.tsx` for web production builds only, not in the
  native apps (they bundle the site).
- Test suite: Vitest, run via `npm run test -- --run` from `Svenska laviner/app`
  (293 tests as of 2026-10-19, all passing). Worker has its own Vitest
  suite in `Svenska laviner/worker` (`npm test`, 201 tests, including the
  real-page fixtures).
