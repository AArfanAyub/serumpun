# Serumpun — Verified Research Brief (Delivery Director / Qi)

Date: 2026-11-13
Status: shared context for all teammates. This is NOT a PRD, architecture doc, or code spec —
those are produced by Xu (PM), Gao (Architect), Kou (Engineer), Yan (QA).

## 1. User request (verbatim intent)

Build software named **Serumpun** that:
- recommends **what crop to plant at a given location and at that time of year**;
- factors in **soil type, environment, surroundings, weather**, and related agro-climatic conditions;
- also suggests **what crop to plant next using crop rotation** principles;
- targets **smallholder / small-stakeholder farmers** (low bandwidth, low digital literacy, low-cost devices);
- **can access the internet**;
- is **completely free** — no API keys, no accounts, no trials, no payment, no vendor lock-in;
- uses NASA open data from the Space Apps 2026 challenge
  "Field Shift: Adapting Farms with NASA Data" (resources tab) plus other free NASA / open data APIs;
- uses **Mobbin for UI/UX design inspiration**;
- platform: **Electron or any other suitable platform**.

## 2. The NASA Space Apps challenge resource list (extracted from ?tab=resources)

The page is JS-rendered; extracted via a rendered-text proxy. 24 resources in two groups.

NASA Data & Resources (agriculture-relevant highlights):
- **NASA POWER** — agroclimatology & meteorological data, https://power.larc.nasa.gov/ → temperature, humidity,
  radiation, derived indicators, crop water use, growing season, frost risk, climate suitability.
- **SMAP** — surface soil moisture / freeze-thaw, https://www.earthdata.nasa.gov/data/platforms/space-based-platforms/smap
  → drought stress, water availability, early crop-stress signals, rotation crop water efficiency.
- **GPM / IMERG** — precipitation rate & accumulation, https://gpm.nasa.gov/data → rainfall reliability,
  extreme storms, erosion risk, rotation scenarios under different precipitation regimes.
- **Landsat / MODIS / VIIRS** — reflectance, NDVI, vegetation indices (Landsat 30 m; MODIS/VIIRS 250–1000 m)
  → crop vigor, seasonal transition, stress periods, visual comparison of rotation options.
- **SRTM** — elevation / terrain, https://www.earthdata.nasa.gov/data/instruments/srtm → slope, runoff, erosion risk.
- **ECOSTRESS** — land surface temperature & evapotranspiration → heat exposure, crop water demand.
- **NLDAS / GLDAS** — land data assimilation: temperature, precipitation, soil moisture, ET proxies, radiation.
- **GEDI** — canopy structure / biomass context around agricultural landscapes.
- Complementary: USDA Ag Data Commons, Web Soil Survey, CropScape CDL, PRISM, SSURGO/STATSGO2, NAIP,
  NLCD, FAO GAEZ, CoCoRaHS, USGS NWIS, USDA AMS Market News, USDA NASS QuickStats, OpenET, LANDFIRE.

Space Agency Partner Resources:
- **Copernicus Sentinel-2 (ESA)** — https://dataspace.copernicus.eu/ — 10–20 m multispectral, NDVI/EVI.
- **ERA5 (ECMWF)** — https://cds.climate.copernicus.eu/ — global hourly reanalysis.

Recurring challenge themes to reflect in product language: drought stress, water availability,
crop-stress signals, **rotation crops**, crop vigor, crop water use, soil health, erosion risk.

IMPORTANT free/payment constraint: SMAP / GPM IMERG / Landsat / MODIS / ECOSTRESS / GEDI / Sentinel-2 /
ERA5 generally require **Earthdata Login, API keys, or bulk download workflows** (free-of-charge but account-bound),
and several US-only datasets (WSS, CDL, PRISM, SSURGO, NLCD, OpenET, NASS) are US-only. Serumpun must remain
**keyless and globally usable**, so use them as documented inspiration/attribution, not as runtime dependencies.
Where a NASA variable is needed, prefer the keyless NASA POWER API (which already exposes MERRA-2/GLDAS-derived
agro-meteorology including soil wetness) and NASA GIBS imagery tiles.

### 2.1 Full challenge statement (main tab, extracted via rendered-text proxy — authoritative scope)

> "Farmers around the world navigate shifting temperatures, changing rainfall patterns, water shortages,
> extreme weather, and declining soil health. These pressures make it difficult to choose crop rotations
> that protect fields, conserve water, and support long-term resilience. Your challenge is to create a
> **decision-support tool** that uses NASA Earth observations along with local soil information, crop
> characteristics, and farmer priorities to help farmers explore rotation strategies that could strengthen
> soil health and adapt their farms to changing conditions."

Explicit expectations worth honouring in the product (all "may consider", no strict deliverables checklist):
- Combine NASA Earth observations with **local soil information, crop characteristics, and farmer priorities**
  (water use, forage value, nitrogen-fixing potential, erosion reduction, organic matter, market suitability).
- Analyse temperature, heat stress, rainfall, soil moisture, evaporation, frost risk, extreme precipitation,
  vegetation stress, long-term water trends.
- **"You may compare at least three rotation strategies, including the existing rotation."** For each:
  why suggested, supporting evidence, benefits, information gaps, risks needing local review.
  → Serumpun should offer a comparison of ≥3 rotation strategies (one being the farmer's existing rotation),
  not just one 3-season plan. This is a meaningful addition to the user's request.
- Highlight bare-field periods, vulnerable seasons, opportunities to interrupt pest cycles / reduce water
  demand / improve infiltration / add supplemental income.
- Explain scientific terms (evapotranspiration, soil moisture anomalies, vegetation indices, frost risk,
  water balance) and clarify satellite vs. ground measurements.
- Farmer-centred: interpretable for users with limited technical/geospatial experience; let farmers input
  their own priorities/constraints; **"a supportive tool — one that helps identify patterns and possibilities,
  but does not replace farmer judgment or local agricultural expertise."**
- The challenge page does NOT explicitly mention smallholders — that focus comes from the user's request.

## 3. Live endpoint verification (tested 2026-11-13, from this machine, with `Origin` header)

| Source | Endpoint | Result | CORS | Key needed |
|---|---|---|---|---|
| NASA POWER climatology | `https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=T2M,T2M_MAX,T2M_MIN,PRECTOTCORR,RH2M,ALLSKY_SFC_SW_DWN,WS10M,GWETROOT,GWETTOP&community=AG&longitude=106.8456&latitude=-6.2088&format=JSON` | 200, 2692 B | `Access-Control-Allow-Origin: *` | no |
| NASA POWER monthly | `https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=T2M,PRECTOTCORR&community=AG&longitude=...&latitude=...&start=2023&end=2024&format=JSON` | 200 | `*` | no |
| NASA POWER daily | `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M,PRECTOTCORR,ALLSKY_SFC_SW_DWN&community=AG&longitude=...&latitude=...&start=20250101&end=20250107&format=JSON` | 200 | `*` | no |
| NASA GIBS WMTS tiles | `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/2024-01-01/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg` | 200 image/jpeg | `*` | no |
| Open-Meteo forecast | `https://api.open-meteo.com/v1/forecast?latitude=-7.55&longitude=110.42&current=temperature_2m,relative_humidity_2m,precipitation,soil_moisture_0_to_1cm&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,et0_fao_evapotranspiration,shortwave_radiation_sum&forecast_days=16&timezone=auto` | 200 | `*` | no |
| Open-Meteo archive | `https://archive-api.open-meteo.com/v1/archive?...&daily=precipitation_sum,temperature_2m_mean` | 200 | `*` | no |
| Open-Meteo geocoding | `https://geocoding-api.open-meteo.com/v1/search?name=Bogor&count=3&language=en&format=json` | 200 | `*` | no |
| Nominatim reverse | `https://nominatim.openstreetmap.org/reverse?lat=...&lon=...&format=json&zoom=10` | 200, CORS `*` | `*` | no (send descriptive UA, respect 1 req/s) |
| ISRIC SoilGrids v2 | `https://rest.isric.org/soilgrids/v2.0/properties/query?lon=...&lat=...&property=phh2o&property=clay&property=sand&property=soc&depth=0-5cm&value=mean` | ⚠️ **FLAKY**: frequent timeouts (30–60 s), and returns `"mean": null` for many pixels (urban/masked pixels) | `*` | no |
| Overpass API (OSM landuse) | `https://overpass-api.de/api/interpreter`, `https://overpass.kumi.systems/api/interpreter` | ⚠️ **FAILED** from this environment (502 / timeout) | n/a | no |

### Hard engineering constraints derived from the above
1. **NASA POWER is the reliable backbone.** AG community parameters verified working:
   `T2M`, `T2M_MAX`, `T2M_MIN`, `PRECTOTCORR`, `RH2M`, `ALLSKY_SFC_SW_DWN`, `WS10M`, `GWETROOT`, `GWETTOP`.
   Climatology returns monthly keys `JAN..DEC` + `ANN`. `PRECTOTCORR` on climatology is **mm/day** — multiply by
   days-in-month to get monthly totals. `T2M*` in °C, `RH2M` in %, `ALLSKY_SFC_SW_DWN` in MJ/m²/day,
   `GWETROOT`/`GWETTOP` are 0–1 relative soil wetness (GLDAS/MERRA-2 derived — this is the practical keyless
   stand-in for SMAP/NLDAS soil moisture). POWER geometry also returns site elevation in metres.
2. **Open-Meteo is the reliable "now + next 16 days" layer** and returns `elevation`, `timezone`,
   current temp/humidity/precip/soil moisture, daily ET0 (FAO), shortwave radiation. CC BY 4.0,
   free for non-commercial use, no key, no tracking.
3. **SoilGrids must be treated as optional enrichment, never a blocker.** Implementation MUST:
   - use an `AbortController` timeout (~8 s),
   - cache by rounded coordinate,
   - handle `mean: null` by falling back to a **manual soil type / pH picker** in the UI,
   - clearly label soil data as "estimated / self-reported" when it falls back,
   - never block or fail the whole recommendation if SoilGrids fails.
4. **Overpass must not be a dependency.** Surroundings should come from: user form (irrigation access, shade,
   nearby water body, slope, previous crop, land size, nearby forest/urban), reverse geocoding for place/admin
   context, Open-Meteo elevation, and NASA GIBS satellite layer for visual context. All optional with fallbacks.
5. **Every API call needs graceful degradation + visible source attribution + offline demo mode**
   (bundled sample data works without internet). Zero API keys, zero accounts, zero payment, zero telemetry/ads.
6. Licences to attribute in-app: NASA POWER (NASA, public domain / open use), NASA GIBS (NASA EOSDIS),
   Open-Meteo (CC BY 4.0), ISRIC SoilGrids (CC BY 4.0), OpenStreetMap/Nominatim (ODbL), OSM tile basemap (ODbL).

### Additional verification (same session)
- npm registry reachable (`npm ping` PONG), React 19.3.1 / Vite 8.3.8 available — `npm install` will work.
- NASA GIBS layer `MODIS_Terra_CorrectedReflectance_TrueColor` and `VIIRS_SNPP_CorrectedReflectance_TrueColor`
  both return JPEG tiles with `ACAO: *` for dates as recent as `2026-11-12` (dynamic `YYYY-MM-DD` in the URL
  works). Layer `MODIS_Terra_NDVI_8Day` is 404 at that path — do NOT use it without checking the WMTS
  capabilities doc. Use the true-colour layers as an optional NASA satellite basemap overlay.
- FAO EcoCrop is the canonical literature source for crop environmental requirement ranges, but no stable
  keyless REST endpoint was found. The crop database should therefore be a **local, curated, attributed JSON
  dataset** whose thresholds are literature-based heuristics (EcoCrop/FAO GAEZ-style ranges), clearly labelled
  as decision support rather than agronomic guarantee.

### Final verification pass
- OSM raster basemap `https://tile.openstreetmap.org/{z}/{x}/{y}.png` → 200 image/png, `ACAO: *`.
  Use a descriptive User-Agent / respect the OSM tile usage policy; attribution "© OpenStreetMap contributors" required.
- NASA GIBS vegetation-index layer guesses (`MODIS_Terra_NDVI_16Day`, `MODIS_Terra_EVI_16Day`) → HTTP 400.
  **Only the two true-colour layers verified above are safe to use.** Do not ship an NDVI layer without
  checking the WMTS GetCapabilities document.
- Open-Meteo archive for a full 365-day range → 200, ~8.9 KB. Cheap enough for long-term trend context.

## 4. Mobbin UI/UX inspiration (searched and visually inspected)

All references below were retrieved from Mobbin and the images were actually inspected. Cite as markdown links
when mentioned to the user.

- [Felt — map dashboard with left legend/stats panel](https://mobbin.com/screens/e3e307a6-7376-42a2-9c31-b8e92380fdcd)
  → pattern for the field/location map with an overlay legend + stat sidebar.
- [komoot — details + weather summary beside a map](https://mobbin.com/screens/e9de863d-ca83-4ccf-9dec-861e7415f711)
  → two-column "field details / map" layout, calm outdoor palette, month chips.
- [Databricks — chart cards dashboard](https://mobbin.com/screens/da15578d-361e-4ca8-882c-d2fe9bf3c854)
  → card grid for climate charts and factor breakdowns.
- [Lovi — 87% fit-for-you score with circular gauge + "What Does This Mean?" explanation](https://mobbin.com/screens/49f3e8d8-e3bc-472d-bade-24b21a18445f)
  → **primary pattern for the crop suitability score**: big readable score ring, then plain-language reasons.
- [Yuka — recommendation list with 100/100 score and "Scoring method" link](https://mobbin.com/screens/3119d145-a322-4161-9499-f23399dc7daf)
  → transparent scoring, tappable "why" detail, no dark patterns.
- [Cleo AI — 63/100 score + "Your summary"](https://mobbin.com/screens/8c905f3c-e573-42b4-a31e-faf44c7606f2)
  → score → explanation → next step CTA hierarchy.
- [Greg — searchable plant list with photos and info buttons](https://mobbin.com/screens/4984fd98-009a-4793-93fc-163e9601bade)
  → crop catalogue / "identify your plant" list pattern.
- [Apple Weather — location search flow](https://mobbin.com/flows/37dda8db-f651-41b1-a6e8-c79091d63263?tab=screens)
  → location search → results list → forecast detail flow (adapt to: search village → field profile → recommendation).
- [7shifts — compact metric strip](https://mobbin.com/screens/7942bea6-0a5e-441f-aeae-015af9956777)
  → KPI strip for temperature / rainfall / soil / elevation.

Design direction to carry through: **light theme**, calm earthy greens + warm sand/amber accents, large
high-contrast type, generous tap targets, one primary action per screen, plain language, "why this?"
explanations everywhere, no paywalls/upsells (explicit non-goal), mobile-first and low-bandwidth friendly.

## 5. Coordinator constraints (NOT negotiable)

- **Platform**: a browser-based responsive web app (Vite + React + TypeScript), mobile-first, PWA-ready,
  plus an **optional** Electron wrapper in a separate `desktop/` folder with its own package.json so the
  primary `npm run dev` never depends on installing Electron. Rationale: smallholders use cheap Android
  phones and shared devices; a PWA needs no install, no store account, no fees and works on poor connections.
  Gao (Architect) must confirm/refine this decision and justify it in the design doc.
- **No keys, no accounts, no payment, no ads, no tracking, no proprietary/paid APIs.** Only the endpoints in
  section 3 (plus static OSM raster tiles and NASA GIBS tiles) may be called at runtime.
- **Explainable recommendations**: every score must decompose into named factors with reasons, and every
  fact must show its data source + freshness. No black-box claims, no invented precision.
- **Crop rotation**: family avoidance, nitrogen role sequencing (legume → heavy feeder → light feeder),
  root-depth alternation, disease-break, season/planting-window fit, 3-season plan with reasons.
- **Crop database**: ~30–40 crops, global but with strong tropical/smallholder coverage (rice, maize,
  cassava, sweet potato, soybean, peanut, mung bean, cowpea, chili, tomato, eggplant, cucumber, shallot,
  cabbage, carrot, potato, banana, sugarcane, coffee, cocoa, ginger, turmeric, sorghum, millet, sesame,
  sunflower, wheat, barley, oats, peas, lentils, chickpea, alfalfa/clover, pumpkin, kangkung, long bean,
  taro). Each with agronomic requirement ranges + rotation attributes.
- **Deliverables land in** `C:/Users/user/WorkBuddy AI/2026-11-13-23-45-57/serumpun/`.
  Docs in `serumpun/docs/`: `01-prd.md`, `02-architecture.md`, `03-code-summary.md`, `04-qa-report.md`.
- **Language**: user wrote in English → all docs, UI and replies in English (Bahasa Indonesia labels are
  a welcome optional touch given the name "Serumpun", but English is the baseline).
- Do not create any file that requires a paid service, API key, or login to run.
