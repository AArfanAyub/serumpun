import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchJson, errorToLabel } from '@/api/http';
import { BlockedHostError } from '@/config/endpoints';
import type { ApiError } from '@/types/data';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

describe('fetchJson: allowlist guard runs before any network activity', () => {
  it('blocks a forbidden host without calling fetch and never throws', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const result = await fetchJson<{ data: string }>('https://overpass-api.de/api/interpreter', {
      sourceId: 'NASA_POWER',
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    expect(result.data).toBeNull();
    expect(result.error?.kind).toBe('blocked-host');
    expect(result.provenance.isEstimated).toBe(true);
    expect(result.provenance.status).toBe('estimated');
    expect(result.fromCache).toBe(false);
  });

  it('blocks an unparseable URL too', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const result = await fetchJson('not-a-url', { sourceId: 'OPEN_METEO' });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.error?.kind).toBe('blocked-host');
  });

  it('allows an allowlisted host and passes an AbortSignal', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchSpy = vi.fn(async (url: string, init: RequestInit): Promise<Response> => {
      calls.push({ url, init });
      return jsonResponse({ hello: 'world' });
    });
    vi.stubGlobal('fetch', fetchSpy);

    const result = await fetchJson<{ hello: string }>(
      'https://api.open-meteo.com/v1/forecast?latitude=1',
      { sourceId: 'OPEN_METEO', timeoutMs: 5000, contribution: 'test' }
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    expect(result.data?.hello).toBe('world');
    expect(result.provenance.isEstimated).toBe(false);
    const init = calls[0]?.init;
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(init?.method).toBe('GET');
    expect(init?.cache).toBe('no-store');
    expect(calls[0]?.url).toContain('api.open-meteo.com');
  });

  it('converts HTTP errors, parse errors and rejections into non-throwing FetchResult', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({}, false, 503)));
    const httpResult = await fetchJson('https://power.larc.nasa.gov/api/temporal/climatology/point', {
      sourceId: 'NASA_POWER',
    });
    expect(httpResult.ok).toBe(false);
    expect(httpResult.error?.kind).toBe('http');
    expect(httpResult.error?.statusCode).toBe(503);

    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, text: async () => 'not-json' })));
    const parseResult = await fetchJson('https://rest.isric.org/soilgrids/v2.0/properties/query', {
      sourceId: 'SOILGRIDS',
    });
    expect(parseResult.ok).toBe(false);
    expect(parseResult.error?.kind).toBe('parse');

    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }));
    const offlineResult = await fetchJson('https://geocoding-api.open-meteo.com/v1/search', {
      sourceId: 'OPEN_METEO',
    });
    expect(offlineResult.ok).toBe(false);
    expect(offlineResult.error?.kind).toBe('offline');
  });

  it('honours navigator.onLine === false without touching the network', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('navigator', { onLine: false });
    const result = await fetchJson('https://api.open-meteo.com/v1/forecast', {
      sourceId: 'OPEN_METEO',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.error?.kind).toBe('offline');
  });
});

describe('plain-language error labels and the allowlist helper', () => {
  it('never exposes raw codes to the farmer', () => {
    const kinds: ApiError['kind'][] = [
      'timeout', 'http', 'parse', 'null-mean', 'offline', 'rate-limit', 'blocked-host',
    ];
    for (const kind of kinds) {
      const label = errorToLabel({ sourceId: 'NASA_POWER', kind, message: 'x', at: 'now' });
      expect(label.length).toBeGreaterThan(0);
      expect(label).not.toContain(kind);
    }
    expect(errorToLabel(null)).toBe('');
  });

  it('exports a BlockedHostError that carries the offending host and url', () => {
    const error = new BlockedHostError('https://evil.test/x', 'evil.test');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('BlockedHostError');
    expect(error.host).toBe('evil.test');
    expect(error.url).toBe('https://evil.test/x');
    expect(error.message).toContain('allowlist');
  });
});
