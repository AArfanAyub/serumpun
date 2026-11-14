# Serumpun

**What to plant this month, and what to plant next — explained, free, and fully offline-capable.**

Serumpun is a small, mobile-first web app for smallholder farmers and extension workers.
Give it a location and the current month and it:

1. shows what the field is like right now (temperature, rainfall, soil wetness, elevation),
2. ranks 3–5 crops to plant **this month** with a 0–100 score explained by seven named factors,
3. builds a **3-season rotation plan** and compares **at least three rotation strategies**,
   including the farmer's existing rotation.

Every displayed number carries its source, its freshness and an `isEstimated` flag. Every
recommendation and rotation view carries a fixed decision-support disclaimer and the
"regional estimate, not a measurement at your field" caveat.

---

## Use it right now — no installation

| What | Where |
|---|---|
| **Web app** — the full app, on any phone or computer, installable to the home screen, works offline | **https://aarfanayub.github.io/serumpun/** |
| **How to use** — 13-slide visual walkthrough with a screenshot of every screen | **https://aarfanayub.github.io/serumpun/guide.html** |
| **Windows portable `.exe`** — single file, no install, runs from a USB stick | [Latest release](https://github.com/AArfanAyub/serumpun/releases/latest) |
| **Windows installer `.exe`** — optional, with shortcut and uninstaller | [Latest release](https://github.com/AArfanAyub/serumpun/releases/latest) |
| **Source code** | https://github.com/AArfanAyub/serumpun |

The web version is hosted for free on **GitHub Pages** from the `gh-pages` branch.
Maintainers can publish a new build with one command:

```bash
npm run deploy:pages   # type-check + build, then push dist/ to the gh-pages branch
```

That script needs only a normal `repo`-scoped GitHub login (`gh auth login`) and the
`origin` remote. A ready-made GitHub Actions workflow is kept at
`docs/pages-workflow.yml.example`; rename it to `.github/workflows/pages.yml` and set
Pages to "GitHub Actions" if your token also has the `workflow` scope.

The app is a pure static bundle with relative asset URLs, so the same `dist/` folder
also runs from any other free static host, a local file share or a USB stick.

### The visual how-to-use guide

`guide/how-to-use.html` is a **single self-contained HTML presentation** — all 11 screen
captures are embedded as data URIs, so it works from a file share or a USB stick with no
server and no external assets. It is also published as `guide.html` alongside the app and
linked from the app footer. To refresh the screenshots after a UI change (needs
`pip install pillow` for the build step):

```bash
node qa-artifacts/capture-guide.mjs   # CDP walkthrough → qa-artifacts/guide-screens/*.png
python qa-artifacts/build-guide.py    # → guide/how-to-use.html + public/guide.html
npm run deploy:pages                  # publishes the app and the guide together
```

The Windows builds are attached to the GitHub Release, not committed to the repository.
Both are unsigned (no code-signing certificate, no payment, no account involved), so
Windows SmartScreen may show an "unknown publisher" warning on first run — choose
**More info → Run anyway**, or use the portable build.

---

## 100% free — no keys, no accounts, no payment, no ads, no tracking

- **No API keys, tokens, secrets, or environment variables.** There is nothing to sign up for.
- **No accounts, no login, no cloud profile, no sync.** Only `localStorage` on your own device.
- **No payment, no trial, no "pro" tier, no paywall, no ads, no sponsored placements.**
- **No analytics, telemetry, crash reporting, or third-party tracking.**
- **No vendor lock-in.** The build is a pure static folder (`dist/`) that can be served from
  any free static host, copied to a USB stick, or opened from a local file share.
- `src/config/endpoints.ts` is the single network allowlist. `src/api/http.ts` calls
  `assertAllowed(url)` before **every** fetch. Only the hosts below can ever be contacted.
- The root `npm install` / `npm run dev` / `npm run build` never need Electron. The optional
  Electron wrapper lives in `desktop/` with its own `package.json`.

---

## Quick start

Requires **Node >= 20.19** (Node 22 LTS recommended, see `.nvmrc`).

```bash
npm install          # install dependencies (registry is reachable)
npm run dev          # start the Vite dev server, open the printed localhost URL
npm run build        # type-check + produce a pure static dist/ folder
npm run preview      # preview the built static app
npm test             # run the offline Vitest suite (127 tests, no network, no browser)
npm run verify:live  # OPTIONAL: check the real keyless data sources over the internet
```

`npm run build` runs `tsc --noEmit -p tsconfig.json && vite build`. The output is a static
site with relative asset URLs, so it also works when opened through the Electron shell.
`npm run typecheck` runs the type-check alone.

The Vitest suite (`npm test`, 13 files / 127 tests) runs fully offline with no browser and
no network: pure calendar + unit conversion, the eight-host allowlist and `assertAllowed`
guard, `fetchJson` failure modes, the 38-crop database, weighted scoring and tie-breaks,
SoilGrids `mean: null` handling, profile merge, the full offline recommendation for all
12 months, 3-season rotation hard rules, five comparable strategies, static compliance
gates (no forbidden hosts / keys / TODOs / domain impurity), and server-side rendering of
the app shell plus **every screen** with real offline data.

`npm run verify:live` is an **opt-in, network-enabled** smoke test (5 tests). It is skipped by
`npm test`, so the default suite stays 100% offline. It imports the application's *real* URL
builders and *real* normalisers, calls each keyless endpoint over the internet, and asserts
the live payloads parse into the same `SiteConditions` shapes the UI consumes — including
the critical `PRECTOTCORR` mm/day → monthly-mm conversion. Optional/flaky sources
(SoilGrids, Nominatim, archive, GIBS, OSM tiles) are reported but never fail the gate.
No key, token or account is used.

**PWA assets:** `public/manifest.webmanifest` + hand-written `public/sw.js`, with SVG icons
and generated `icon-192.png` / `icon-512.png` install icons. The service worker is
best-effort only — bundled sample data already guarantees full offline behaviour, so a
failed registration never breaks the app.

**Try it with no network at all:** on the welcome screen tap **"Use a sample field (offline)"**.
The app immediately produces a complete recommendation, rotation plan and strategy comparison
from bundled sample payloads, badged **"Offline sample data"** with every factor flagged as
estimated. You can also just disable your network after loading the page — every source has a
timeout and degrades independently. Every displayed value still carries its own source,
freshness and estimated badge, and the **Data & sources** screen lists every source with a
retry action.

---

## Data sources, licences and attribution

All runtime sources are keyless and return `Access-Control-Allow-Origin: *`. Attribution is
also shown **in the app** on the "Data & sources" screen, in the footer and on every
`SourceLabel`.

| Source | What it contributes | Endpoint (host) | Licence / attribution |
|---|---|---|---|
| **NASA POWER** | Long-term monthly climate (temperature, rainfall, humidity, solar radiation, wind, root/top soil wetness), site elevation | `power.larc.nasa.gov` | NASA, public domain / open use. *"Data: NASA POWER / NASA Langley Research Center (public domain / open use)"* |
| **NASA GIBS (EOSDIS)** | Optional true-colour satellite imagery overlay on the map, off by default | `gibs.earthdata.nasa.gov` | NASA EOSDIS. *"Imagery: NASA EOSDIS GIBS"* |
| **Open-Meteo forecast** | Current temperature / humidity / precipitation / surface soil moisture, 16-day forecast, FAO ET0, shortwave radiation, `timezone=auto`, elevation | `api.open-meteo.com` | **CC BY 4.0**. *"Weather data by Open-Meteo.com (CC BY 4.0)"* |
| **Open-Meteo archive** | Optional 5-year rainfall reliability context | `archive-api.open-meteo.com` | **CC BY 4.0**. *"Weather data by Open-Meteo.com (CC BY 4.0)"* |
| **Open-Meteo geocoding** | Village / town name to coordinates | `geocoding-api.open-meteo.com` | **CC BY 4.0**. *"Weather data by Open-Meteo.com (CC BY 4.0)"* |
| **ISRIC SoilGrids v2** | *Optional* soil pH / texture / organic carbon pre-fill | `rest.isric.org` | **CC BY 4.0**. *"Soil data: ISRIC SoilGrids v2 (CC BY 4.0)"* |
| **Nominatim / OpenStreetMap** | Human-readable place and admin context (reverse geocode) | `nominatim.openstreetmap.org` | **ODbL**. *"© OpenStreetMap contributors (ODbL)"*, *"Place names: Nominatim / OpenStreetMap (ODbL)"* |
| **OpenStreetMap raster tiles** | Map background | `tile.openstreetmap.org` | **ODbL**. *"© OpenStreetMap contributors (ODbL)"* |
| **Bundled static assets** | 38-crop curated database, sample API payloads, licences, sample location | in-repo, no network | *"Crop requirement ranges: literature-based heuristics (EcoCrop / FAO GAEZ-style), decision support only."* |

**Verified request shapes** (from `docs/00-research-brief.md`):

- NASA POWER climatology:
  `https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=T2M,T2M_MAX,T2M_MIN,PRECTOTCORR,RH2M,ALLSKY_SFC_SW_DWN,WS10M,GWETROOT,GWETTOP&community=AG&longitude={lon}&latitude={lat}&format=JSON`
  → `properties.parameter.{PARAM}.{JAN..DEC,ANN}`. `T2M*` in °C, `RH2M` in %,
  `PRECTOTCORR` in **mm/day**, `GWETROOT`/`GWETTOP` 0–1 relative wetness,
  `ALLSKY_SFC_SW_DWN` in MJ/m²/day. Geometry carries elevation in metres.
- Open-Meteo forecast:
  `https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,precipitation,soil_moisture_0_to_1cm&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,et0_fao_evapotranspiration,shortwave_radiation_sum&forecast_days=16&timezone=auto`
- Open-Meteo archive:
  `https://archive-api.open-meteo.com/v1/archive?...&start_date=...&end_date=...&daily=precipitation_sum,temperature_2m_mean&timezone=auto`
- Geocoding: `https://geocoding-api.open-meteo.com/v1/search?name={q}&count=5&language=en&format=json`
- SoilGrids:
  `https://rest.isric.org/soilgrids/v2.0/properties/query?lon={lon}&lat={lat}&property=phh2o&property=clay&property=sand&property=silt&property=soc&property=nitrogen&property=cec&depth=0-5cm&value=mean`
  → `layers[].unit_measure.d_factor` divides the mapped integer. Flaky: 8-second hard
  `AbortController` timeout, coordinate-rounded cache, `mean: null` treated as no-data,
  **never blocks a recommendation**.
- Nominatim reverse: `https://nominatim.openstreetmap.org/reverse?lat={lat}&lon={lon}&format=json&zoom=10`
- NASA GIBS tile:
  `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/{YYYY-MM-DD}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`
  (also `VIIRS_SNPP_CorrectedReflectance_TrueColor`). No NDVI/EVI layer is shipped.
- OSM basemap: `https://tile.openstreetmap.org/{z}/{x}/{y}.png`

**Inspiration only, never called at runtime:** SMAP, GPM/IMERG, Landsat, MODIS/VIIRS,
SRTM, ECOSTRESS, NLDAS/GLDAS, GEDI, Sentinel-2 (ESA), ERA5 (ECMWF), FAO GAEZ, and the
US-only complementary datasets (USDA Ag Data Commons, Web Soil Survey, CropScape CDL,
PRISM, SSURGO/STATSGO2, NAIP, NLCD, CoCoRaHS, USGS NWIS, USDA AMS/NASS, OpenET, LANDFIRE).
Most require Earthdata Login, API keys or bulk-download workflows; that would break the
keyless, account-free promise. NASA POWER already exposes MERRA-2/GLDAS-derived
agro-meteorology including soil wetness, and NASA GIBS supplies imagery without a login.
No OSM land-use query service is used for surroundings — those come from the farmer's
form, reverse geocoding, Open-Meteo elevation and the optional GIBS layer.

---

## Architecture overview

Layered, unidirectional, mostly functional. No backend, no database, no server.

```
UI (src/screens/*, src/components/*)            pure render of AppState
   ↕ dispatch / selectors
State (src/state/*: useReducer + Context)        one session object, localStorage only
   ↓  calls with a normalised object
Domain engine (src/domain/*)                     PURE: scoring, ranking, rotation, strategies
   ↑  reads
SiteConditions (src/types/domain.ts)             normalised, immutable per session
   ↑  produced by
Normalisation (src/normalize/*)                  units, month mapping, profile merge
   ↑  fed by
API orchestrator (src/api/orchestrator.ts)       parallel fetch, timeouts, cache, degradation
   ↑  via
fetchJson + assertAllowed (src/api/http.ts)      native fetch + AbortController
```

- `src/config/endpoints.ts` — **single network allowlist** and all URL builders.
- `src/types/*` — all domain, provenance and UI contracts.
- `src/data/crops.json` — 38 curated crops; `src/data/sample/*` — realistic tropical
  sample payloads (Central Java, -7.55 / 110.42) for the offline guarantee.
- `src/api/*` — one adapter per source, `Promise.allSettled`, per-source timeouts,
  coordinate-rounded TTL cache, provenance assembled at fetch time.
- `src/domain/*` — **pure, deterministic, network-free**: no `fetch`, no `Date.now()`,
  no `Math.random()`. `targetMonth` and `lang` are arguments. This is why the tests run
  fully offline.
- `src/i18n/*` — ~2 KB dictionary lookup (`t(lang, key, params)`), English baseline plus
  Bahasa Indonesia, no language gate before first use.
- `src/components/*` — hand-written SVG score ring and climate/forecast charts, plain CSS
  custom properties. **No MUI, no Tailwind, no chart library.** Leaflet is the only runtime
  dependency beyond React and is dynamically imported on map screens only, with a
  solid-colour + draggable-pin fallback.
- `public/sw.js` + `public/manifest.webmanifest` — hand-written PWA service worker and
  manifest. No Workbox, no PWA plugin.

---

## How scoring works

Seven weighted factors, published in the app's "Scoring method" panel:

| ID | Factor | Weight |
|---|---|---|
| F1 | Temperature fit | 20 |
| F2 | Water fit | 20 |
| F3 | Soil fit | 15 |
| F4 | Season / planting window | 15 |
| F5 | Terrain & erosion | 10 |
| F6 | Surroundings & field context | 10 |
| F7 | Rotation continuity | 10 |

Each factor returns a trapezoidal membership score (0–100), a plain-language reason, a
source, a freshness label and an `isEstimated` flag. The weighted sum is rounded to an
integer 0–100. Verdict: `Good fit` >= 75, `Worth considering` >= 50, else `Poor fit`.
Tie-break: score desc → confidence desc → completeness desc → cropId asc.

**Confidence is separate from the score.** It drops when a factor is estimated or
self-reported, when a source failed and a fallback was used, when the location is a coarse
geocode, when the score is near a verdict boundary, when the previous crop is unknown, or
when running on bundled sample data. Missing data **lowers confidence, never blocks** a
recommendation. A score of 100 is never presented as certainty.

**Units:** `PRECTOTCORR` climatology is mm/**day** → multiply by days-in-month to get
monthly mm (fixed 28 for February on a long-term average). `JAN..DEC` map to 1..12
(1 = January); `ANN` is stored separately and never treated as a month. `Date.getMonth()`
is 0-based and always converted with `+1`. Displayed temperatures are whole °C, rainfall
whole mm, scores integers; soil wetness is shown as dry / moist / wet with the raw value
available on tap. Climatology is always labelled "long-term monthly average", forecasts
"forecast", and current conditions carry a timestamp.

## How rotation works

Exactly three seasons, each a broad ~4-month block from the current month (`M`, `M+4`,
`M+8`). Season 1 is the recommended crop. The previous crop is season 0; if unknown the
planner assumes a neutral, non-legume, medium-root start **and says so**.

An exhaustive DFS over candidate crop pairs keeps only sequences satisfying the hard rules:

1. **Family avoidance** — no two consecutive seasons share a botanical family.
2. **Nitrogen-role sequencing** — never two heavy feeders back-to-back; prefer
   legume → heavy feeder → light feeder.
3. **Root-depth alternation** — never two deep or two shallow in a row.
4. **Disease break** — a shared `diseaseGroups[]` entry at distance 1 is a hard reject;
   at distance 2 it becomes a plain-language caution.
5. **Season fit** — chosen crops must have a planting window overlapping their target
   month; fit below `MIN_SEASON_FIT` (45) is flagged in `cautions[]`, not hidden.
6. **Previous-crop continuity** — never fabricate history.

Future seasons use POWER monthly climatology (`JAN..DEC`), **never** the 16-day forecast.
Every transition carries a plain-language reason naming the rule it satisfies; seasons 2–3
are marked "Tentative — check conditions again before planting." If no combination satisfies
every hard rule, the planner returns the closest honest option with `noConfidentMatch: true`
and the exact note *"No fully confident rotation match for this field — this is the closest
option, and here is what is weak about it."* It never silently breaks a rule.

`src/domain/strategies.ts` wraps that plan into **five** comparable strategies (existing,
balanced, soil-restoring, water-saving, quick-income), each with evidence referencing a
source + freshness, benefits, information gaps, risks needing local review, vulnerable
seasons and a comparable metric set (soil health, water demand, nitrogen balance, bare-field
weeks, rule violations, average fit score). The "existing" strategy is explicitly flagged as
inferred: *"We only know your last crop; the rest of your usual rotation was inferred."*

---

## Windows desktop `.exe` (optional, already built)

**Ready-to-run binaries are in `serumpun/release/`:**

| File | Size | What it does |
|---|---|---|
| `Serumpun-Portable.exe` | ~90 MB | **Single file, no installation.** Double-click to run. Ideal for a USB stick or a shared office PC. |
| `Serumpun-Setup-1.0.0.exe` | ~97 MB | NSIS installer with a desktop shortcut and an uninstaller. |

Both were built with Electron 38.8.6 + electron-builder 26.18.0 and **tested by launching
them and driving the full flow through DevTools** (see `docs/04-qa-report.md` §9). They are
unsigned, so Windows SmartScreen may show "unknown publisher" on first run — choose
**More info → Run anyway**. No certificate, account or payment is involved.

To rebuild them:

```bash
# from the project root
npm install && npm run build
cp -r dist/. desktop/web/        # Windows: xcopy /E /I dist desktop\web
cd desktop
npm install
npm run dist                    # electron-builder --win --x64
# artifacts land in ../release/
```

`desktop/` has its own `package.json` (Electron and electron-builder are devDependencies
there only), its own `node_modules`, and never contaminates the root build. The static web
build is bundled inside the executable as `web/`.

**Why a tiny local server:** Vite emits `<script type="module">`, which Chromium blocks on a
`file://` origin. `desktop/main.js` serves the bundled `web/` folder over a loopback-only
HTTP server bound to `127.0.0.1` on an OS-assigned ephemeral port, then loads
`http://127.0.0.1:<port>/index.html`. No backend, no external port, no database, no keys.
Security stays `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. See
`desktop/README.md`.

> Note for terminal launches from inside an Electron-based IDE: if `ELECTRON_RUN_AS_NODE=1`
> is set in the shell environment, unset it first (`env -u ELECTRON_RUN_AS_NODE`), otherwise
> the Electron binary runs as plain Node. Double-clicking from Explorer is unaffected.

---

## Limitations and decision-support disclaimer

> **This is decision support based on regional climate data and general crop requirements,
> not agronomic advice for your field. Check with a local extension officer before committing
> your season.**

- Crop requirement ranges are **literature-based heuristics** (EcoCrop / FAO GAEZ-style),
  not locally calibrated and not reviewed by an agronomist for this build.
- NASA POWER is a ~0.5° grid and Open-Meteo ~1–11 km; a 0.4 ha plot has its own
  microclimate. All grid-scale data is labelled **"regional estimate, not a measurement at
  your field"**. User answers (irrigation, shade, slope, soil, history) are overrides, not
  ground truth.
- SoilGrids is a ~250 m modelled raster, frequently returns `mean: null`, and is always
  labelled **estimated**. A manual soil picker is the fallback, labelled **self-reported**.
- No yield prediction, no guaranteed harvest, no price / market / profit advice, no
  fertiliser, pesticide or chemical prescriptions.
- The device clock is assumed correct; the resolved month is shown prominently so a wrong
  clock is visible. A month override lets you explore adjacent months.
- Three "seasons" are broad 4-month blocks, not a locale-specific monsoon calendar.
- No local soil test, no local pest history, no local market data. These appear as explicit
  information gaps on the strategy comparison screen.
- English is the baseline; Bahasa Indonesia is provided as a secondary dictionary. The
  scientific text is deliberately plain-language, not a substitute for local expertise.

---

## Offline behaviour

- Bundled sample payloads in `src/data/sample/` make a **first-run, zero-network** session
  fully functional: complete recommendation, 3-season rotation and >=3 strategies, badged
  **"Offline sample data"** with every factor `isEstimated: true`.
- Every source has its own `AbortController` timeout (POWER 10 s, forecast / geocoding 8 s,
  SoilGrids 8 s hard, GIBS 6 s, Nominatim 6 s). `Promise.allSettled` isolates failures.
- One failing source never blanks the screen: affected factors become "estimated" and the
  banner shows **Partly estimated**. Stale cache is served with a `cached` provenance label.
- The app never shows `NaN`, a blank value or an endless spinner — failures read
  "Not available right now" / "Some data is estimated".
- `public/sw.js` caches the app shell and the last successful API responses (network-first
  for APIs), so repeat visits work offline even beyond the bundled sample.

---

## Project documents

- `docs/00-research-brief.md` — verified live endpoints, licences, Mobbin UI references.
- `docs/01-prd.md` — product requirements.
- `docs/02-architecture.md` — system design and task breakdown.
- `docs/03-code-summary.md` — implementation handoff notes.
- `docs/04-qa-report.md` — QA report.
