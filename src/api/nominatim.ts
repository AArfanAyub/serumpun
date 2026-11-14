import { NOMINATIM_USER_AGENT, nominatimReverseUrl } from '@/config/endpoints';
import type { FetchResult, NominatimResponse } from '@/types/data';
import { cacheGet, cachePut, cachedProvenance } from './cache';
import { fetchJson } from './http';

let lastCallAt = 0;

/** Respect the Nominatim policy: at most one request per second, descriptive identification. */
async function throttle(): Promise<void> {
  const elapsed = Date.now() - lastCallAt;
  if (lastCallAt > 0 && elapsed < 1000) {
    await new Promise<void>((resolve) => setTimeout(resolve, 1000 - elapsed));
  }
  lastCallAt = Date.now();
}

/** Optional reverse geocoding. Failure yields "Area not named" and never blocks. */
export async function reverseGeocode(
  lat: number,
  lon: number
): Promise<FetchResult<NominatimResponse>> {
  const url = nominatimReverseUrl(lat, lon);
  const extra = 'reverse-z10';
  const cached = cacheGet<NominatimResponse>('NOMINATIM', lat, lon, extra);
  if (cached) {
    return {
      ok: true,
      data: cached.payload,
      error: null,
      provenance: cachedProvenance(cached),
      fromCache: true,
    };
  }

  await throttle();
  const result = await fetchJson<NominatimResponse>(url, {
    sourceId: 'NOMINATIM',
    contribution: 'Human-readable place name and admin area',
    cacheKey: extra,
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'en',
      'User-Agent': NOMINATIM_USER_AGENT,
    },
  });

  if (!result.ok || !result.data) {
    return { ...result, data: null };
  }

  cachePut('NOMINATIM', lat, lon, result.data, result.provenance, undefined, extra);
  return result;
}
