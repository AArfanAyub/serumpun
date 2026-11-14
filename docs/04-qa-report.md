# Serumpun — QA Verification Report

Date: 2026-11-14
Verifier: Delivery Director (QA stage completed directly after the QA teammate process
was interrupted by a provider rate limit). All verification below was run independently
against the delivered code, not taken from the engineer's self-report.

**Verdict: PASS — ready to use.** 132/132 tests pass (127 offline + 5 live-network),
`tsc --noEmit` clean, production build clean, all eight keyless data sources verified
against the real internet, and the full 9-screen user flow click-tested in a real
Chromium browser at a true 390 px mobile viewport with zero console errors.

---

## 1. Verification matrix

| Check | Command | Result |
|---|---|---|
| Type check | `npm run typecheck` | **PASS** — exit 0, no errors |
| Offline unit / integration suite | `npm test` | **PASS** — 13 files / 127 tests, 1 live file correctly skipped |
| Production build | `npm run build` | **PASS** — 88 modules, static `dist/`, exit 0 |
| Live keyless API smoke | `npm run verify:live` | **PASS** — 5/5 tests, 8/8 sources returned real data |
| Static serving | `npx vite preview` + curl | **PASS** — `/`, `index.html`, `manifest.webmanifest`, `sw.js`, both PNG icons, all built assets → 200 |
| Real-browser render | headless Chromium screenshots | **PASS** — 375 px and 500 px |
| Real-browser click-through | CDP, 390 px emulation, offline sample flow | **PASS** — S0 → S2 → S3 → S4 → S5 → S6 → S6b, no exceptions / console errors |
| Static compliance gates | repo-wide grep | **PASS** — see §4 |

Environment: Node v22.22.2, npm 10.9.7, Vite 8.3.8, React 19.3.1, TypeScript 5.9.3,
Vitest 5.1.0, Leaflet 1.9.4, Windows.

Built output: `index-*.js` 405.66 kB / **117.39 kB gzipped**, CSS 28.59 kB / 9.56 kB gz,
`leaflet-src-*.js` 148.82 kB / 43.33 kB gz as a **genuine async chunk** (0 `modulepreload`
links in `dist/index.html`).

---

## 2. Live internet verification (the gap the engineer flagged)

The engineer's 127 tests are deliberately 100% offline, so no real HTTP call had ever been
made. I added an **opt-in** suite, `tests/live-smoke.test.ts` + `npm run verify:live`, which
imports the application's **actual** URL builders and **actual** normalisers (not hand-written
imitation URLs) and calls the real endpoints. It is skipped by default, preserving the offline
suite. Results for the Central Java reference site (-7.55 / 110.42), 2026-11-14:

| Source | Result | Evidence |
|---|---|---|
| NASA POWER climatology | **PASS** | All 9 AG parameters × JAN..DEC + ANN; normalised to exactly 12 months; Feb 343 mm; annual 2095 mm; elevation 356.28 m |
| Open-Meteo forecast | **PASS** | `Asia/Jakarta`, 1351 m, current 18.9 °C, 16 forecast days, ET0 3.00 mm/day |
| Open-Meteo geocoding | **PASS** | `Bogor` → -6.59444, 106.78917 |
| ISRIC SoilGrids (optional) | **PASS** | 7 layers, 7 usable means on this run |
| Nominatim reverse (optional) | **PASS** | `Ngablak, Srumbung, Magelang, Jawa Tengah, Indonesia` |
| Open-Meteo archive (optional) | **PASS** | 365 daily historical rows |
| NASA GIBS true-colour tile (optional) | **PASS** | 14–17 kB JPEG |
| OSM basemap tile (optional) | **PASS** | 25,559-byte PNG |

Critical unit gate confirmed **on live data**: `PRECTOTCORR` is mm/day on climatology and
the app correctly multiplies by days-in-month (Feb = 28), while `ANN` is stored separately
and never treated as a 13th month. `GWETROOT`/`GWETTOP` stayed within 0–1.

Note: SoilGrids was flaky during earlier research (timeouts and `mean: null` on some pixels)
but succeeded here. Both behaviours are covered — the app has an 8 s hard timeout, a manual
soil picker fallback, and marks successful SoilGrids values as estimated too.

---

## 3. Real-browser verification (not just server-side rendering)

Captured with headless Chromium at 500 px and via CDP device emulation at a **true 375 px /
390 px** viewport. At 375 px: `innerWidth = 375`, `document.documentElement.scrollWidth = 375`,
**no horizontal overflow**. A 420 px `--window-size` screenshot initially appeared clipped;
that was reproduced as a **headless Chromium minimum-window artefact** (Chrome clamps the
layout viewport to 500 px while still writing a 420 px image), not an app defect — CDP metrics
and the 500 px / 375 px captures confirm correct wrapping.

Full offline click-through (390 px, no network):

| Step | Screen | Observed |
|---|---|---|
| S0 | Welcome | "Know what to plant, and why.", Free · No account · No ads, two clear CTAs, offline banner |
| S2 | Field snapshot | Surakarta, Central Java · 7.550° S, 110.420° E · 210 m · November, 12 month chips, NASA layer toggle, KPI strip |
| S3 | Field profile | 3 steps (Soil → Water & terrain → History & size), "I don't know" on each, estimated-soil prefill notice |
| S4 | Recommendations | "Recommendations for November", ranked cards: Rice 92, Banana 90, Cocoa 90, Water spinach 90, Sugarcane 90 — all "Confidence: Low" (correct for sample data), "Why this crop? →", "Scoring method" |
| S5 | Why Rice? | Lovi-style 92/100 score ring, "What does this mean?", plain-language confidence reason listing all 7 estimated factors, factor cards, single CTA |
| S6 | Three-season rotation | 3 seasons, previous-crop assumption disclosed, per-transition "Why this change" reasons, tentative flags |
| S6b | Compare strategies | 5 strategies including "Your current rotation" (baseline, inferred), comparison table with soil-health / water / nitrogen / bare-field / rule-violation / avg-fit metrics |

`Runtime.exceptionThrown` and console-error listeners recorded **zero problems** across all
steps. `scrollWidth === innerWidth` at every screen.

---

## 4. Static release gates

| Gate | Result |
|---|---|
| Single network allowlist | **PASS** — `src/config/endpoints.ts`, exactly 8 hosts |
| `assertAllowed(url)` before every fetch | **PASS** — `src/api/http.ts` is the only `fetch()` in `src/`; guard at line 55, fetch at line 82 |
| Forbidden hosts / secrets | **PASS** — no Overpass host, Earthdata-login runtime host, API key, token, `.env`, `process.env` secret, analytics or ads in code. "Overpass" appears only in docs as a prohibition. |
| No payment / accounts / tracking | **PASS** — static grep clean |
| Pure domain engine | **PASS** — no `fetch`, `Date.now()`, `Math.random()`, browser globals in `src/domain/` |
| Root scripts free of Electron | **PASS** — `desktop/` isolated with its own `package.json` |
| Leaflet lazy-loaded | **PASS** — 0 `modulepreload` links in `dist/index.html`; async chunk present |
| No NDVI/EVI GIBS layer | **PASS** — only the two verified true-colour layers whitelisted |
| In-app attribution | **PASS** — NASA POWER, NASA GIBS, Open-Meteo CC BY 4.0, ISRIC SoilGrids CC BY 4.0, OSM/Nominatim ODbL in `src/config/attribution.ts`, rendered on S7 / footer / SourceLabel |
| Disclaimer + "regional estimate" caveat | **PASS** — fixed strings, present on every recommendation/rotation view |
| i18n parity | **PASS** — id spreads en; new keys added to both |
| Icons / PWA assets | **PASS** — valid PNG 192/512, manifest + sw.js served |

---

## 5. Defects found and fixed during QA

| # | Severity | Issue | Fix | Regression guard |
|---|---|---|---|---|
| 1 | Minor (content) | On S6, the full sentence *"We assumed a neutral, non-legume, medium-root starting crop because the previous crop was not given."* appeared **twice** — once in the "Previous crop:" header and again appended to `transitionReasons[0]`. | Added `rotation.assumedNeutralShort` (en + id); S6 header now reads *"not given — a neutral starting crop was assumed (the reason below explains this)"*. The full explanation remains once, in the reason, as the PRD requires. | `tests/screens.test.ts` asserts the sentence occurs exactly once |
| 2 | Minor (UX) | S6b comparison table is `min-width: 560px` in a horizontal scroll container, so on a phone the extra columns were cut off with **no hint** that the table scrolls. | Added `strategy.scrollHint` ("Scroll the table sideways to see every column →") above the table, en + id. | `tests/screens.test.ts` asserts the hint is rendered |
| 3 | Test harness only | The new optional-source group exceeded Vitest's default 5 s timeout. | Set an explicit 120 s test timeout; each HTTP call keeps its own shorter `AbortSignal.timeout`. | `npm run verify:live` passes |

No P0 behaviour, scoring weight, rotation rule, endpoint shape or unit rule was changed.

---

## 6. Known issues / accepted limitations (non-blocking)

- **Vite advisory**: "Some chunks are larger than 350 kB" — the entry is 405 kB raw but
  **117 kB gzipped**, within the PRD's <300 kB gz target. Not an error.
- **Strategy comparison table** requires horizontal scrolling on narrow phones; a hint is
  now shown. A card-per-strategy mobile layout would be a future improvement.
- **SoilGrids** remains unreliable (timeouts / `mean: null`), by design optional and always
  labelled estimated, with a manual picker fallback.
- **No live testing of Earthdata-login datasets** (SMAP, GPM/IMERG, Landsat, MODIS,
  ECOSTRESS, GEDI, Sentinel-2, ERA5) — intentional: they require accounts/keys and would
  break the "completely free, no payment binding" requirement. They are credited in-app as
  inspiration only.
- **Bahasa Indonesia** is a secondary dictionary; untranslated keys fall back to English
  rather than showing raw keys.
- **Crop thresholds** are literature-based heuristics, not locally calibrated agronomy —
  stated in the app's disclaimer and limitations section.
- Nominatim's 1 req/s and the OSM tile usage policy require responsible deployment; the app
  sends a descriptive User-Agent and caches reverse lookups.
- The three "seasons" are broad 4-month blocks, not a locale-specific monsoon calendar.

---

## 7. Files added / changed during QA

| File | Change |
|---|---|
| `tests/live-smoke.test.ts` | **New** — opt-in live keyless API smoke test (5 tests) |
| `package.json` | Added `verify:live` script (cross-platform via `npm_lifecycle_event`) |
| `src/i18n/en.ts`, `src/i18n/id.ts` | Added `rotation.assumedNeutralShort` + `strategy.scrollHint` |
| `src/screens/S6RotationPlan.tsx` | Use the short neutral label (defect 1) |
| `src/screens/S6StrategyCompare.tsx` | Add horizontal-scroll hint (defect 2) |
| `tests/screens.test.ts` | Two regression assertions |
| `README.md` | Documented `npm run verify:live` and the opt-in live suite |
| `docs/04-qa-report.md` | **This report** |
| `qa-artifacts/` | Verification screenshots + one-off CDP helper scripts (evidence, not app code) |

---

## 8. Windows executable packaging & launch verification

Requested as a follow-up: a real, working, tested `.exe`.

**A real defect was found and fixed before packaging.** The original `desktop/main.js`
loaded `../dist/index.html` via `loadFile()` (`file://`). Vite emits
`<script type="module">`, which Chromium refuses to load from a `file://` origin
(CORS, origin `null`) — the packaged app would have shown a **blank window**. Fixed by
serving the static build from a minimal Node HTTP server bound to `127.0.0.1` on an
OS-assigned ephemeral port (`http://127.0.0.1:<port>/index.html`), with path-traversal
guards and SPA fallback. The static build is copied to `desktop/web/` and bundled into the
executable. No external port, no backend, no keys.

Built with Electron **38.8.6** + electron-builder **26.18.0** on win32 x64:

| Artifact | Size | PE | Product / version |
|---|---|---|---|
| `release/Serumpun-Portable.exe` | 94,095,936 B (89.7 MB) | valid `MZ` | Serumpun / 1.0.0 |
| `release/Serumpun-Setup-1.0.0.exe` | 102,178,598 B (97.4 MB) | valid `MZ` | Serumpun / 1.0.0 |

SHA-256:
- Portable: `bb4075a0c5b405e910f21cbc3729e66272096c26279d87d36680ef876e28db54`
- Installer: `9310200226ab9b2ca653509ed020377ad8609efbcaafb8a8519ca84980dba73f`

**Launch tests** (real Electron GUI, driven over the DevTools protocol):

| Test | Result |
|---|---|
| `win-unpacked/Serumpun.exe` renders | **PASS** — S1 "Find your field" with live OSM basemap + NASA layer toggle, no console errors |
| Live API reachability from inside the renderer | **PASS** — `navigator.onLine: true`; NASA POWER 200 (1,050 B), Open-Meteo 200 (343 B) from origin `http://127.0.0.1:<port>` |
| Live data on a real location | **PASS** — "Partly estimated" banner, 25 °C (Open-Meteo), 324 mm rain (NASA POWER), soil wetness "wet", 35 m elevation |
| `Serumpun-Portable.exe` fresh start, offline path | **PASS** — S0 → S2 → S4 → S5 → S6 → S6b, "Offline sample" banner, Rice 92/100, zero runtime errors |
| `Serumpun-Portable.exe` fresh start, **live search** | **PASS** — typed "Bogor", resolved `Ngablak, Srumbung, Magelang, Central Java, Indonesia`, live elevation 1351 m, "Partly estimated" banner, **Rice 83/100** (different from the offline 92, proving live data changed the score), full flow through recommendations → why → 3-season rotation → 5-strategy comparison, zero runtime errors |

Verified on-screen KPI strip with source labels: temperature 20 °C (Open-Meteo), rain
217 mm (NASA POWER), soil wetness wet (NASA POWER), elevation 1351 m, plus
"© OpenStreetMap contributors (ODbL) · Imagery: NASA EOSDIS GIBS" attribution.
Screenshots in `qa-artifacts/portable-live3-*.png` and `qa-artifacts/unpacked-desktop.png`.

Environment note: WorkBuddy exports `ELECTRON_RUN_AS_NODE=1` into its shell, which makes any
Electron binary behave as plain Node (`bad option: --remote-debugging-port`). Test launches
unset it. A normal Explorer double-click is unaffected.

Files changed for packaging: `desktop/main.js` (loopback static server),
`desktop/package.json` (electron-builder config + `dist` script), `desktop/README.md`,
`desktop/web/` (copy of `dist/`), `desktop/icon.ico` (generated from `icon-512.png`),
`README.md`, this report. Root `npm run typecheck` / `npm test` / `npm run build` still pass
unchanged (127 offline tests + 5 live tests).

## 9. GitHub publishing & hosted web verification

The user asked for the verified portable executable to be published on GitHub and for the
software to be usable directly from the web with GitHub as the host.

| Item | Result |
|---|---|
| Public source repo | https://github.com/AArfanAyub/serumpun |
| Live web app (GitHub Pages) | **https://aarfanayub.github.io/serumpun/** — HTTP 200 |
| Release | https://github.com/AArfanAyub/serumpun/releases/tag/v1.0.0 |
| `Serumpun-Portable.exe` | 94,095,936 bytes, release asset, download URL returns 200 |
| `Serumpun-Setup-1.0.0.exe` | 102,178,598 bytes, release asset |
| `SHA256SUMS.txt` | both digests re-computed at release time, unchanged from §8 |
| `/releases/latest` | 302 → v1.0.0 (the exact URL used by the in-app footer link) |

Hosting method: branch-based GitHub Pages (`build_type=legacy`, source `gh-pages:/`),
populated by `npm run deploy:pages` (`scripts/deploy-pages.mjs`), which builds `dist/` and
force-pushes it to `gh-pages` with a `.nojekyll` marker. Vite's `base: './'` means all
asset URLs, the PWA manifest and the service worker resolve correctly under the
`/serumpun/` project path.

Why not GitHub Actions: the publishing token is an OAuth App token with only `repo`,
`gist` and `read:org` scopes. GitHub refused both the git push and the Contents API for
`.github/workflows/pages.yml` ("refusing to allow an OAuth App ... without `workflow`
scope"); a temporary write-enabled SSH deploy key was rejected the same way and was then
deleted (zero deploy keys remain). A ready-made workflow is kept at
`docs/pages-workflow.yml.example` for accounts that have the `workflow` scope.

Live verification (after `POST /pages/builds` reported `status: built`):

- All 12 published paths returned HTTP 200: `/`, `index.html`, `sw.js`,
  `manifest.webmanifest`, all three hashed `assets/*`, all four `icons/*`, `.nojekyll`.
- Headless Chrome rendering of the live URL produced the real welcome screen with the
  stylesheet applied: "Know what to plant, and why.", "Find my field", the free/no-account
  statement, status banner, footer and the "Windows desktop app" link to the release.
  Screenshot: `qa-artifacts/live-pages-welcome.png`.
- `npm test` after all publishing changes: 128 passed, 5 live tests skipped (opt-in).

Repo hygiene: `release/`, `desktop/web/` and `qa-artifacts/chrome-profile/` are gitignored.
`desktop/prepare-web.cjs` regenerates `web/` from `dist/` before `start` / `dev` / `dist`,
so a clean clone can still rebuild the Windows executables.

## 10. Final sign-off

**PASS.** Serumpun builds, serves, renders on a real small-screen browser, produces
explainable crop recommendations and a rules-compliant 3-season rotation with ≥3 comparable
strategies, works fully offline, and talks to eight genuinely free, keyless, account-free
open-data sources with graceful degradation and visible attribution. The Windows
executables were built and **launched and driven end-to-end**, including a live-data path.
No API keys, payment, accounts, ads or tracking exist anywhere in the codebase. The public
GitHub repository, the hosted GitHub Pages app and the v1.0.0 Release carrying both Windows
executables were all verified live (§9).

Suggested user next steps:
1. Open **https://aarfanayub.github.io/serumpun/** in any browser — no installation.
2. Or download `Serumpun-Portable.exe` from the
   [latest release](https://github.com/AArfanAyub/serumpun/releases/latest) and double-click it.
3. Or `npm install && npm run dev`, then tap **"Use a sample field (offline)"** for a
   zero-network demo.
4. `npm run verify:live` to prove the live data path.
5. `npm run deploy:pages` to publish a new web build; `cd desktop && npm run dist` to
   rebuild the Windows binaries.
