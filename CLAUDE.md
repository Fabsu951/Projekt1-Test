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
  **Possible end date:** a web search (2026-09-25) said Lantmäteriet will
  discontinue "Topografisk webbkarta Visning, översiktlig" on
  **2026-12-31**. Not yet verified (lantmateriet.se is blocked from cloud
  sessions). Fabian should check the product page on Geotorget and find the
  replacement product before the winter season. The licence **is** CC0;
  "ccby" in the URL is just a leftover name.
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
  account needed. The region list shows "Mina områden" first, then
  "Övriga områden". `RegionCard` is now a div with a link + the star
  (a button can't sit inside a link). Push notifications for favorites
  (the rest of feature 3) are not built yet — they need Firebase (Android)
  and an Apple Developer account (iOS) set up by Fabian.
- **Richer observations (2026-09-26, Regobs-style):** migration `0004`
  adds `danger_signs` (JSON array; ids in `DANGER_SIGNS` in
  `worker/src/observations.ts` and `app/src/data/dangerSigns.ts`, which must
  match: farska_laviner, skjutsprickor, wumpf, snodrev, mycket_nysno,
  snabb_uppvarmning) and optional `snow_depth_cm` (0–1000). The form has
  "Varningstecken" checkboxes + "Snödjup"; cards show them as chips;
  `/observationer` filters by område, typ and tid (`?type=&days=`, default
  30 days). Older rows default to no signs / no depth.
- **Known gaps**: no login rate limiting beyond PBKDF2 cost; no
  Turnstile/captcha; not reviewed by a lawyer.

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
- No service worker / PWA caching in the app (checked — ruled out as a cause
  of stale-content confusion earlier).
- Test suite: Vitest, run via `npm run test -- --run` from `Svenska laviner/app`
  (79 tests as of 2026-09-26, all passing). Worker has its own Vitest
  suite in `Svenska laviner/worker` (`npm test`, 31 tests, including the
  real-page fixtures).
