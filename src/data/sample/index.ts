import type {
  GeocodeResponse,
  NominatimResponse,
  OpenMeteoForecastResponse,
  PowerClimatologyResponse,
  Provenance,
  RawSiteData,
  SoilGridsResponse,
  SourceId,
} from '@/types/data';
import type { Month } from '@/types/ui';
import { bundledProvenance, makeDataSourceStatus, userProvenance } from '@/config/sources';
import { OFFLINE_SAMPLE_LABEL, CLIMATOLOGY_PERIOD } from '@/config/attribution';

import powerJson from './samplePowerClimatology.json';
import forecastJson from './sampleOpenMeteoForecast.json';
import geocodeJson from './sampleGeocode.json';
import nominatimJson from './sampleNominatim.json';
import soilJson from './sampleSoilGrids.json';

/** Bundled, real-shaped payloads. Always available, even on a first run with no network. */
export const SAMPLE_POWER: PowerClimatologyResponse = powerJson as unknown as PowerClimatologyResponse;
export const SAMPLE_FORECAST: OpenMeteoForecastResponse =
  forecastJson as unknown as OpenMeteoForecastResponse;
export const SAMPLE_GEOCODE: GeocodeResponse = geocodeJson as unknown as GeocodeResponse;
export const SAMPLE_NOMINATIM: NominatimResponse = nominatimJson as unknown as NominatimResponse;
export const SAMPLE_SOILGRIDS: SoilGridsResponse = soilJson as unknown as SoilGridsResponse;

/**
 * A SoilGrids payload with `mean: null` on every layer. Used to exercise the normal
 * no-data path in tests and to demonstrate that a null mean never blocks a recommendation.
 */
export const SAMPLE_SOILGRIDS_NULL: SoilGridsResponse = {
  type: 'Feature',
  properties: {
    layers: [
      {
        name: 'phh2o',
        unit_measure: { d_factor: 10 },
        depths: [{ label: '0-5cm', values: { mean: null } }],
      },
      {
        name: 'clay',
        unit_measure: { d_factor: 10 },
        depths: [{ label: '0-5cm', values: { mean: null } }],
      },
      {
        name: 'sand',
        unit_measure: { d_factor: 10 },
        depths: [{ label: '0-5cm', values: { mean: null } }],
      },
    ],
  },
};

export { sampleLocation, SAMPLE_TIMEZONE, SAMPLE_PLACE_NAME } from './sampleLocation';

const OFFLINE_SOURCE_NAMES: Readonly<Record<string, string>> = Object.freeze({
  NASA_POWER: 'NASA POWER (bundled sample)',
  OPEN_METEO: 'Open-Meteo (bundled sample)',
  SOILGRIDS: 'ISRIC SoilGrids (bundled sample)',
  NOMINATIM: 'Nominatim (bundled sample)',
  NASA_GIBS: 'NASA GIBS (bundled sample)',
});

function offlineProv(contribution: string, sourceId: SourceId): Provenance {
  const base = bundledProvenance(contribution);
  return {
    ...base,
    sourceId,
    source: OFFLINE_SOURCE_NAMES[sourceId] ?? base.source,
    licence: base.licence,
    freshness: sourceId === 'NASA_POWER' ? CLIMATOLOGY_PERIOD : OFFLINE_SAMPLE_LABEL,
    status: 'bundled sample',
    isEstimated: true,
  };
}

/**
 * Build a complete RawSiteData from bundled payloads only.
 * Every provenance entry is `bundled sample` + `isEstimated: true`, and the app status is
 * `Offline sample`. No fetch, no clock, no randomness — safe for tests and first-run offline.
 *
 * @param targetMonth canonical 1..12 month passed in by the caller (determinism).
 * @param reason optional caller-side note; the payload itself carries no diagnostics.
 */
export function buildOfflineRaw(targetMonth: Month, reason = 'No network connection'): RawSiteData {
  void reason;
  const powerProv = offlineProv('Bundled NASA POWER-shaped long-term monthly climate', 'NASA_POWER');
  const forecastProv = offlineProv('Bundled Open-Meteo-shaped current and 16-day forecast', 'OPEN_METEO');
  const soilProv = offlineProv('Bundled SoilGrids-shaped soil estimate', 'SOILGRIDS');
  const nominatimProv = offlineProv('Bundled sample place name', 'NOMINATIM');
  const archiveProv = offlineProv('Bundled sample historical context', 'OPEN_METEO');
  const bundledProv = bundledProvenance('Crop database and offline sample payloads');

  const statuses = [
    makeDataSourceStatus('NASA_POWER', {
      state: 'degraded',
      status: 'bundled sample',
      fallbackUsed: true,
      userVisibleLabel: 'Using long-term average sample data',
      provenance: powerProv,
    }),
    makeDataSourceStatus('OPEN_METEO', {
      state: 'degraded',
      status: 'bundled sample',
      fallbackUsed: true,
      userVisibleLabel: 'Live weather unavailable — showing sample data',
      provenance: forecastProv,
    }),
    makeDataSourceStatus('SOILGRIDS', {
      state: 'degraded',
      status: 'bundled sample',
      fallbackUsed: true,
      userVisibleLabel: 'Soil service unavailable — please pick your soil type',
      provenance: soilProv,
    }),
    makeDataSourceStatus('NOMINATIM', {
      state: 'degraded',
      status: 'bundled sample',
      fallbackUsed: true,
      userVisibleLabel: 'Place name unavailable — showing sample place',
      provenance: nominatimProv,
    }),
    makeDataSourceStatus('BUNDLED', {
      state: 'ok',
      status: 'bundled sample',
      userVisibleLabel: OFFLINE_SAMPLE_LABEL,
      provenance: bundledProv,
    }),
    makeDataSourceStatus('USER', {
      state: 'idle',
      status: 'self-reported',
      userVisibleLabel: 'Not answered yet — "I don\'t know" will be used',
      provenance: userProvenance(),
    }),
  ];

  return {
    power: SAMPLE_POWER,
    forecast: SAMPLE_FORECAST,
    soil: SAMPLE_SOILGRIDS,
    nominatim: SAMPLE_NOMINATIM,
    archive: null,
    powerProv,
    forecastProv,
    soilProv,
    nominatimProv,
    archiveProv,
    bundledProv,
    sources: statuses,
    appStatus: 'Offline sample',
    targetMonth,
  };
}
