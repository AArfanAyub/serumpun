import { openMeteoArchiveUrl, openMeteoForecastUrl } from '@/config/endpoints';
import type {
  FetchResult,
  OpenMeteoArchiveResponse,
  OpenMeteoForecastResponse,
} from '@/types/data';
import { HOUR } from '@/config/sources';
import { cacheGet, cachePut, cachedProvenance } from './cache';
import { fetchJson } from './http';

/**
 * Open-Meteo current conditions + 16-day forecast, `timezone=auto`.
 * Returns elevation, ET0 (FAO), shortwave radiation and surface soil moisture.
 */
export async function fetchForecast(
  lat: number,
  lon: number
): Promise<FetchResult<OpenMeteoForecastResponse>> {
  const url = openMeteoForecastUrl(lat, lon);
  const extra = 'forecast16';
  const cached = cacheGet<OpenMeteoForecastResponse>('OPEN_METEO', lat, lon, extra);
  if (cached) {
    return {
      ok: true,
      data: cached.payload,
      error: null,
      provenance: cachedProvenance(cached),
      fromCache: true,
    };
  }

  const result = await fetchJson<OpenMeteoForecastResponse>(url, {
    sourceId: 'OPEN_METEO',
    contribution: 'Current conditions, 16-day forecast, ET0 and timezone',
    cacheKey: extra,
  });

  if (!result.ok || !result.data) {
    const stale = cacheGet<OpenMeteoForecastResponse>('OPEN_METEO', lat, lon, extra, true);
    if (stale) {
      return {
        ok: true,
        data: stale.payload,
        error: result.error,
        provenance: cachedProvenance(stale),
        fromCache: true,
      };
    }
    return { ...result, data: null };
  }

  cachePut('OPEN_METEO', lat, lon, result.data, result.provenance, 3 * HOUR, extra);
  return result;
}

/** Optional 5-year rainfall reliability context (P1). Failure simply hides the view. */
export async function fetchArchive(
  lat: number,
  lon: number,
  startDate: string,
  endDate: string
): Promise<FetchResult<OpenMeteoArchiveResponse>> {
  const url = openMeteoArchiveUrl(lat, lon, startDate, endDate);
  const extra = `archive:${startDate}:${endDate}`;
  const cached = cacheGet<OpenMeteoArchiveResponse>('OPEN_METEO', lat, lon, extra);
  if (cached) {
    return {
      ok: true,
      data: cached.payload,
      error: null,
      provenance: cachedProvenance(cached),
      fromCache: true,
    };
  }
  const result = await fetchJson<OpenMeteoArchiveResponse>(url, {
    sourceId: 'OPEN_METEO',
    timeoutMs: 10_000,
    contribution: 'Five-year historical rainfall reliability',
    cacheKey: extra,
  });
  if (result.ok && result.data) {
    cachePut('OPEN_METEO', lat, lon, result.data, result.provenance, undefined, extra);
  }
  return result;
}
