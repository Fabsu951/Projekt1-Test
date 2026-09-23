# Fjällvarning — project state

Swedish avalanche forecast/safety app ("Fjällvarning") for backcountry skiers,
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

- **Site**: Cloudflare Pages project `fjallvarning`. Stable production URL:
  `https://fjallvarning.pages.dev`.
  - Deploy from `Svenska laviner/app` after `npm run build`:
    ```powershell
    npx wrangler pages deploy dist --project-name=fjallvarning --branch=production --commit-dirty=true
    ```
  - **`--branch=production` is required.** Without it, wrangler infers the
    branch from git (`svenska-laviner`), which creates a random-subdomain
    *preview* deployment that never updates `fjallvarning.pages.dev`. This
    caused a real confusion earlier — always redeploy with that flag, and
    always verify on `fjallvarning.pages.dev` itself, never a bookmarked
    preview URL.
  - Must build with `VITE_MAP_PROXY_URL` set (see below) or the map falls
    back to plain OpenStreetMap tiles instead of the Lantmäteriet basemap.
- **Worker**: `fjallvarning-worker`, deployed at
  `https://fjallvarning-worker.fabian-n-sund.workers.dev`. Deploy from
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
    page; never reintroduce guessed danger levels. Avalanche problems are
    not scraped, so that section only appears if a future source adds them.
  - **Scraper not yet validated against the live site** (unreachable from
    cloud sessions): 3 of 6 slugs in `worker/src/regions.ts` are guessed,
    and `parse.ts`'s regexes are based on the toppturvarsel scraper, not
    real markup. Check `https://fjallvarning-worker.fabian-n-sund.workers.dev/forecasts`
    once the season starts (mid-December) — `fetchError` on a region means a
    bad slug; `confidence: "none"` means the parser missed. Also watch that
    `/ej\s+bedömd/` doesn't false-positive on a page legend.
- Full rebuild+redeploy sequence when app code changes:
    ```powershell
    cd C:\Users\fabia\Documents\fjallvarning-repo
    git pull origin svenska-laviner
    cd "Svenska laviner\app"
    $env:VITE_MAP_PROXY_URL="https://fjallvarning-worker.fabian-n-sund.workers.dev"
    npm run build
    npx wrangler pages deploy dist --project-name=fjallvarning --branch=production --commit-dirty=true
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
- **A** — design/layout (ski-focused visual identity): **mostly done**.
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
  - Possible next: custom compass/aspect icons.

## Bugs fixed this session (context for why some code looks the way it does)

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
  fjallvarning.pages.dev (network policy), so deploys and live checks are
  done by Fabian locally; screenshots in-session use mocked SMHI data.
- Fabian pasted a live `CLOUDFLARE_API_TOKEN` into chat earlier in this
  project's history; he was advised to rotate it (Cloudflare dashboard → My
  Profile → API Tokens). Unconfirmed whether he did.
- No service worker / PWA caching in the app (checked — ruled out as a cause
  of stale-content confusion earlier).
- Test suite: Vitest, run via `npm run test -- --run` from `Svenska laviner/app`
  (44 tests as of 2026-09-23, all passing). Worker has its own small Vitest
  suite in `Svenska laviner/worker` (`npm test`).
