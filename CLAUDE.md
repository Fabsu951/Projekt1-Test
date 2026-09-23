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
  the mismatch with the folder name).

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
    proxy"). Also has a `/forecasts` route that scrapes lavinprognoser.se
    (built but not yet wired into the frontend — the app currently generates
    its own placeholder/synthetic forecasts client-side).
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
- **A** — design/layout (ski-focused visual identity): **in progress, not
  started yet**. User's answers when asked (via AskUserQuestion):
  - Visual direction: **"Äventyrlig/utomhus"** (adventure/outdoor) — more
    visually driven than the current plain dark theme; deeper palette
    (ice-blue, granite-grey, orange/yellow accent), stronger typography,
    in the spirit of Gaia GPS / onX Backcountry (not photorealistic).
  - Graphics: **yes, simple SVG icons/illustrations** — e.g. a mountain
    silhouette in the header, custom icons for compass directions/avalanche
    problem types instead of generic ones. No photos, no heavy assets.
  - Nothing has been implemented for A yet — this is the next task.

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

## Open issue — NOT YET RESOLVED

User reported (most recent message before this file was written): the
**forecast** wind rose ("Prognos, kommande timmar" subsection in
`RegionDetail.tsx`, the one below "Uppmätt, senaste dygnet") still shows no
wind data, even though the region's own hourly weather table showed forecast
wind speeds of 13 m/s and 11 m/s — well above the 6 m/s transport threshold,
so that rose should NOT be all-zero. This was never actually diagnosed — I'd
asked for a screenshot scrolled further down to see that specific subsection,
but the session ended before getting a reply. **First thing to check next
session.** Possible angles:
- Is the "Prognos, kommande timmar" section rendering at all? (Gated on
  `{weather && (...)}` in `RegionDetail.tsx` — should be truthy given the
  Väder table has data.)
- Is `forecastWindLoading`/`computeWindLoading(weather ?? [])` actually
  producing non-zero sectors for that data? (`computeWindLoading` and
  `rawWindSummary` are pure functions over the same `weather` array already
  proven correct elsewhere on the page — worth writing a quick repro test
  with the exact values from the user's screenshot: 13 m/s, 11 m/s, 7 m/s,
  4 m/s, 3 m/s, 3 m/s at directions V/V/V/VSV/SSV/SV.)
- Could be a stale-deploy issue again (check they're on
  `fjallvarning.pages.dev`, hard-refreshed, and the deploy actually included
  the latest commit) rather than a code bug — rule this out first before
  changing code.

## Other notes

- Fabian pasted a live `CLOUDFLARE_API_TOKEN` into chat earlier in this
  project's history; he was advised to rotate it (Cloudflare dashboard → My
  Profile → API Tokens). Unconfirmed whether he did.
- No service worker / PWA caching in the app (checked — ruled out as a cause
  of stale-content confusion earlier).
- Test suite: Vitest, run via `npm run test -- --run` from `Svenska laviner/app`
  (36 tests as of this writing, all passing). Worker has its own small Vitest
  suite in `Svenska laviner/worker` (`npm test`).
