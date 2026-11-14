import { geocodeUrl } from '@/config/endpoints';
import { makeProvenance } from '@/config/sources';
import type { FetchResult, GeocodeResponse, Provenance } from '@/types/data';
import type { FieldLocation } from '@/types/domain';
import { cacheGet, cachePut, cachedProvenance } from './cache';
import { fetchJson } from './http';

export interface PlaceHit {
  name: string;
  latitude: number;
  longitude: number;
  adminContext: string;
  country: string;
  elevationM: number | null;
  timezone: string | null;
}

function mapResults(payload: GeocodeResponse): PlaceHit[] {
  const results = payload.results ?? [];
  return results
    .filter((hit) => Number.isFinite(hit.latitude) && Number.isFinite(hit.longitude))
    .map((hit) => {
      const parts = [hit.admin2, hit.admin1, hit.country].filter(
        (part): part is string => typeof part === 'string' && part.length > 0
      );
      return {
        name: hit.name ?? 'Unnamed place',
        latitude: hit.latitude,
        longitude: hit.longitude,
        adminContext: parts.join(', '),
        country: hit.country ?? '',
        elevationM: typeof hit.elevation === 'number' ? hit.elevation : null,
        timezone: hit.timezone ?? null,
      };
    });
}

/** Open-Meteo geocoding. Cached by normalised query; failure never throws. */
export async function searchPlaces(query: string): Promise<FetchResult<PlaceHit[]>> {
  const trimmed = query.trim();
  const extra = `geo:${trimmed.toLowerCase()}`;
  const url = geocodeUrl(trimmed);

  const cached = cacheGet<PlaceHit[]>('OPEN_METEO', 0, 0, extra);
  if (cached) {
    return {
      ok: true,
      data: cached.payload,
      error: null,
      provenance: cachedProvenance(cached),
      fromCache: true,
    };
  }

  const result = await fetchJson<GeocodeResponse>(url, {
    sourceId: 'OPEN_METEO',
    contribution: 'Place-name search (village / town to coordinates)',
    cacheKey: extra,
  });

  if (!result.ok || !result.data) {
    const stale = cacheGet<PlaceHit[]>('OPEN_METEO', 0, 0, extra, true);
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

  const hits = mapResults(result.data);
  cachePut('OPEN_METEO', 0, 0, hits, result.provenance, undefined, extra);
  return { ...result, data: hits };
}

/** Build a FieldLocation from GPS / draggable pin / manual coordinates. */
export function locationFromCoordinates(
  resolvedBy: 'gps' | 'pin' | 'manual' | 'search',
  latitude: number,
  longitude: number,
  placeName: string | null = null,
  adminContext: string | null = null,
  elevationM: number | null = null,
  timezone: string = 'UTC',
  isCoarse = false,
  source: 'OPEN_METEO' | 'USER' = 'USER'
): FieldLocation {
  return {
    latitude,
    longitude,
    elevationM,
    placeName,
    adminContext,
    timezone,
    resolvedBy,
    isCoarse,
    source,
    retrievedAt: new Date().toISOString(),
  };
}

export function geocodeProvenance(status: 'live' | 'cached' | 'estimated' = 'live'): Provenance {
  return makeProvenance('OPEN_METEO', {
    status,
    contribution: 'Place-name search (village / town to coordinates)',
    freshness: status === 'cached' ? 'cached place search' : new Date().toISOString(),
    isEstimated: status === 'estimated',
  });
}
