import { soilGridsUrl } from '@/config/endpoints';
import type { FetchResult, SoilGridsResponse } from '@/types/data';
import { cacheGet, cachePut, cachedProvenance } from './cache';
import { fetchJson } from './http';

function hasUsableMean(payload: SoilGridsResponse): boolean {
  const layers = payload.properties?.layers ?? [];
  return layers.some((layer) => {
    const mean = layer.depths?.[0]?.values?.mean;
    return typeof mean === 'number' && Number.isFinite(mean);
  });
}

/**
 * ISRIC SoilGrids v2 — OPTIONAL enrichment, never a blocker.
 * 8-second HARD AbortController timeout (via fetchJson), coordinate-rounded cache,
 * `mean: null` treated as normal no-data. On any failure the UI shows a manual soil
 * picker labelled "estimated / self-reported"; a recommendation is still produced.
 */
export async function fetchSoil(
  lat: number,
  lon: number
): Promise<FetchResult<SoilGridsResponse>> {
  const url = soilGridsUrl(lat, lon);
  const extra = 'soil-0-5cm';
  const cached = cacheGet<SoilGridsResponse>('SOILGRIDS', lat, lon, extra);
  if (cached) {
    return {
      ok: true,
      data: hasUsableMean(cached.payload) ? cached.payload : null,
      error: hasUsableMean(cached.payload)
        ? null
        : {
            sourceId: 'SOILGRIDS',
            kind: 'null-mean',
            message: 'Soil data was empty for this spot — please pick your soil type.',
            at: new Date().toISOString(),
          },
      provenance: cachedProvenance(cached),
      fromCache: true,
    };
  }

  const result = await fetchJson<SoilGridsResponse>(url, {
    sourceId: 'SOILGRIDS',
    timeoutMs: 8_000,
    contribution: 'Optional estimated soil pH, texture and organic carbon',
    cacheKey: extra,
  });

  if (!result.ok || !result.data) {
    return { ...result, data: null };
  }

  if (!hasUsableMean(result.data)) {
    // A null mean is a NORMAL outcome, not an exception. Cache it so we do not retry
    // a known-empty pixel every session, but surface it as a no-data result.
    cachePut('SOILGRIDS', lat, lon, result.data, result.provenance, undefined, extra);
    return {
      ...result,
      ok: false,
      data: null,
      error: {
        sourceId: 'SOILGRIDS',
        kind: 'null-mean',
        message: 'Soil data was empty for this spot — please pick your soil type.',
        at: new Date().toISOString(),
      },
      provenance: {
        ...result.provenance,
        status: 'estimated',
        isEstimated: true,
        freshness: 'Not available right now',
      },
    };
  }

  cachePut('SOILGRIDS', lat, lon, result.data, result.provenance, undefined, extra);
  return result;
}
