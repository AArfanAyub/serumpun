/**
 * Serumpun SINGLE NETWORK ALLOWLIST.
 *
 * This is the only module that may contain a runtime host name. `src/api/http.ts`
 * calls `assertAllowed(url)` before every `fetch`. Hosts below are exactly the keyless,
 * account-free endpoints verified in docs/00-research-brief.md section 3, plus the static
 * OSM raster basemap and NASA GIBS true-colour imagery tiles.
 *
 * No API key, credential, account, payment, analytics or advertising endpoint exists in
 * this project. There are no secrets and no environment variables.
 */

export const ALLOWED_HOSTS: readonly string[] = Object.freeze([
  'power.larc.nasa.gov',
  'gibs.earthdata.nasa.gov',
  'api.open-meteo.com',
  'archive-api.open-meteo.com',
  'geocoding-api.open-meteo.com',
  'rest.isric.org',
  'nominatim.openstreetmap.org',
  'tile.openstreetmap.org',
]);

/** Human-readable names for the on-screen allowlist / audit table. */
export const ALLOWED_HOST_PURPOSE: Readonly<Record<string, string>> = Object.freeze({
  'power.larc.nasa.gov': 'NASA POWER agroclimatology (climatology / monthly / daily)',
  'gibs.earthdata.nasa.gov': 'NASA EOSDIS GIBS true-colour WMTS imagery tiles',
  'api.open-meteo.com': 'Open-Meteo current conditions and 16-day forecast',
  'archive-api.open-meteo.com': 'Open-Meteo historical archive (optional reliability view)',
  'geocoding-api.open-meteo.com': 'Open-Meteo place-name search',
  'rest.isric.org': 'ISRIC SoilGrids v2 optional soil enrichment',
  'nominatim.openstreetmap.org': 'Nominatim reverse geocoding for place names',
  'tile.openstreetmap.org': 'OpenStreetMap raster basemap tiles',
});

export class BlockedHostError extends Error {
  public readonly url: string;
  public readonly host: string;

  constructor(url: string, host: string) {
    super(`Host is not on the Serumpun network allowlist: ${host}`);
    this.name = 'BlockedHostError';
    this.url = url;
    this.host = host;
  }
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

export function isAllowed(url: string): boolean {
  const host = hostOf(url);
  return host.length > 0 && ALLOWED_HOSTS.includes(host);
}

/** Throws BlockedHostError for any host outside ALLOWED_HOSTS. Called before every fetch. */
export function assertAllowed(url: string): void {
  if (!isAllowed(url)) {
    throw new BlockedHostError(url, hostOf(url) || '(unparseable URL)');
  }
}

const POWER_BASE = 'https://power.larc.nasa.gov/api/temporal';
const GEOCODE_BASE = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_BASE = 'https://api.open-meteo.com/v1/forecast';
const ARCHIVE_BASE = 'https://archive-api.open-meteo.com/v1/archive';
const SOILGRIDS_BASE = 'https://rest.isric.org/soilgrids/v2.0/properties/query';
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/reverse';

/** The nine verified AG-community parameters returned as JAN..DEC + ANN. */
export const POWER_PARAMETERS =
  'T2M,T2M_MAX,T2M_MIN,PRECTOTCORR,RH2M,ALLSKY_SFC_SW_DWN,WS10M,GWETROOT,GWETTOP';

function coord(lat: number, lon: number): { latitude: number; longitude: number } {
  return {
    latitude: Math.round(lat * 1e6) / 1e6,
    longitude: Math.round(lon * 1e6) / 1e6,
  };
}

export function powerClimatologyUrl(lat: number, lon: number): string {
  const c = coord(lat, lon);
  const params = new URLSearchParams({
    parameters: POWER_PARAMETERS,
    community: 'AG',
    longitude: String(c.longitude),
    latitude: String(c.latitude),
    format: 'JSON',
  });
  return `${POWER_BASE}/climatology/point?${params.toString()}`;
}

export function powerMonthlyUrl(lat: number, lon: number, startYear: number, endYear: number): string {
  const c = coord(lat, lon);
  const params = new URLSearchParams({
    parameters: 'T2M,PRECTOTCORR',
    community: 'AG',
    longitude: String(c.longitude),
    latitude: String(c.latitude),
    start: String(startYear),
    end: String(endYear),
    format: 'JSON',
  });
  return `${POWER_BASE}/monthly/point?${params.toString()}`;
}

export function openMeteoForecastUrl(lat: number, lon: number): string {
  const c = coord(lat, lon);
  const params = new URLSearchParams({
    latitude: String(c.latitude),
    longitude: String(c.longitude),
    current: 'temperature_2m,relative_humidity_2m,precipitation,soil_moisture_0_to_1cm',
    daily:
      'temperature_2m_max,temperature_2m_min,precipitation_sum,et0_fao_evapotranspiration,shortwave_radiation_sum',
    forecast_days: '16',
    timezone: 'auto',
  });
  return `${FORECAST_BASE}?${params.toString()}`;
}

export function openMeteoArchiveUrl(lat: number, lon: number, startDate: string, endDate: string): string {
  const c = coord(lat, lon);
  const params = new URLSearchParams({
    latitude: String(c.latitude),
    longitude: String(c.longitude),
    start_date: startDate,
    end_date: endDate,
    daily: 'precipitation_sum,temperature_2m_mean',
    timezone: 'auto',
  });
  return `${ARCHIVE_BASE}?${params.toString()}`;
}

export function geocodeUrl(query: string): string {
  const params = new URLSearchParams({
    name: query,
    count: '5',
    language: 'en',
    format: 'json',
  });
  return `${GEOCODE_BASE}?${params.toString()}`;
}

export function soilGridsUrl(lat: number, lon: number): string {
  const c = coord(lat, lon);
  const params = new URLSearchParams({
    lon: String(c.longitude),
    lat: String(c.latitude),
    depth: '0-5cm',
    value: 'mean',
  });
  const properties = ['phh2o', 'clay', 'sand', 'silt', 'soc', 'nitrogen', 'cec'];
  for (const property of properties) {
    params.append('property', property);
  }
  return `${SOILGRIDS_BASE}?${params.toString()}`;
}

export function nominatimReverseUrl(lat: number, lon: number): string {
  const c = coord(lat, lon);
  const params = new URLSearchParams({
    lat: String(c.latitude),
    lon: String(c.longitude),
    format: 'json',
    zoom: '10',
  });
  return `${NOMINATIM_BASE}?${params.toString()}`;
}

export function osmTileUrl(z: number, x: number, y: number): string {
  return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
}

/** Leaflet URL template (same allowlisted host, placeholders filled by the map library). */
export function osmTileTemplate(): string {
  return 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
}

/** Only the two true-colour layers verified working in the research brief. */
export const GIBS_LAYERS: readonly string[] = Object.freeze([
  'MODIS_Terra_CorrectedReflectance_TrueColor',
  'VIIRS_SNPP_CorrectedReflectance_TrueColor',
]);

/** A fixed, known-good fallback date used when no recent tile is available. */
export const GIBS_FALLBACK_DATE = '2024-01-01';

export function gibsDefaultDate(now: Date = new Date()): string {
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return sevenDaysAgo.toISOString().slice(0, 10);
}

export function gibsTileUrl(layer: string, date: string, z: number, y: number, x: number): string {
  const safeLayer = GIBS_LAYERS.includes(layer) ? layer : GIBS_LAYERS[0];
  const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : GIBS_FALLBACK_DATE;
  return (
    `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${safeLayer}/default/` +
    `${safeDate}/GoogleMapsCompatible_Level9/${z}/${y}/${x}.jpg`
  );
}

/** Leaflet URL template for the optional NASA GIBS true-colour overlay. */
export function gibsTileTemplate(layer: string, date: string): string {
  const safeLayer = GIBS_LAYERS.includes(layer) ? layer : GIBS_LAYERS[0];
  const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : GIBS_FALLBACK_DATE;
  return (
    `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${safeLayer}/default/` +
    `${safeDate}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`
  );
}

/** Descriptive identification sent where the platform permits setting it. */
export const NOMINATIM_USER_AGENT =
  'Serumpun/1.0 (keyless crop decision-support research app; contact: local project README)';
