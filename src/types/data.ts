import type { Month } from './ui';

/** Only these source identifiers may ever appear in provenance. */
export type SourceId =
  | 'NASA_POWER'
  | 'NASA_GIBS'
  | 'OPEN_METEO'
  | 'SOILGRIDS'
  | 'NOMINATIM'
  | 'OSM_TILES'
  | 'BUNDLED'
  | 'USER';

export type DataStatus = 'live' | 'cached' | 'estimated' | 'self-reported' | 'bundled sample';
export type AppDataStatus = 'Live' | 'Partly estimated' | 'Offline sample';

export interface Provenance {
  sourceId: SourceId;
  source: string;
  contribution: string;
  licence: string;
  attribution: string;
  retrievedAt: string | null;
  freshness: string;
  status: DataStatus;
  isEstimated: boolean;
  url?: string;
  cacheKey?: string;
}

export interface ApiError {
  sourceId: SourceId;
  kind: 'timeout' | 'http' | 'parse' | 'null-mean' | 'offline' | 'blocked-host' | 'rate-limit';
  message: string;
  statusCode?: number;
  at: string;
}

export interface FetchResult<T> {
  ok: boolean;
  data: T | null;
  error: ApiError | null;
  provenance: Provenance;
  fromCache: boolean;
}

export interface CacheEntry<T> {
  key: string;
  payload: T;
  storedAt: string;
  ttlMs: number;
  provenance: Provenance;
}

export interface DataSourceStatus {
  sourceId: SourceId;
  state: 'idle' | 'loading' | 'ok' | 'degraded' | 'failed' | 'skipped';
  status: DataStatus;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  timeoutMs: number;
  cacheTtlMs: number;
  error: ApiError | null;
  fallbackUsed: boolean;
  userVisibleLabel: string;
  provenance: Provenance;
}

/** How the user picked the field. */
export type LocationInput =
  | { kind: 'search'; query: string }
  | { kind: 'gps'; latitude: number; longitude: number }
  | { kind: 'pin'; latitude: number; longitude: number }
  | { kind: 'manual'; latitude: number; longitude: number }
  | {
      kind: 'coords';
      latitude: number;
      longitude: number;
      placeName?: string | null;
      adminContext?: string | null;
      elevationM?: number | null;
      timezone?: string;
      isCoarse?: boolean;
    }
  | { kind: 'sample' };

export interface GeocodeHit {
  id?: number;
  name?: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
  admin2?: string;
  elevation?: number;
  timezone?: string;
}

export interface GeocodeResponse {
  results?: GeocodeHit[];
}

/** Raw NASA POWER climatology payload (properties.parameter.{PARAM}.{JAN..DEC,ANN}). */
export interface PowerClimatologyResponse {
  properties?: {
    parameter?: Record<string, Record<string, number>>;
  };
  geometry?: {
    type?: string;
    coordinates?: number[];
  };
  header?: Record<string, unknown>;
  messages?: string[];
}

/** Raw NASA POWER monthly payload, used only for the optional month override / archive. */
export interface PowerMonthlyResponse {
  properties?: {
    parameter?: Record<string, Record<string, number>>;
  };
}

/** Raw Open-Meteo forecast + current payload. */
export interface OpenMeteoForecastResponse {
  latitude?: number;
  longitude?: number;
  elevation?: number;
  timezone?: string;
  timezone_abbreviation?: string;
  current?: {
    time?: string;
    temperature_2m?: number;
    relative_humidity_2m?: number;
    precipitation?: number;
    soil_moisture_0_to_1cm?: number;
  };
  daily?: {
    time?: string[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_sum?: number[];
    et0_fao_evapotranspiration?: number[];
    shortwave_radiation_sum?: number[];
  };
}

/** Raw Open-Meteo archive payload (optional 5-year reliability context). */
export interface OpenMeteoArchiveResponse {
  daily?: {
    time?: string[];
    precipitation_sum?: number[];
    temperature_2m_mean?: number[];
  };
}

/** Raw ISRIC SoilGrids v2 payload. `mean: null` is a normal no-data outcome. */
export interface SoilGridsResponse {
  type?: string;
  properties?: {
    layers?: Array<{
      name?: string;
      unit_measure?: { d_factor?: number };
      depths?: Array<{
        label?: string;
        values?: { mean?: number | null };
      }>;
    }>;
  };
}

/** Raw Nominatim reverse-geocode payload. */
export interface NominatimResponse {
  display_name?: string;
  name?: string;
  address?: Record<string, string>;
}

export interface ArchiveReliability {
  /** 0..100: how many of the sampled years had usable rain in the target month. */
  yearsWithRainPct: number | null;
  sampleYears: number;
  note: string;
  provenance: Provenance;
}

/**
 * Normalised-but-not-yet-domain raw site bundle. Produced by the orchestrator, consumed
 * by `normalize/normalize.ts`. Provenance objects are assembled at fetch time and threaded
 * unchanged all the way to the UI.
 */
export interface RawSiteData {
  power: PowerClimatologyResponse | null;
  forecast: OpenMeteoForecastResponse | null;
  soil: SoilGridsResponse | null;
  nominatim: NominatimResponse | null;
  archive: OpenMeteoArchiveResponse | null;
  powerProv: Provenance;
  forecastProv: Provenance;
  soilProv: Provenance;
  nominatimProv: Provenance;
  archiveProv: Provenance;
  bundledProv: Provenance;
  sources: DataSourceStatus[];
  appStatus: AppDataStatus;
  targetMonth: Month;
}
