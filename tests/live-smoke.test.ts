/**
 * OPTIONAL live-network verification (QA gate, not part of the offline suite).
 *
 * Run with:  npm run verify:live      (or SERUMPUN_LIVE=1 npx vitest run tests/live-smoke.test.ts)
 *
 * Serumpun's normal test suite is deliberately 100% offline. This file is the only
 * place that touches the internet. It imports the application's REAL URL builders and
 * REAL normalisation functions (no hand-written imitation URLs), calls the keyless
 * endpoints in docs/00-research-brief.md, and proves the responses parse into the
 * same SiteConditions shapes the UI consumes.
 *
 * No API key, account, token or payment is used. Every URL must pass assertAllowed().
 * Optional / flaky sources (SoilGrids, Nominatim, archive, imagery) are reported but
 * never fail the gate; the three backbone sources are required.
 */
import { describe, expect, it } from 'vitest';
import {
  ALLOWED_HOSTS,
  assertAllowed,
  geocodeUrl,
  gibsDefaultDate,
  gibsTileUrl,
  nominatimReverseUrl,
  openMeteoArchiveUrl,
  openMeteoForecastUrl,
  osmTileUrl,
  powerClimatologyUrl,
  powerMonthlyUrl,
  soilGridsUrl,
} from '@/config/endpoints';
import {
  elevationFromPower,
  forecastToCurrent,
  meanEt0,
  powerToClimateNormals,
} from '@/normalize/climate';
import { makeProvenance } from '@/config/sources';
import type { FieldLocation } from '@/types/domain';
import type {
  OpenMeteoForecastResponse,
  PowerClimatologyResponse,
  SoilGridsResponse,
} from '@/types/data';

// npm_lifecycle_event is set by npm on Windows too, so "npm run verify:live" is
// cross-platform without adding cross-env as a dependency. `npm test` keeps this suite
// skipped, which preserves the fully-offline default test suite.
const LIVE =
  process.env.SERUMPUN_LIVE === '1' || process.env.npm_lifecycle_event === 'verify:live';
const LAT = -7.55; // Central Java smallholder reference site
const LON = 110.42;

const results: Array<{ source: string; ok: boolean; detail: string }> = [];

function record(source: string, ok: boolean, detail: string): void {
  results.push({ source, ok, detail });
  // eslint-disable-next-line no-console
  console.log(`[live] ${ok ? 'PASS' : 'INFO'} ${source}: ${detail}`);
}

async function getJson<T>(url: string, timeoutMs = 20_000): Promise<T> {
  assertAllowed(url); // same guard the app uses before every fetch
  const response = await fetch(url, {
    method: 'GET',
    signal: AbortSignal.timeout(timeoutMs),
    headers: { 'User-Agent': 'Serumpun/1.0 (keyless open-data verification)' },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as T;
}

async function getBytes(url: string, timeoutMs = 15_000): Promise<number> {
  assertAllowed(url);
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { 'User-Agent': 'Serumpun/1.0 (keyless open-data verification)' },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.arrayBuffer()).byteLength;
}

/** Optional source: report the outcome, never fail the build on a flaky free service. */
async function optional(name: string, url: string, check: () => Promise<string>): Promise<void> {
  try {
    record(name, true, await check());
  } catch (error) {
    record(name, false, `${(error as Error).message} (optional — app falls back)`);
  }
  expect(ALLOWED_HOSTS).toContain(new URL(url).hostname);
}

describe.skipIf(!LIVE)('live keyless open-data smoke test', () => {
  it('every generated URL is allowlisted and contains no credential or key', () => {
    const urls = [
      powerClimatologyUrl(LAT, LON),
      powerMonthlyUrl(LAT, LON, 2023, 2024),
      openMeteoForecastUrl(LAT, LON),
      openMeteoArchiveUrl(LAT, LON, '2025-01-01', '2025-12-31'),
      geocodeUrl('Bogor'),
      soilGridsUrl(LAT, LON),
      nominatimReverseUrl(LAT, LON),
      gibsTileUrl('MODIS_Terra_CorrectedReflectance_TrueColor', gibsDefaultDate(), 4, 8, 5),
      osmTileUrl(4, 8, 5),
    ];
    for (const url of urls) {
      expect(() => assertAllowed(url)).not.toThrow();
      expect(url).not.toMatch(/[?&](api[_-]?key|key|token|appid)=/i);
    }
  });

  it('NASA POWER climatology parses into 12 explainable monthly records', async () => {
    const url = powerClimatologyUrl(LAT, LON);
    const raw = await getJson<PowerClimatologyResponse>(url, 25_000);
    const table = (raw.properties?.parameter ?? {}) as Record<string, Record<string, number>>;
    const row = (parameter: string, key: string): number => {
      const value = table[parameter]?.[key];
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`POWER response is missing a numeric ${parameter}.${key}`);
      }
      return value;
    };

    // All nine AG parameters used by the scoring engine must be present.
    for (const parameter of [
      'T2M',
      'T2M_MAX',
      'T2M_MIN',
      'PRECTOTCORR',
      'RH2M',
      'ALLSKY_SFC_SW_DWN',
      'WS10M',
      'GWETROOT',
      'GWETTOP',
    ]) {
      expect(table[parameter], `missing POWER parameter ${parameter}`).toBeDefined();
      expect(row(parameter, 'JAN')).toBeTypeOf('number');
      expect(row(parameter, 'DEC')).toBeTypeOf('number');
      expect(row(parameter, 'ANN')).toBeTypeOf('number');
    }

    const normals = powerToClimateNormals(raw, makeProvenance('NASA_POWER'));
    expect(normals.monthly).toHaveLength(12);
    expect(normals.monthly.map((m) => m.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(normals.source).toBe('NASA_POWER');

    // CRITICAL unit gate: climatology precipitation is mm/day -> monthly mm.
    const february = normals.monthly[1];
    expect(february.precipMm).toBe(Math.round(row('PRECTOTCORR', 'FEB') * 28));
    // ANN must be stored separately, never consumed as a 13th month.
    expect(normals.annual).not.toBeNull();
    const annual = normals.annual!;
    expect(annual.precipMm).toBe(Math.round(row('PRECTOTCORR', 'ANN') * 365));
    for (const month of normals.monthly) {
      expect(Number.isFinite(month.t2mC)).toBe(true);
      expect(Number.isFinite(month.precipMm)).toBe(true);
      expect(month.gwetRoot).toBeGreaterThanOrEqual(0);
      expect(month.gwetRoot).toBeLessThanOrEqual(1);
    }

    const elevation = elevationFromPower(raw);
    expect(elevation).toBeTypeOf('number');
    record(
      'NASA POWER',
      true,
      `9 AG params x JAN..DEC+ANN; 12 months; Feb ${february.precipMm} mm; ` +
        `annual ${annual.precipMm} mm; elevation ${elevation} m`
    );
  });

  it('Open-Meteo forecast parses into current conditions + 16 forecast days', async () => {
    const raw = await getJson<OpenMeteoForecastResponse>(openMeteoForecastUrl(LAT, LON));
    expect(raw.timezone).toBeTruthy();
    const timezone = raw.timezone ?? 'UTC';
    expect(raw.elevation).toBeTypeOf('number');
    expect(raw.current?.temperature_2m).toBeTypeOf('number');
    const dayCount = raw.daily?.time?.length ?? 0;
    expect(dayCount).toBeGreaterThanOrEqual(14);

    const normals = powerToClimateNormals(null, makeProvenance('BUNDLED'));
    const location: FieldLocation = {
      latitude: LAT,
      longitude: LON,
      elevationM: null,
      placeName: null,
      adminContext: null,
      timezone,
      resolvedBy: 'sample',
      isCoarse: false,
      source: 'BUNDLED',
      retrievedAt: null,
    };
    const current = forecastToCurrent(raw, makeProvenance('OPEN_METEO'), normals.monthly[0], location);
    expect(current.timezone).toBe(timezone);
    expect(current.forecast.length).toBe(dayCount);
    expect(Number.isFinite(current.temperatureC)).toBe(true);
    expect(current.provenance.isEstimated).toBe(false);
    expect(meanEt0(raw)).toBeTypeOf('number');
    record(
      'Open-Meteo',
      true,
      `${raw.timezone}, ${raw.elevation} m, current ${current.temperatureC} °C, ` +
        `${current.forecast.length} forecast days, ET0 ${meanEt0(raw)?.toFixed(2)} mm/day`
    );
  });

  it('Open-Meteo geocoding resolves a smallholder place name without a key', async () => {
    const payload = await getJson<{ results?: Array<{ name: string; latitude: number; longitude: number }> }>(
      geocodeUrl('Bogor')
    );
    expect(payload.results?.length).toBeGreaterThan(0);
    const first = payload.results![0];
    expect(Number.isFinite(first.latitude)).toBe(true);
    expect(Number.isFinite(first.longitude)).toBe(true);
    record('Geocoding', true, `${first.name} -> ${first.latitude}, ${first.longitude}`);
  });

  it('optional sources degrade gracefully and all hosts stay allowlisted', async () => {
    const soilUrl = soilGridsUrl(LAT, LON);
    await optional('SoilGrids (optional)', soilUrl, async () => {
      const raw = await getJson<SoilGridsResponse>(soilUrl, 12_000);
      const layers = raw.properties?.layers ?? [];
      const usable = layers.filter((l) => l.depths?.[0]?.values?.mean != null);
      return `${layers.length} layers returned, ${usable.length} with a usable mean (null means are handled by the manual picker)`;
    });

    await optional('Nominatim (optional)', nominatimReverseUrl(LAT, LON), async () => {
      const raw = await getJson<{ display_name?: string }>(nominatimReverseUrl(LAT, LON));
      return raw.display_name ?? 'reverse geocode returned no name';
    });

    await optional('Open-Meteo archive (optional)', openMeteoArchiveUrl(LAT, LON, '2025-01-01', '2025-12-31'), async () => {
      const raw = await getJson<{ daily?: { time?: string[] } }>(
        openMeteoArchiveUrl(LAT, LON, '2025-01-01', '2025-12-31'),
        25_000
      );
      return `${raw.daily?.time?.length ?? 0} daily historical rows`;
    });

    const gibsUrl = gibsTileUrl('MODIS_Terra_CorrectedReflectance_TrueColor', gibsDefaultDate(), 4, 8, 5);
    await optional('NASA GIBS tile (optional)', gibsUrl, async () => `${await getBytes(gibsUrl)} bytes JPEG`);

    const osmUrl = osmTileUrl(4, 8, 5);
    await optional('OSM basemap tile (optional)', osmUrl, async () => `${await getBytes(osmUrl)} bytes PNG`);

    // The gate is that the app never leaves its allowlist, not that free services are always up.
    expect(results.length).toBeGreaterThanOrEqual(8);
  }, 120_000); // free services are slow/flaky; each call has its own shorter AbortSignal timeout
});
