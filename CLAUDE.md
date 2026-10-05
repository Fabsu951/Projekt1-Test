# Fjällkoll — project state

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
> the local folder `fjallvarning-repo`, branch `svenska-laviner`, and the
> Capacitor appId `com.fabsu951.projekt1`. No domain bought yet.

Swedish avalanche forecast/safety app ("Fjällkoll") for backcountry skiers,
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
    proxy"). Also has a `/forecasts` route that scrapes lavinprognoser.se.
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
  stores. Open decision: appId is still `com.fabsu951.projekt1` and becomes
  permanent at first store upload. No Android SDK in cloud sessions, so APKs
  are built on Fabian's PC.
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
- `app/public/sw.js` is a service worker **for push notifications only**
  (added 2026-09-26): no fetch handler, no caching, so it can't cause the
  stale-content confusion seen earlier. Keep it that way.
- Test suite: Vitest, run via `npm run test -- --run` from `Svenska laviner/app`
  (148 tests as of 2026-10-05, all passing). Worker has its own Vitest
  suite in `Svenska laviner/worker` (`npm test`, 88 tests, including the
  real-page fixtures).
