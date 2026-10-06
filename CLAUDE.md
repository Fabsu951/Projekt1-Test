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
  CC0 replacement is **Topografisk webbkarta Nedladdning, raster**
  (GeoPackage/PNG, EPSG:3857 zoom 0–17, updated quarterly). Built
  2026-09-26: the app now loads `${VITE_MAP_PROXY_URL}/tiles/topowebb/{z}/{x}/{y}.png`
  (`TopoLayer.tsx`, maxNativeZoom 15); the worker (`worker/src/tiles.ts`)
  serves from R2 (`IMAGES` bucket, keys `maptiles/topowebb/z/x/y`), else
  fetches from the old WMTS and writes the tile to R2 (read-through, so
  viewed tiles survive the shutdown), else 302s to OpenStreetMap.
  Bulk import: `worker/scripts/import-tiles.ts` (run with `npx tsx`,
  uses `node:sqlite`, maps GeoPackage levels onto z/x/y via
  `gpkgTiles.ts`, uploads 200-tile batches in `tileBatch.ts` format to
  `POST /admin/tiles/topowebb`, authorised by a fresh random
  `TILE_UPLOAD_TOKEN` secret it sets each run). Fabian's step-by-step
  (order boxes in SWEREF 99 TM, ~270k tiles ≈ 7 GB) is in
  `Svenska laviner/KARTBYTE.md`; waiting on Geotorget (HTTP 500 on
  2026-09-26). The old `/topowebb` WMTS proxy route is kept for old app
  builds. Worker only fetches/stores on demand for z ≤ 15 inside a box
  around Sweden (`fetchable()`), so it can't be used to crawl.
  **Offline maps (feature 5, 2026-09-27):** "Karta offline" section on
  region pages (`OfflineMapCard.tsx`, `services/offlineMap.ts`): saves a
  ~60×60 km square around the region at z8–13 ("Översikt", ~30–40 MB) or
  z8–14 ("Detaljerad", ~110–150 MB) into Cache Storage, one cache per
  region (`fjallkoll-tiles-<id>`), metadata in Preferences
  (`fjallkoll:offline-maps`). `TopoLayer` uses `OfflineTileLayer`
  (`offlineTileLayer.ts`), which shows a saved tile before hitting the
  network. Tile URLs live in `services/mapTiles.ts` and must match exactly
  between download and display. Hidden where Cache Storage is missing
  (possibly iOS Capacitor's `capacitor://` scheme — untested) or without a
  worker URL.
  Slope: "Markhöjdmodell Visning" is paid; "Markhöjdmodell Nedladdning,
  grid 1+" is free (CC BY 4.0, STAC API, access must be applied for) but
  needs our own slope rendering — a later project.
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
  - Barlow Condensed via `@fontsource/barlow-condensed` (self-hosted, so it
    works offline in the native app) for headings, brand, nav.
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
  Login: 5 failures per email + 20 per IP per 15 min (success clears the
  email counter). Signup: 5 accounts per IP per hour. Mentioned in the
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
  get web push after "Lägg till på hemskärmen". Native app push (Firebase
  + APNs) is still not built.
- **Turdagbok (tour diary, 2026-09-27, idea from Fabian's parents):**
  users upload GPX/FIT files from their watch (`app/src/utils/trackImport.ts`,
  FIT via `@garmin/fitsdk`, loaded lazily; simplified to ≥ 10 m spacing,
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
  (`SeasonFilter.tsx`); `/karta?turer=varmekarta` opens it directly. The layer toggles on `/karta` sit in a foldable "Kartlager (n på)" panel (open/closed remembered in localStorage `fjallkoll:map-layers-open`); the slope disclaimer stays outside it on purpose. "Helskärm" makes the map cover the whole window (fixed, above the site header; Esc or "Stäng helskärm" leaves) with the buttons, layer panel and notices floating on top; icon-only buttons under 600 px; `FitToContainer` calls `invalidateSize()` on the switch.
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
  puts the route in followers' feeds. No notifications for new comments
  yet; comments can't be reported (owners/authors/admins delete instead).
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
  5/40/85 → the site's size 1/2/3 texts (other values → no size). Asks with
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
  `fetchSeason` goes through `cached()` (offline).
- **Known gaps**: no email verification until a domain + Resend are set
  up; not reviewed by a lawyer.

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
  project's history; he was advised to rotate it (Cloudflare dashboard → My
  Profile → API Tokens). Unconfirmed whether he did.
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
  (181 tests as of 2026-10-06, all passing). Worker has its own Vitest
  suite in `Svenska laviner/worker` (`npm test`, 106 tests, including the
  real-page fixtures).
