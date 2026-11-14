import type { Month } from '@/types/ui';

/**
 * Canonical pure math + calendar helpers.
 *
 * This module lives inside `src/domain/` so the entire domain engine can stay
 * dependency-free (no imports from upper layers, no fetch, no clock, no randomness).
 * `src/normalize/units.ts` re-exports these for the normalisation layer and tests.
 */

export const MONTH_KEYS = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
] as const;

export type MonthKey = (typeof MONTH_KEYS)[number];

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** Fixed non-leap February = 28 days for a LONG-TERM AVERAGE (PRD Q4 / O-7). */
export const DAYS_IN_MONTH: readonly number[] = Object.freeze([
  31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
]);

export function isMonth(value: number): value is Month {
  return Number.isInteger(value) && value >= 1 && value <= 12;
}

/**
 * Coerce any number into a valid canonical 1..12 month using consistent modular
 * arithmetic: 13 -> 1, 0 -> 12, -1 -> 11. Non-finite input defaults to January.
 * Note `Math.trunc(value || 1)` is deliberately NOT used, because `0 || 1` would
 * collapse a legitimate wrap-around zero into January instead of December.
 */
export function asMonth(value: number): Month {
  if (Number.isFinite(value) && isMonth(value)) return value;
  const safe = Number.isFinite(value) ? Math.trunc(value) : 1;
  const wrapped = ((safe - 1) % 12 + 12) % 12 + 1;
  return wrapped as Month;
}

export function clamp(value: number, low: number, high: number): number {
  if (!Number.isFinite(value)) return low;
  return Math.min(high, Math.max(low, value));
}

export function roundToInt(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value);
}

export function roundTo1(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10) / 10;
}

/**
 * Trapezoidal membership in 0..100.
 * Zero at/below `min` and at/above `max`; 100 between `optMin` and `optMax`.
 */
export function trapezoid(
  value: number,
  min: number,
  optMin: number,
  optMax: number,
  max: number
): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= min || value >= max) return 0;
  if (optMin <= min || optMax <= optMin || max <= optMax) {
    return value > min && value < max ? 100 : 0;
  }
  if (value < optMin) return (100 * (value - min)) / (optMin - min);
  if (value <= optMax) return 100;
  return (100 * (max - value)) / (max - optMax);
}

export function rampUp(value: number, low: number, high: number): number {
  if (!Number.isFinite(value) || high <= low) return 0;
  return clamp((100 * (value - low)) / (high - low), 0, 100);
}

/** Days in a canonical month. February is fixed at 28 for long-term averages. */
export function daysInMonth(month: Month): number {
  const days = DAYS_IN_MONTH[month - 1];
  return typeof days === 'number' ? days : 30;
}

export function monthName(month: Month): string {
  return MONTH_NAMES[month - 1] ?? 'Unknown';
}

export function monthShort(month: Month): string {
  return MONTH_SHORT[month - 1] ?? '---';
}

/** Map a POWER key (JAN..DEC) to 1..12. Unknown keys default to January and are flagged. */
export function monthFromKey(key: string): Month {
  const index = MONTH_KEYS.indexOf(key.toUpperCase() as MonthKey);
  return (index >= 0 ? index + 1 : 1) as Month;
}

export function keyFromMonth(month: Month): MonthKey {
  return MONTH_KEYS[month - 1] ?? 'JAN';
}

/** JS Date.getMonth() is 0-based; always convert with +1. */
export function toOneBasedMonth(date: Date): Month {
  return asMonth(date.getMonth() + 1);
}

/** Modular month arithmetic: addMonths(11, 4) = 3. */
export function addMonths(month: Month, delta: number): Month {
  return asMonth(((month - 1 + delta) % 12 + 12) % 12 + 1);
}

export function modularMonthDistance(a: Month, b: Month): number {
  const diff = Math.abs(a - b);
  return Math.min(diff, 12 - diff);
}

/** Handles wrap-around planting windows such as November -> February. */
export function monthWithinWindow(month: Month, start: Month, end: Month): boolean {
  if (start <= end) return month >= start && month <= end;
  return month >= start || month <= end;
}

/** 0..1 relative wetness shown as words; raw value is available on tap in the UI. */
export function wetnessWord(value: number | null): 'dry' | 'moist' | 'wet' | 'unknown' {
  if (value === null || !Number.isFinite(value)) return 'unknown';
  if (value < 0.35) return 'dry';
  if (value <= 0.7) return 'moist';
  return 'wet';
}
