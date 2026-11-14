/**
 * Unit and calendar conversion helpers for the normalisation layer.
 * The canonical definitions live in `src/domain/membership.ts` so the pure domain
 * engine has no dependency on upper layers. Re-exported here for normalise + tests.
 */
export * from '@/domain/membership';

import { asMonth } from '@/domain/membership';
import type { Month } from '@/types/ui';

/** Resolve the current month in an IANA timezone, with a device-clock fallback. */
export function monthFromTimezone(timezone: string, now: Date = new Date()): Month {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      month: 'numeric',
    }).formatToParts(now);
    const monthPart = parts.find((part) => part.type === 'month');
    const parsed = monthPart ? Number.parseInt(monthPart.value, 10) : now.getMonth() + 1;
    return asMonth(parsed);
  } catch {
    return asMonth(now.getMonth() + 1);
  }
}

/** Device timezone, used when Open-Meteo `timezone=auto` is unavailable. */
export function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function formatCoordinate(lat: number, lon: number): string {
  const latWord = lat >= 0 ? 'N' : 'S';
  const lonWord = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(3)}° ${latWord}, ${Math.abs(lon).toFixed(3)}° ${lonWord}`;
}
