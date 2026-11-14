import { powerClimatologyUrl, powerMonthlyUrl } from '@/config/endpoints';
import type {
  FetchResult,
  PowerClimatologyResponse,
  PowerMonthlyResponse,
} from '@/types/data';
import { cacheGet, cachePut, cachedProvenance } from './cache';
import { fetchJson } from './http';

/**
 * NASA POWER climatology — the reliable backbone. 9 verified AG parameters, returned as
 * JAN..DEC + ANN. `PRECTOTCORR` is mm/day here; normalisation converts it to monthly mm.
 */
export async function fetchClimatology(
  lat: number,
  lon: number
): Promise<FetchResult<PowerClimatologyResponse>> {
  const url = powerClimatologyUrl(lat, lon);
  const extra = 'climatology';
  const cached = cacheGet<PowerClimatologyResponse>('NASA_POWER', lat, lon, extra);
  if (cached) {
    return {
      ok: true,
      data: cached.payload,
      error: null,
      provenance: cachedProvenance(cached),
      fromCache: true,
    };
  }

  const result = await fetchJson<PowerClimatologyResponse>(url, {
    sourceId: 'NASA_POWER',
    contribution: 'Long-term monthly climate, soil wetness and elevation',
    cacheKey: extra,
  });

  if (!result.ok || !result.data) {
    const stale = cacheGet<PowerClimatologyResponse>('NASA_POWER', lat, lon, extra, true);
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

  const hasParameters = Object.keys(result.data.properties?.parameter ?? {}).length > 0;
  if (!hasParameters) {
    return {
      ...result,
      ok: false,
      data: null,
      error: {
        sourceId: 'NASA_POWER',
        kind: 'parse',
        message: 'The climate service returned an empty answer. Using an estimate instead.',
        at: new Date().toISOString(),
      },
    };
  }

  cachePut('NASA_POWER', lat, lon, result.data, result.provenance, undefined, extra);
  return result;
}

/** Optional recent-month series (P1 month override). Never required for a recommendation. */
export async function fetchMonthlyClimatology(
  lat: number,
  lon: number,
  startYear: number,
  endYear: number
): Promise<FetchResult<PowerMonthlyResponse>> {
  const url = powerMonthlyUrl(lat, lon, startYear, endYear);
  const extra = `monthly:${startYear}-${endYear}`;
  const cached = cacheGet<PowerMonthlyResponse>('NASA_POWER', lat, lon, extra);
  if (cached) {
    return {
      ok: true,
      data: cached.payload,
      error: null,
      provenance: cachedProvenance(cached),
      fromCache: true,
    };
  }
  const result = await fetchJson<PowerMonthlyResponse>(url, {
    sourceId: 'NASA_POWER',
    timeoutMs: 8_000,
    contribution: 'Recent monthly climate series',
    cacheKey: extra,
  });
  if (result.ok && result.data) {
    cachePut('NASA_POWER', lat, lon, result.data, result.provenance, undefined, extra);
  }
  return result;
}
