# Serumpun — Code Summary (Kou / Engineer, Task #3)

**Status: implemented, builds, runs, and tested.** `IS_PASS: YES`.

This document is the implementation handoff for QA. It records what was built, the
verification evidence, key design decisions, and the (small, documented) deviations
from `docs/02-architecture.md`.

---

## 1. Verification evidence

Run from the project root (`C:/Users/user/WorkBuddy AI/2026-11-13-23-45-57/serumpun/`):

| Command | Result |
|---|---|
| `npm install` | Clean tree, `package-lock.json` generated, `0 vulnerabilities` |
| `npm prune` | Removed 2 transient extraneous packages; `npm ls --depth=0` now shows exactly 11 declared packages |
| `npm run typecheck` (`tsc --noEmit -p tsconfig.json`) | **Exit 0**, no errors |
| `npm test` (`vitest run`) | **13 files / 127 tests passed** |
| `npm run build` (`tsc --noEmit && vite build`) | **Exit 0**, 88 modules, static `dist/` produced |
| `npx vite preview` + HTTP checks | `/`, `/index.html`, `/manifest.webmanifest`, `/sw.js`, `/icons/icon-192.png`, `/icons/icon-512.png` all return **200**; every built asset reference resolves on disk |

Environment: Node `v22.22.2`, npm `10.9.7`, Vite `8.3.8`, React `19.3.1`,
TypeScript `5.9.3`, Vitest `5.1.0`, Leaflet `1.9.4`.

Built output:

```
dist/index.html                        1.06 kB
dist/assets/index-*.css               28.59 kB  (gzip 9.56)
dist/assets/index-*.js               405.17 kB  (gzip 117.22)
dist/assets/leaflet-src-*.js         148.82 kB  (gzip 43.33)  <- lazy, async chunk
dist/manifest.webmanifest, dist/sw.js, dist/icons/*
```

`dist/index.html` contains **no `modulepreload` link** — Leaflet is a genuine
`import('./leaflet-src-*.js')` async chunk, so the welcome screen never downloads
the map library. The only build message is Vite's advisory 350 kB chunk-size hint
(not an error; the entry bundle is ~117 kB gzipped).

---

## 2. What was built

**98 files total**: 66 `src/**/*.ts(x)`, 6 `src/**/*.json`, 3 CSS, 13 test files,
6 `public/` assets, 4 `desktop/` files, plus root config/docs.

### 2.1 Infrastructure (T01)
`package.json`, `package-lock.json`, `tsconfig.json`, `tsconfig.node.json`,
`vite.config.ts`, `index.html`, `.gitignore`, `.nvmrc`, `README.md`,
`src/main.tsx`, `src/App.tsx`, `src/vite-env.d.ts`,
`src/styles/{tokens,global,utilities}.css`,
`public/{manifest.webmanifest,sw.js}`, `public/icons/*`,
`desktop/{package.json,main.js,preload.js,README.md}`.

- Exact stack honoured: Vite 8.3.8 + React 19.3.1 + TypeScript, plain CSS custom
  properties, `useReducer` + Context, native `fetch` + `AbortController`, hand-written
  SVG charts / score ring. **No MUI, no Tailwind, no chart library.**
- Root scripts: `dev`, `build`, `preview`, `test`, `typecheck`. **No Electron reference.**
- `src/App.tsx` is a declarative `SCREENS: Record<Screen, Component>` registry plus
  the persistent chrome (brand header, `StatusBanner`, footer, skip link, language
  toggle). All nine screen ids are reachable via `actions.goTo`.
- `src/main.tsx` registers `sw.js` best-effort in production only; bundled sample
  data guarantees offline behaviour even if registration fails.

### 2.2 Types / config / data / API / normalisation (T02)
- `src/config/endpoints.ts` is the **single network allowlist** with exactly the
  eight required hosts, `BlockedHostError`, `hostOf`/`isAllowed`/`assertAllowed`,
  and all URL builders (POWER climatology/monthly, Open-Meteo forecast/archive/
  geocoding, SoilGrids, Nominatim, OSM raster, NASA GIBS true-colour WMTS).
- `src/api/http.ts` is the **only** `fetch()` in `src/`. It calls
  `assertAllowed(url)` *before* any network activity, then bounds the request with
  `AbortController`. All failures return `FetchResult{ok:false}` — nothing throws.
- Per-source adapters (`power`, `openMeteo`, `geocode`, `soilGrids`, `nominatim`)
  with coordinate-rounded TTL cache (`cache.ts`) and stale-on-failure support.
  SoilGrids uses an 8 s hard timeout and treats `mean: null` as normal no-data.
- `src/api/orchestrator.ts` uses `Promise.allSettled`, isolates every source, and
  falls back to `buildOfflineRaw()` when the backbone fails. `offlineSite()` is the
  deterministic, network-free integration entry point.
- `src/normalize/*` produces the single `SiteConditions` object. `climate.ts`
  implements the mandatory `PRECTOTCORR` mm/day → monthly mm conversion with a
  fixed 28-day February, `JAN..DEC → 1..12`, and `ANN` stored separately.
- `src/data/crops.json`: **38 crops**, tropical + temperate smallholder coverage,
  each with full requirement ranges, rotation tags and literature attribution.
- `src/data/sample/*`: real-shaped bundled POWER / Open-Meteo / SoilGrids /
  Nominatim / geocoding payloads for Central Java (-7.55 / 110.42).

### 2.3 Pure domain engine (T03)
`src/domain/{membership,crops,explain,factors,scoring,confidence,risks,rotation,
strategies,recommend}.ts` — **no `fetch`, `Date.now()`, `Math.random()`, `new Date`,
`localStorage`, browser globals** (enforced by a static compliance test).
`targetMonth` lives in `SiteConditions`; `lang` is an argument.

- Seven weighted factors F1–F7 (20/20/15/15/10/10/10 = 100), each returning a
  `FactorScore` with `score`, `verdict`, `reason`, `source`, `sourceId`, `freshness`,
  `isEstimated`, `unit`, `rawValue`.
- Integer score 0–100; confidence High/Medium/Low computed **separately**;
  tie-break score desc → confidence desc → completeness desc → cropId asc.
- `buildRotationPlan` performs an exhaustive DFS over crop pairs, applies the six
  hard rules, always returns exactly 3 seasons, discloses an assumed neutral
  previous crop, and returns an honest `noConfidentMatch` fallback rather than
  silently breaking a rule.
- `buildStrategies` produces **5** comparable strategies (`existing`, `balanced`,
  `soil-restoring`, `water-saving`, `quick-income`), exactly one `isExisting`, each
  with evidence, benefits, `informationGaps[]`, `risks[]`, vulnerable seasons and
  a numeric comparison set.

### 2.4 UI / state (T04, T05)
`src/state/{reducer,AppContext,persist}.ts`, `src/i18n/{en,id,index}.ts`,
17 components and 9 screens S0–S7. English baseline + Bahasa Indonesia dictionary
(346 keys, no duplicates, full parity via `...en`). Persistent Live / Partly
estimated / Offline sample banner, one primary action per screen, ≥48px tap targets,
≥16px body, 320px mobile-first layout, icon+word (never colour alone) for
Estimated / Good / Fair / Poor, fixed disclaimer + regional caveat.

---

## 3. Key design decisions

1. **Layer preservation.** The UI never imports `src/api/*` directly; only
   `AppContext` calls the orchestrator, and only `recommend()` calls the domain.
   `SiteConditions` is the sole data contract between layers.
2. **Provenance assembled at fetch time, threaded unchanged.** `normalize.ts`
   dedupes but never mutates `Provenance` objects; every displayed number carries
   source, freshness and `isEstimated`.
3. **Honest degradation.** A failed/estimated source lowers confidence, never blocks.
   Offline mode flags **every** factor `isEstimated: true` and `appStatus:
   'Offline sample'`. No `NaN`, blank value or endless spinner.
4. **Lazy Leaflet.** `FieldMap.tsx` statically imports only `leaflet/dist/leaflet.css`;
   the library itself is `await import('leaflet')` inside `useEffect`. The
   `manualChunks` rule was **removed** because it forced Vite to emit a
   `<link rel="modulepreload">` for Leaflet in `index.html`, defeating the lazy
   requirement. Without it, Leaflet is a real async chunk. Every map has a
   solid-colour + draggable-pin fallback with pointer events, so tiles are optional.
5. **Determinism.** Pure domain + explicit `targetMonth` argument. Tests assert
   byte-identical output across repeated calls and identical scores across languages.
6. **No secrets.** No keys, tokens, `.env`, analytics, ads or accounts anywhere.
   `NOMINATIM_USER_AGENT` is a descriptive identification string only.

---

## 4. Deviations from the architecture (all documented, all justified)

| # | Architecture said | Implementation | Justification |
|---|---|---|---|
| 1 | `manualChunks` isolates Leaflet into its own chunk | No `manualChunks`; native dynamic-import chunking | An explicit chunk caused Vite to emit a `modulepreload` for Leaflet on the welcome screen. Native splitting keeps Leaflet genuinely lazy (verified: 0 `modulepreload` in `dist/index.html`). The async chunk still exists (`dist/assets/leaflet-src-*.js`). |
| 2 | `public/icons/icon-192.png` and `icon-512.png` | Both generated and shipped, plus `icon.svg` / `favicon.svg` | Now fully matches the file list. PNGs are generated with a small Node/zlib one-off script (no runtime dependency added); manifest, `sw.js` SHELL list and `index.html` all reference them. |
| 3 | `fetchWithTimeout` in the architecture diagram | `fetchJson` in `src/api/http.ts` | Single function that both guards the allowlist and bounds the request with `AbortController`. README diagram corrected to the actual symbol. |
| 4 | Icon PNG sizes `192`/`512` only | SVG icons added as well | SVG gives crisp scalable icons in the header/favicon; PNGs satisfy installability. |

No functional requirement, endpoint shape, unit rule, scoring weight, rotation rule,
screen (S0–S7), or P0 behaviour was changed.

---

## 5. Bugs found and fixed during global consistency review

1. **`asMonth(0)`** returned January because `Math.trunc(value || 1)` collapses a
   legitimate wrap-around zero. Fixed to consistent modular arithmetic
   (`13 → 1`, `0 → 12`, `-1 → 11`); no callers relied on the old behaviour.
2. **S4 "Scoring method" panel** rendered duplicate labels
   (`"Temperature fit / Temperature fit"`) because it concatenated `t('factor.F1')`
   with `FACTOR_NAMES['F1']` (identical strings). Changed to `"F1 · Temperature fit"`.
   A regression assertion was added to `tests/screens.test.ts`.
3. **Leaflet modulepreload** (see deviation #1) — fixed by removing `manualChunks`.
4. Two extraneous npm packages removed with `npm prune`.

---

## 6. Test suite (13 files, 127 tests)

| File | Covers |
|---|---|
| `membership.test.ts` | JAN..DEC mapping, ANN never a month, `getMonth()+1`, fixed Feb 28, wrap-around windows, trapezoid, wetness words |
| `endpoints.test.ts` | Exact 8-host allowlist, blocked Overpass/Earthdata-login hosts, all verified URL shapes, GIBS layer whitelist (no NDVI/EVI) |
| `climate.test.ts` | mm/day → monthly mm conversion, ANN separate, elevation, fill values, fallback payload, forecast/ET0 normalisation |
| `crops.test.ts` | 38-crop DB validation, tropical + temperate coverage, requirement ranges, neutral previous crop |
| `scoring.test.ts` | Weights sum 100, weighted aggregation/clamping/rounding, verdict bands, deterministic tie-break, confidence separation |
| `merge.test.ts` | SoilGrids `mean: null`, `d_factor` division, successful-still-estimated, profile overrides, `remergeSite` no-refetch |
| `rotation.test.ts` | All six hard rules, 3 seasons, 4-month offsets, tentative seasons, neutral/honoured previous crop, determinism |
| `strategies.test.ts` | ≥3 strategies, exactly one existing, evidence/benefits/gaps/risks, comparable metrics |
| `recommend.test.ts` | Full offline P0 path for all 12 months, 7 explainable factors all estimated, determinism, language argument, rotation + strategies attached |
| `http.test.ts` | `assertAllowed` before `fetch`, blocked host never calls fetch, HTTP/parse/network failures never throw, `navigator.onLine` |
| `compliance.test.ts` | Domain purity static scan, single allowlist, no forbidden hosts/keys/TODOs, no root Electron, attribution constants |
| `render.test.ts` | Real `react-dom/server` render of the full App shell (banner, disclaimer, primary action, a11y) |
| `screens.test.ts` | Server-render of **all nine screens** with real offline data; no NaN/undefined, factor cards, 3 seasons, 5 strategies, hostname table |

---

## 7. Known limitations (inherited from PRD / architecture, not defects)

- Crop ranges are literature-based heuristics, not locally calibrated agronomy.
- NASA POWER ~0.5° grid, SoilGrids ~250 m raster, Open-Meteo ~1–11 km — always
  labelled regional estimate.
- Bundled sample data is a realistic Central Java payload, not a live measurement.
- The service worker is best-effort; first-run offline works from bundled data alone.
- Three "seasons" are broad ~4-month blocks, not a locale-specific monsoon calendar.
- Bahasa Indonesia is a secondary dictionary (187 overrides, remaining keys fall
  back to English); no language gate before first use.

---

## 8. Quick start for QA

```bash
npm install
npm run typecheck
npm test              # 127 tests, fully offline
npm run build         # static dist/
npm run preview       # open the printed localhost URL
# On the welcome screen choose "Use a sample field (offline)" for a zero-network run.
```
