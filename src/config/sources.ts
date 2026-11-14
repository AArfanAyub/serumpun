import type { ApiError, DataSourceStatus, DataStatus, Provenance, SourceId } from '@/types/data';
import { ATTRIBUTION, CLIMATOLOGY_PERIOD, LICENCE, OFFLINE_SAMPLE_LABEL } from './attribution';

export interface SourceMeta {
  sourceId: SourceId;
  name: string;
  contribution: string;
  licence: string;
  attribution: string;
  timeoutMs: number;
  cacheTtlMs: number;
  fallbackLabel: string;
  isOptional: boolean;
}

export const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;

export const SOURCE_META: Readonly<Record<SourceId, SourceMeta>> = Object.freeze({
  NASA_POWER: {
    sourceId: 'NASA_POWER',
    name: 'NASA POWER',
    contribution: 'Long-term monthly climate, soil wetness and elevation',
    licence: LICENCE.NASA_POWER,
    attribution: ATTRIBUTION.NASA_POWER,
    timeoutMs: 10_000,
    cacheTtlMs: 30 * DAY,
    fallbackLabel: 'Using long-term average sample data',
    isOptional: false,
  },
  NASA_GIBS: {
    sourceId: 'NASA_GIBS',
    name: 'NASA GIBS',
    contribution: 'Optional true-colour satellite imagery on the map',
    licence: LICENCE.NASA_GIBS,
    attribution: ATTRIBUTION.NASA_GIBS,
    timeoutMs: 6_000,
    cacheTtlMs: 7 * DAY,
    fallbackLabel: 'Satellite image unavailable',
    isOptional: true,
  },
  OPEN_METEO: {
    sourceId: 'OPEN_METEO',
    name: 'Open-Meteo',
    contribution: 'Current conditions, 16-day forecast, place search and timezone',
    licence: LICENCE.OPEN_METEO,
    attribution: ATTRIBUTION.OPEN_METEO,
    timeoutMs: 8_000,
    cacheTtlMs: 3 * HOUR,
    fallbackLabel: 'Live weather unavailable — showing long-term averages',
    isOptional: false,
  },
  SOILGRIDS: {
    sourceId: 'SOILGRIDS',
    name: 'ISRIC SoilGrids',
    contribution: 'Optional estimated soil pH, texture and organic carbon',
    licence: LICENCE.SOILGRIDS,
    attribution: ATTRIBUTION.SOILGRIDS,
    timeoutMs: 8_000,
    cacheTtlMs: 30 * DAY,
    fallbackLabel: 'Soil service unavailable — please pick your soil type',
    isOptional: true,
  },
  NOMINATIM: {
    sourceId: 'NOMINATIM',
    name: 'Nominatim / OpenStreetMap',
    contribution: 'Human-readable place name and admin area',
    licence: LICENCE.NOMINATIM,
    attribution: ATTRIBUTION.NOMINATIM,
    timeoutMs: 6_000,
    cacheTtlMs: 30 * DAY,
    fallbackLabel: 'Place name unavailable — showing coordinates',
    isOptional: true,
  },
  OSM_TILES: {
    sourceId: 'OSM_TILES',
    name: 'OpenStreetMap tiles',
    contribution: 'Map background',
    licence: LICENCE.OSM_TILES,
    attribution: ATTRIBUTION.OSM,
    timeoutMs: 6_000,
    cacheTtlMs: 7 * DAY,
    fallbackLabel: 'Map background unavailable',
    isOptional: true,
  },
  BUNDLED: {
    sourceId: 'BUNDLED',
    name: 'Bundled sample data',
    contribution: 'Crop database and offline sample climate payloads',
    licence: LICENCE.BUNDLED,
    attribution: ATTRIBUTION.CROPS,
    timeoutMs: 0,
    cacheTtlMs: Number.POSITIVE_INFINITY,
    fallbackLabel: OFFLINE_SAMPLE_LABEL,
    isOptional: false,
  },
  USER: {
    sourceId: 'USER',
    name: 'Your answers',
    contribution: 'Soil, water, terrain, surroundings and crop history you entered',
    licence: LICENCE.USER,
    attribution: 'Self-reported by the farmer on this device',
    timeoutMs: 0,
    cacheTtlMs: Number.POSITIVE_INFINITY,
    fallbackLabel: 'Not answered — "I don\'t know" was used',
    isOptional: true,
  },
});

export interface ProvenanceOverrides {
  status?: DataStatus;
  freshness?: string;
  retrievedAt?: string | null;
  isEstimated?: boolean;
  url?: string;
  cacheKey?: string;
  contribution?: string;
}

/** Build a Provenance with the exact source metadata, overridden per fetch outcome. */
export function makeProvenance(sourceId: SourceId, overrides: ProvenanceOverrides = {}): Provenance {
  const meta = SOURCE_META[sourceId];
  const status: DataStatus = overrides.status ?? 'live';
  const isEstimated = overrides.isEstimated ?? status !== 'live';
  return {
    sourceId,
    source: meta.name,
    contribution: overrides.contribution ?? meta.contribution,
    licence: meta.licence,
    attribution: meta.attribution,
    retrievedAt: overrides.retrievedAt ?? new Date().toISOString(),
    freshness: overrides.freshness ?? new Date().toISOString(),
    status,
    isEstimated,
    url: overrides.url,
    cacheKey: overrides.cacheKey,
  };
}

/** Provenance for bundled / offline sample payloads. */
export function bundledProvenance(contribution = 'Bundled sample climate, weather and soil payloads'): Provenance {
  return makeProvenance('BUNDLED', {
    status: 'bundled sample',
    freshness: CLIMATOLOGY_PERIOD,
    retrievedAt: null,
    isEstimated: true,
    contribution,
  });
}

/** Provenance for user-entered values. */
export function userProvenance(contribution = 'Field profile answers you entered'): Provenance {
  return makeProvenance('USER', {
    status: 'self-reported',
    freshness: 'entered on this device',
    retrievedAt: null,
    isEstimated: true,
    contribution,
  });
}

export interface StatusInput {
  state: DataSourceStatus['state'];
  status: DataStatus;
  startedAt?: string | null;
  completedAt?: string | null;
  durationMs?: number | null;
  error?: ApiError | null;
  fallbackUsed?: boolean;
  userVisibleLabel?: string;
  provenance: Provenance;
}

/** One consistent DataSourceStatus shape for the orchestrator, sample data and UI. */
export function makeDataSourceStatus(sourceId: SourceId, input: StatusInput): DataSourceStatus {
  const meta = SOURCE_META[sourceId];
  return {
    sourceId,
    state: input.state,
    status: input.status,
    startedAt: input.startedAt ?? null,
    completedAt: input.completedAt ?? null,
    durationMs: input.durationMs ?? null,
    timeoutMs: meta.timeoutMs,
    cacheTtlMs: meta.cacheTtlMs,
    error: input.error ?? null,
    fallbackUsed: input.fallbackUsed ?? false,
    userVisibleLabel: input.userVisibleLabel ?? meta.fallbackLabel,
    provenance: input.provenance,
  };
}
