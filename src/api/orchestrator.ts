import { makeDataSourceStatus, makeProvenance, SOURCE_META } from '@/config/sources';
import { CLIMATOLOGY_PERIOD } from '@/config/attribution';
import {
  buildOfflineRaw,
  sampleLocation,
  SAMPLE_FORECAST,
  SAMPLE_NOMINATIM,
  SAMPLE_POWER,
  SAMPLE_SOILGRIDS,
} from '@/data/sample';
import { defaultProfile } from '@/normalize/merge';
import { toSiteConditions } from '@/normalize/normalize';
import { deviceTimezone, monthFromTimezone } from '@/normalize/units';
import type {
  ApiError,
  AppDataStatus,
  DataSourceStatus,
  FetchResult,
  LocationInput,
  NominatimResponse,
  OpenMeteoForecastResponse,
  PowerClimatologyResponse,
  Provenance,
  RawSiteData,
  SoilGridsResponse,
  SourceId,
} from '@/types/data';
import type { FieldLocation, FieldProfile, SiteConditions } from '@/types/domain';
import type { Month } from '@/types/ui';
import { locationFromCoordinates, searchPlaces } from './geocode';
import { reverseGeocode } from './nominatim';
import { fetchForecast } from './openMeteo';
import { fetchClimatology } from './power';
import { fetchSoil } from './soilGrids';

export interface ResolvedLocation {
  location: FieldLocation;
  provenance: Provenance[];
  statuses: DataSourceStatus[];
  note: string | null;
}

export interface FetchSiteOptions {
  forcedOffline?: boolean;
  locationExtras?: { provenance: Provenance[]; statuses: DataSourceStatus[] };
  profile?: FieldProfile;
  targetMonth?: Month;
}

function isoNow(): string {
  return new Date().toISOString();
}

function unexpectedFailure<T>(sourceId: SourceId): FetchResult<T> {
  return {
    ok: false,
    data: null,
    error: {
      sourceId,
      kind: 'offline',
      message: 'The data service could not be reached. Using an estimate instead.',
      at: isoNow(),
    },
    provenance: makeProvenance(sourceId, {
      status: 'estimated',
      isEstimated: true,
      freshness: 'Not available right now',
    }),
    fromCache: false,
  };
}

async function safe<T>(sourceId: SourceId, fn: () => Promise<FetchResult<T>>): Promise<FetchResult<T>> {
  try {
    return await fn();
  } catch {
    return unexpectedFailure<T>(sourceId);
  }
}

function bundledPowerProv(): Provenance {
  return makeProvenance('NASA_POWER', {
    status: 'bundled sample',
    freshness: CLIMATOLOGY_PERIOD,
    isEstimated: true,
    contribution: 'Bundled long-term monthly climate sample',
  });
}

function estimatedProv(sourceId: SourceId, contribution: string): Provenance {
  return makeProvenance(sourceId, {
    status: 'estimated',
    freshness: 'Not available right now',
    isEstimated: true,
    contribution,
  });
}

/** Geocoding is the prerequisite; it resolves coordinates before any climate fetch. */
export async function resolveLocation(input: LocationInput): Promise<ResolvedLocation> {
  if (input.kind === 'sample') {
    const provenance = makeProvenance('BUNDLED', {
      status: 'bundled sample',
      freshness: 'Offline sample data',
      isEstimated: true,
      contribution: 'Bundled sample field location (Central Java)',
    });
    return {
      location: sampleLocation(),
      provenance: [provenance],
      statuses: [
        makeDataSourceStatus('BUNDLED', {
          state: 'ok',
          status: 'bundled sample',
          userVisibleLabel: 'Offline sample data',
          provenance,
        }),
      ],
      note: null,
    };
  }

  if (input.kind === 'search') {
    const result = await safe('OPEN_METEO', () => searchPlaces(input.query));
    const hits = result.data ?? [];
    const first = hits[0];
    if (result.ok && first) {
      const location = locationFromCoordinates(
        'search',
        first.latitude,
        first.longitude,
        first.name,
        first.adminContext || first.country || null,
        first.elevationM,
        first.timezone ?? deviceTimezone(),
        true,
        'OPEN_METEO'
      );
      const provenance: Provenance = result.provenance;
      return {
        location,
        provenance: [provenance],
        statuses: [
          makeDataSourceStatus('OPEN_METEO', {
          state: 'ok',
          status: provenance.status,
            userVisibleLabel: result.fromCache ? 'Place search loaded from cache' : 'Place search worked',
            error: result.error,
            provenance,
          }),
        ],
        note: null,
      };
    }

    const location = sampleLocation();
    const provenance = makeProvenance('BUNDLED', {
      status: 'bundled sample',
      freshness: 'Offline sample data',
      isEstimated: true,
      contribution: 'Bundled sample location used because place search found nothing',
    });
    return {
      location,
      provenance: [provenance],
      statuses: [
        makeDataSourceStatus('OPEN_METEO', {
          state: 'failed',
          status: 'estimated',
          fallbackUsed: true,
          error: result.error,
          userVisibleLabel: 'Place search unavailable — type coordinates or drop a pin',
          provenance: result.provenance,
        }),
      ],
      note: 'We could not find that place. Showing a sample field for now — you can type coordinates or drop a pin instead.',
    };
  }

  const isCoords = input.kind === 'coords';
  const contribution = isCoords
    ? 'Coordinates from the place you chose in the search results'
    : input.kind === 'gps'
      ? 'Coordinates from your device location'
      : input.kind === 'pin'
        ? 'Coordinates from the map pin you dropped'
        : 'Coordinates you typed';

  const location = locationFromCoordinates(
    isCoords ? 'search' : input.kind,
    input.latitude,
    input.longitude,
    isCoords ? input.placeName ?? null : null,
    isCoords ? input.adminContext ?? null : null,
    isCoords ? input.elevationM ?? null : null,
    (isCoords ? input.timezone : undefined) ?? deviceTimezone(),
    isCoords ? (input.isCoarse ?? true) : input.kind === 'gps',
    isCoords ? 'OPEN_METEO' : 'USER'
  );
  const provenance = makeProvenance(isCoords ? 'OPEN_METEO' : 'USER', {
    status: isCoords ? 'live' : 'self-reported',
    freshness: isCoords ? 'place search result' : 'entered on this device',
    isEstimated: !isCoords,
    contribution,
  });
  return {
    location,
    provenance: [provenance],
    statuses: [
      makeDataSourceStatus(isCoords ? 'OPEN_METEO' : 'USER', {
        state: 'ok',
        status: isCoords ? 'live' : 'self-reported',
        userVisibleLabel: isCoords ? 'Place chosen from search results' : 'Location set on this device',
        provenance,
      }),
    ],
    note: null,
  };
}

type FetchBundle = [
  FetchResult<PowerClimatologyResponse>,
  FetchResult<OpenMeteoForecastResponse>,
  FetchResult<SoilGridsResponse>,
  FetchResult<NominatimResponse>,
];

function offlineFetchBundle(): FetchBundle {
  return [
    unexpectedFailure<PowerClimatologyResponse>('NASA_POWER'),
    unexpectedFailure<OpenMeteoForecastResponse>('OPEN_METEO'),
    unexpectedFailure<SoilGridsResponse>('SOILGRIDS'),
    unexpectedFailure<NominatimResponse>('NOMINATIM'),
  ];
}

async function liveFetchBundle(location: FieldLocation): Promise<FetchBundle> {
  const settled = await Promise.allSettled([
    safe('NASA_POWER', () => fetchClimatology(location.latitude, location.longitude)),
    safe('OPEN_METEO', () => fetchForecast(location.latitude, location.longitude)),
    safe('SOILGRIDS', () => fetchSoil(location.latitude, location.longitude)),
    safe('NOMINATIM', () => reverseGeocode(location.latitude, location.longitude)),
  ]);
  const ids: SourceId[] = ['NASA_POWER', 'OPEN_METEO', 'SOILGRIDS', 'NOMINATIM'];
  const unwrap = <T>(index: number): FetchResult<T> => {
    const item = settled[index];
    if (item && item.status === 'fulfilled') return item.value as FetchResult<T>;
    return unexpectedFailure<T>(ids[index] ?? 'NASA_POWER');
  };
  return [
    unwrap<PowerClimatologyResponse>(0),
    unwrap<OpenMeteoForecastResponse>(1),
    unwrap<SoilGridsResponse>(2),
    unwrap<NominatimResponse>(3),
  ];
}

function statusFromResult<T>(
  sourceId: SourceId,
  result: FetchResult<T>,
  ok: boolean,
  fallbackUsed: boolean,
  userVisibleLabel: string
): DataSourceStatus {
  return makeDataSourceStatus(sourceId, {
    state: ok ? 'ok' : 'degraded',
    status: ok ? result.provenance.status : 'estimated',
    error: result.error,
    fallbackUsed,
    userVisibleLabel: ok ? userVisibleLabel : SOURCE_META[sourceId].fallbackLabel,
    provenance: result.provenance,
  });
}

/**
 * R-02 backbone: parallel fetches with `Promise.allSettled`, per-source timeouts,
 * per-source error isolation, coordinate-rounded cache, degraded-state machine and a
 * complete bundled sample fallback. Nothing throws to the UI.
 */
export async function fetchSite(
  location: FieldLocation,
  options: FetchSiteOptions = {}
): Promise<SiteConditions> {
  const profile = options.profile ?? defaultProfile();
  const extras = options.locationExtras ?? { provenance: [], statuses: [] };
  const online = typeof navigator === 'undefined' ? true : navigator.onLine !== false;
  const forcedOffline = options.forcedOffline === true || !online;

  const fetchBundle: FetchBundle = forcedOffline
    ? offlineFetchBundle()
    : await liveFetchBundle(location);
  const [powerResult, forecastResult, soilResult, nominatimResult] = fetchBundle;

  const powerOk = powerResult.ok && powerResult.data !== null;
  const forecastOk = forecastResult.ok && forecastResult.data !== null;
  const soilOk = soilResult.ok && soilResult.data !== null;
  const nominatimOk = nominatimResult.ok && nominatimResult.data !== null;

  const timezone = forecastOk
    ? forecastResult.data?.timezone ?? location.timezone
    : location.timezone || deviceTimezone();
  const targetMonth = options.targetMonth ?? monthFromTimezone(timezone);

  // All backbone sources failed -> the honest, complete Offline sample path.
  if (!powerOk && !forecastOk) {
    const raw = buildOfflineRaw(targetMonth, 'All climate sources failed');
    return toSiteConditions(raw, { ...location, timezone }, profile, extras);
  }

  const power: PowerClimatologyResponse =
    powerOk && powerResult.data ? powerResult.data : SAMPLE_POWER;
  const powerProv: Provenance = powerOk ? powerResult.provenance : bundledPowerProv();

  const forecast: OpenMeteoForecastResponse | null =
    forecastOk && forecastResult.data ? forecastResult.data : null;
  const forecastProv: Provenance = forecastOk
    ? forecastResult.provenance
    : estimatedProv('OPEN_METEO', 'Current conditions estimated from long-term averages');

  const soil: SoilGridsResponse | null = soilOk && soilResult.data ? soilResult.data : null;
  const soilProv: Provenance = soilOk
    ? { ...soilResult.provenance, isEstimated: true }
    : {
        ...estimatedProv('SOILGRIDS', 'Soil estimate unavailable — manual picker in use'),
        status: 'self-reported',
      };

  const nominatim: NominatimResponse | null =
    nominatimOk && nominatimResult.data ? nominatimResult.data : null;
  const nominatimProv: Provenance = nominatimOk
    ? nominatimResult.provenance
    : estimatedProv('NOMINATIM', 'Place name unavailable — showing coordinates');

  const anyCached =
    powerResult.fromCache || forecastResult.fromCache || soilResult.fromCache || nominatimResult.fromCache;
  const anyDegraded = !powerOk || !forecastOk || !soilOk || !nominatimOk || anyCached;
  const appStatus: AppDataStatus = anyDegraded ? 'Partly estimated' : 'Live';

  const sources: DataSourceStatus[] = [
    statusFromResult(
      'NASA_POWER',
      powerResult,
      powerOk,
      !powerOk,
      powerResult.fromCache ? 'Climate loaded from cache' : 'Long-term climate is live'
    ),
    statusFromResult(
      'OPEN_METEO',
      forecastResult,
      forecastOk,
      !forecastOk,
      forecastResult.fromCache ? 'Weather loaded from cache' : 'Current weather is live'
    ),
    statusFromResult(
      'SOILGRIDS',
      soilResult,
      soilOk,
      !soilOk,
      'Soil estimate loaded (always labelled estimated)'
    ),
    statusFromResult(
      'NOMINATIM',
      nominatimResult,
      nominatimOk,
      !nominatimOk,
      'Place name is live'
    ),
    makeDataSourceStatus('BUNDLED', {
      state: 'ok',
      status: powerOk ? 'estimated' : 'bundled sample',
      fallbackUsed: !powerOk,
      userVisibleLabel: powerOk ? 'Crop database bundled locally' : 'Offline sample data',
      provenance: makeProvenance('BUNDLED', {
        status: powerOk ? 'estimated' : 'bundled sample',
        freshness: powerOk ? 'in-app static data' : 'Offline sample data',
        isEstimated: true,
        contribution: 'Crop database and bundled sample payloads',
      }),
    }),
    makeDataSourceStatus('USER', {
      state: 'idle',
      status: 'self-reported',
      userVisibleLabel: 'Your field answers are stored only on this device',
      provenance: makeProvenance('USER', {
        status: 'self-reported',
        freshness: 'entered on this device',
        isEstimated: true,
        contribution: 'Field profile answers',
      }),
    }),
  ];

  const bundledProv = makeProvenance('BUNDLED', {
    status: powerOk ? 'estimated' : 'bundled sample',
    freshness: powerOk ? 'in-app static data' : 'Offline sample data',
    isEstimated: true,
    contribution: 'Crop database and bundled sample payloads',
  });

  const raw: RawSiteData = {
    power,
    forecast,
    soil,
    nominatim,
    archive: null,
    powerProv,
    forecastProv,
    soilProv,
    nominatimProv,
    archiveProv: estimatedProv('OPEN_METEO', 'Historical reliability view unavailable'),
    bundledProv,
    sources,
    appStatus,
    targetMonth,
  };

  return toSiteConditions(raw, { ...location, timezone }, profile, extras);
}

/** Convenience selector used by the UI and tests. */
export function getDataSourceStatuses(site: SiteConditions): DataSourceStatus[] {
  return site.sources;
}

/** Fully offline, deterministic site used by the welcome offline button and integration tests. */
export function offlineSite(
  location: FieldLocation = sampleLocation(),
  profile: FieldProfile = defaultProfile(),
  targetMonth: Month = monthFromTimezone(location.timezone)
): SiteConditions {
  return toSiteConditions(buildOfflineRaw(targetMonth), location, profile);
}

export { SAMPLE_FORECAST, SAMPLE_NOMINATIM, SAMPLE_POWER, SAMPLE_SOILGRIDS };
export type { ApiError };
