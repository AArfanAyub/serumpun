import { describe, expect, it } from 'vitest';
import {
  DAYS_IN_MONTH,
  MONTH_KEYS,
  MONTH_NAMES,
  addMonths,
  asMonth,
  clamp,
  daysInMonth,
  isMonth,
  keyFromMonth,
  modularMonthDistance,
  monthFromKey,
  monthName,
  monthShort,
  monthWithinWindow,
  rampUp,
  roundTo1,
  roundToInt,
  toOneBasedMonth,
  trapezoid,
  wetnessWord,
} from '@/domain/membership';
import type { Month } from '@/types/ui';

describe('canonical month mapping (JAN..DEC -> 1..12)', () => {
  it('has exactly twelve month keys and names', () => {
    expect(MONTH_KEYS).toHaveLength(12);
    expect(MONTH_NAMES).toHaveLength(12);
  });

  it('maps every POWER month key to the correct one-based month and back', () => {
    MONTH_KEYS.forEach((key, index) => {
      const month = (index + 1) as Month;
      expect(monthFromKey(key)).toBe(month);
      expect(keyFromMonth(month)).toBe(key);
    });
    expect(monthFromKey('JAN')).toBe(1);
    expect(monthFromKey('DEC')).toBe(12);
    expect(keyFromMonth(12)).toBe('DEC');
  });

  it('never treats ANN as a month (unknown keys fall back to January)', () => {
    expect(MONTH_KEYS).not.toContain('ANN' as never);
    expect(monthFromKey('ANN')).toBe(1);
    expect(monthFromKey('nonsense')).toBe(1);
    expect(isMonth(monthFromKey('ANN'))).toBe(true);
  });

  it('converts JS Date.getMonth() (zero-based) with +1', () => {
    expect(toOneBasedMonth(new Date(2024, 0, 15))).toBe(1); // January
    expect(toOneBasedMonth(new Date(2024, 5, 15))).toBe(6); // June
    expect(toOneBasedMonth(new Date(2024, 11, 15))).toBe(12); // December
  });

  it('uses a fixed 28-day February for long-term monthly averages', () => {
    expect(daysInMonth(2)).toBe(28);
    expect(DAYS_IN_MONTH[1]).toBe(28);
    expect(daysInMonth(1)).toBe(31);
    expect(daysInMonth(4)).toBe(30);
    expect(daysInMonth(12)).toBe(31);
  });

  it('names months correctly', () => {
    expect(monthName(1)).toBe('January');
    expect(monthName(12)).toBe('December');
    expect(monthShort(1)).toBe('Jan');
    expect(monthShort(12)).toBe('Dec');
    expect(monthName(13 as Month)).toBe('Unknown');
  });

  it('validates and wraps month numbers', () => {
    expect(isMonth(1)).toBe(true);
    expect(isMonth(12)).toBe(true);
    expect(isMonth(0)).toBe(false);
    expect(isMonth(13)).toBe(false);
    expect(isMonth(6.5)).toBe(false);
    expect(asMonth(13)).toBe(1);
    expect(asMonth(0)).toBe(12);
    expect(asMonth(-1)).toBe(11);
    expect(asMonth(6)).toBe(6);
  });

  it('performs modular month arithmetic', () => {
    expect(addMonths(11, 4)).toBe(3);
    expect(addMonths(12, 1)).toBe(1);
    expect(addMonths(1, -1)).toBe(12);
    expect(addMonths(6, 12)).toBe(6);
    expect(modularMonthDistance(1, 12)).toBe(1);
    expect(modularMonthDistance(1, 7)).toBe(6);
  });

  it('handles wrap-around planting windows such as November -> February', () => {
    expect(monthWithinWindow(1, 11, 2)).toBe(true);
    expect(monthWithinWindow(11, 11, 2)).toBe(true);
    expect(monthWithinWindow(12, 11, 2)).toBe(true);
    expect(monthWithinWindow(2, 11, 2)).toBe(true);
    expect(monthWithinWindow(6, 11, 2)).toBe(false);
    expect(monthWithinWindow(6, 3, 9)).toBe(true);
    expect(monthWithinWindow(2, 3, 9)).toBe(false);
  });
});

describe('pure numeric helpers', () => {
  it('clamps, rounds and handles non-finite values', () => {
    expect(clamp(15, 0, 10)).toBe(10);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(Number.NaN, 3, 9)).toBe(3);
    expect(roundToInt(72.6)).toBe(73);
    expect(roundToInt(Number.POSITIVE_INFINITY)).toBe(0);
    expect(roundTo1(6.15)).toBe(6.2);
  });

  it('computes trapezoidal membership 0..100', () => {
    // min 5, optMin 15, optMax 25, max 35
    expect(trapezoid(20, 5, 15, 25, 35)).toBe(100);
    expect(trapezoid(10, 5, 15, 25, 35)).toBe(50);
    expect(trapezoid(30, 5, 15, 25, 35)).toBe(50);
    expect(trapezoid(5, 5, 15, 25, 35)).toBe(0);
    expect(trapezoid(35, 5, 15, 25, 35)).toBe(0);
    expect(trapezoid(Number.NaN, 5, 15, 25, 35)).toBe(0);
  });

  it('computes rampUp and wetness words', () => {
    expect(rampUp(5, 0, 10)).toBe(50);
    expect(rampUp(-5, 0, 10)).toBe(0);
    expect(rampUp(20, 0, 10)).toBe(100);
    expect(wetnessWord(0.2)).toBe('dry');
    expect(wetnessWord(0.5)).toBe('moist');
    expect(wetnessWord(0.9)).toBe('wet');
    expect(wetnessWord(null)).toBe('unknown');
    expect(wetnessWord(Number.NaN)).toBe('unknown');
  });
});
