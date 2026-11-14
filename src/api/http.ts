import { assertAllowed, hostOf } from '@/config/endpoints';
import { makeProvenance, SOURCE_META } from '@/config/sources';
import type { ApiError, FetchResult, Provenance, SourceId } from '@/types/data';

export { assertAllowed, hostOf } from '@/config/endpoints';

export interface FetchOptions {
  sourceId: SourceId;
  timeoutMs?: number;
  headers?: Record<string, string>;
  contribution?: string;
  cacheKey?: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function failed<T>(
  sourceId: SourceId,
  base: Provenance,
  error: ApiError
): FetchResult<T> {
  return {
    ok: false,
    data: null,
    error,
    provenance: {
      ...base,
      status: 'estimated',
      isEstimated: true,
      freshness: 'Not available right now',
    },
    fromCache: false,
  };
}

/**
 * The ONLY network function in the app.
 *
 * Order is deliberate: `assertAllowed(url)` runs BEFORE any network activity, then an
 * `AbortController` bounds the request. Every failure is converted into an `ApiError` +
 * `FetchResult{ok:false}` — nothing ever throws across the `api/` module boundary.
 */
export async function fetchJson<T>(url: string, options: FetchOptions): Promise<FetchResult<T>> {
  const meta = SOURCE_META[options.sourceId];
  const timeoutMs = options.timeoutMs ?? meta.timeoutMs;
  const base: Provenance = makeProvenance(options.sourceId, {
    url,
    cacheKey: options.cacheKey,
    contribution: options.contribution,
  });

  try {
    assertAllowed(url);
  } catch {
    return failed<T>(options.sourceId, base, {
      sourceId: options.sourceId,
      kind: 'blocked-host',
      message: 'That data host is not on the allowed list.',
      at: nowIso(),
    });
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return failed<T>(options.sourceId, base, {
      sourceId: options.sourceId,
      kind: 'offline',
      message: 'No network connection right now.',
      at: nowIso(),
    });
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: options.headers ?? {},
      signal: controller.signal,
      mode: 'cors',
      cache: 'no-store',
    });

    if (!response.ok) {
      return failed<T>(options.sourceId, base, {
        sourceId: options.sourceId,
        kind: 'http',
        message: 'The data service did not answer. Using an estimate instead.',
        statusCode: response.status,
        at: nowIso(),
      });
    }

    const text = await response.text();
    let parsed: T;
    try {
      parsed = JSON.parse(text) as T;
    } catch {
      return failed<T>(options.sourceId, base, {
        sourceId: options.sourceId,
        kind: 'parse',
        message: 'The data service sent an unreadable answer. Using an estimate instead.',
        at: nowIso(),
      });
    }

    return {
      ok: true,
      data: parsed,
      error: null,
      provenance: base,
      fromCache: false,
    };
  } catch {
    const kind: ApiError['kind'] = timedOut ? 'timeout' : 'offline';
    return failed<T>(options.sourceId, base, {
      sourceId: options.sourceId,
      kind,
      message: timedOut
        ? 'The data service took too long. Using an estimate instead.'
        : 'Could not reach the data service. Using an estimate instead.',
      at: nowIso(),
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Plain-language label for an ApiError, never an error code. */
export function errorToLabel(error: ApiError | null): string {
  if (!error) return '';
  switch (error.kind) {
    case 'timeout':
      return 'Some data took too long to load, so it is estimated';
    case 'http':
      return 'Some data was unavailable, so it is estimated';
    case 'parse':
      return 'Some data was unreadable, so it is estimated';
    case 'null-mean':
      return 'Soil data was empty for this spot — please pick your soil type';
    case 'offline':
      return 'No connection — using bundled sample data';
    case 'rate-limit':
      return 'Place name service is busy — showing coordinates instead';
    case 'blocked-host':
      return 'That data host is not allowed';
    default:
      return 'Some data is estimated';
  }
}
