import { describe, expect, it } from 'vitest';
import { CLIMATOLOGY_LABEL, CLIMATOLOGY_PERIOD } from '@/config/attribution';
import { makeProvenance } from '@/config/sources';
import { SAMPLE_FORECAST, SAMPLE_POWER } from '@/data/sample';
import { daysInMonth, monthFromKey } from '@/domain/membership';
import {
  elevationFromPower,
  forecastToCurrent,
  meanEt0,
  monthToPowerKey,
  powerKeyToMonth,
  powerToClimateNormals,
} from '@/normalize/climate';
import { offlineSite } from '@/api/orchestrator';
import type { PowerClimatologyResponse } from '@/types/data';

function syntheticPower(precipMmDay: number, annMmDay: number): PowerClimatologyResponse {
  const row: Record<string, number> = { ANN: annMmDay };
  for (const key of [
    'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
    'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
  ]) {
    row[key] = precipMmDay;
  }
  return {
    geometry: { type: 'Point', coordinates: [110.42, -7.55, 210] },
    properties: {
      parameter: {
        PRECTOTCORR: row,
        T2M: { ...row, ANN: 26 },
      },
    },
  };
}

describe('NASA POWER unit conversion (mm/day -> monthly mm)', () => {
  const prov = makeProvenance('NASA_POWER', {
    status: 'live',
    freshness: CLIMATOLOGY_PERIOD,
    isEstimated: false,
  });

  it('produces exactly 12 monthly records with months 1..12 (ANN never a month)', () => {
    const normals = powerToClimateNormals(syntheticPower(2, 2.5), prov);
    expect(normals.monthly).toHaveLength(12);
    expect(normals.monthly.map((entry) => entry.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(normals.monthly.every((entry) => entry.month >= 1 && entry.month <= 12)).toBe(true);
  });

  it('multiplies PRECTOTCORR by daysInMonth for every month', () => {
    const normals = powerToClimateNormals(syntheticPower(2, 2.5), prov);
    normals.monthly.forEach((entry) => {
      expect(entry.precipMm).toBe(Math.round(2 * daysInMonth(entry.month)));
    });
    // January 2 mm/day * 31 = 62 mm; February 2 * 28 = 56 mm (fixed, non-leap).
    expect(normals.monthly[0].precipMm).toBe(62);
    expect(normals.monthly[1].precipMm).toBe(56);
    expect(normals.monthly[3].precipMm).toBe(60); // April, 30 days
  });

  it('stores ANN separately as annual rainfall (mm/day * 365), never as month 13', () => {
    const normals = powerToClimateNormals(syntheticPower(2, 2.5), prov);
    expect(normals.annual).not.toBeNull();
    expect(normals.annual?.precipMm).toBe(Math.round(2.5 * 365));
    expect(normals.monthly.some((entry) => Number(entry.month) === 13)).toBe(false);
  });

  it('reads elevation from POWER geometry (third coordinate, metres)', () => {
    expect(elevationFromPower(syntheticPower(2, 2.5))).toBe(210);
    expect(elevationFromPower(null)).toBeNull();
    expect(elevationFromPower(SAMPLE_POWER)).toBe(210);
  });

  it('converts the bundled Central Java sample with the same rule', () => {
    const normals = powerToClimateNormals(SAMPLE_POWER, prov);
    // JAN 9.8 mm/day * 31 = 304 mm; FEB 9.2 * 28 = 258 mm.
    expect(normals.monthly[0].precipMm).toBe(Math.round(9.8 * 31));
    expect(normals.monthly[1].precipMm).toBe(Math.round(9.2 * 28));
    expect(normals.annual?.precipMm).toBe(Math.round(5.28 * 365));
    expect(normals.monthly[0].t2mC).toBe(26.1);
    expect(normals.periodLabel).toBe(CLIMATOLOGY_LABEL);
    expect(normals.source).toBe('NASA_POWER');
  });

  it('labels a bundled payload as BUNDLED and tolerates POWER fill values (-999)', () => {
    const bundled = makeProvenance('BUNDLED', { status: 'bundled sample', isEstimated: true });
    expect(powerToClimateNormals(SAMPLE_POWER, bundled).source).toBe('BUNDLED');

    const withFill = syntheticPower(2, 2.5);
    withFill.properties!.parameter!.PRECTOTCORR.JAN = -999;
    const normals = powerToClimateNormals(withFill, prov);
    // -999 is a POWER fill value; the neutral 3.2 mm/day stand-in is used instead.
    expect(normals.monthly[0].precipMm).toBe(Math.round(3.2 * 31));
  });

  it('falls back to a supplied fallback payload when the live table is empty', () => {
    const normals = powerToClimateNormals(null, prov, syntheticPower(4, 4));
    expect(normals.monthly[0].precipMm).toBe(4 * 31);
    expect(normals.monthly[1].precipMm).toBe(4 * 28);
  });

  it('maps POWER keys both ways', () => {
    expect(powerKeyToMonth('JAN')).toBe(1);
    expect(powerKeyToMonth('DEC')).toBe(12);
    expect(monthToPowerKey(1)).toBe('JAN');
    expect(monthToPowerKey(12)).toBe('DEC');
    expect(monthFromKey('MAR')).toBe(3);
  });
});

describe('Open-Meteo forecast normalisation', () => {
  it('averages finite ET0 values and ignores missing/null', () => {
    expect(meanEt0(SAMPLE_FORECAST)).toBeGreaterThan(0);
    expect(meanEt0(null)).toBeNull();
    expect(meanEt0({ daily: { et0_fao_evapotranspiration: [] } })).toBeNull();
    expect(meanEt0({ daily: { et0_fao_evapotranspiration: [Number.NaN, 2, 4] } })).toBe(3);
  });

  it('imputes current conditions from climatology and flips provenance to estimated when forecast is missing', () => {
    const site = offlineSite(undefined, undefined, 3);
    const monthly = site.monthlyForTarget;
    const current = forecastToCurrent(null, makeProvenance('OPEN_METEO'), monthly, site.location);
    expect(current.temperatureC).toBe(monthly.t2mC);
    expect(current.humidityPct).toBe(monthly.rhPct);
    expect(current.precipitationMm).toBe(0);
    expect(current.forecast).toEqual([]);
    expect(current.provenance.isEstimated).toBe(true);
    expect(current.provenance.status).toBe('estimated');
    expect(current.timezone).toBe(site.location.timezone);
  });

  it('keeps live provenance and builds a 16-day-shaped forecast when data is present', () => {
    const site = offlineSite(undefined, undefined, 3);
    const live = makeProvenance('OPEN_METEO', { status: 'live', isEstimated: false });
    const current = forecastToCurrent(SAMPLE_FORECAST, live, site.monthlyForTarget, site.location);
    expect(current.provenance.isEstimated).toBe(false);
    expect(current.forecast.length).toBeGreaterThan(0);
    expect(current.forecast.length).toBeLessThanOrEqual(16);
    expect(Number.isFinite(current.temperatureC)).toBe(true);
    expect(current.forecast.every((day) => typeof day.date === 'string' && Number.isFinite(day.tMaxC))).toBe(true);
  });
});
