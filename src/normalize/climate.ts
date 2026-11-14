import type { Provenance } from '@/types/data';
import type {
  ClimateNormals,
  CurrentWeather,
  FieldLocation,
  ForecastDay,
  MonthlyClimate,
} from '@/types/domain';
import type {
  OpenMeteoForecastResponse,
  PowerClimatologyResponse,
} from '@/types/data';
import type { Month } from '@/types/ui';
import { asMonth, daysInMonth, keyFromMonth, MONTH_KEYS, monthFromKey } from './units';
import { CLIMATOLOGY_LABEL, CLIMATOLOGY_PERIOD } from '@/config/attribution';
import { makeProvenance } from '@/config/sources';

/** Neutral stand-ins used only when a POWER parameter is missing or a fill value. */
const NEUTRAL = {
  t2mC: 25,
  t2mMaxC: 30,
  t2mMinC: 20,
  precipMmDay: 3.2,
  rhPct: 70,
  solarMjM2Day: 18,
  windMs10m: 2,
  gwetRoot: 0.5,
  gwetTop: 0.5,
} as const;

function parameterTable(raw: PowerClimatologyResponse | null): Record<string, Record<string, number>> {
  return raw?.properties?.parameter ?? {};
}

function readNumber(
  table: Record<string, Record<string, number>>,
  parameter: string,
  key: string,
  fallback: number
): number {
  const row = table[parameter];
  const raw = row ? row[key] : undefined;
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < -900) return fallback;
  return raw;
}

/** POWER geometry carries elevation in metres as the third coordinate. */
export function elevationFromPower(raw: PowerClimatologyResponse | null): number | null {
  const elevation = raw?.geometry?.coordinates?.[2];
  return typeof elevation === 'number' && Number.isFinite(elevation) ? elevation : null;
}

/**
 * Convert a POWER climatology payload into exactly 12 `MonthlyClimate` records.
 *
 * MANDATORY unit rule: `PRECTOTCORR` is mm/**day** on climatology, so monthly mm =
 * value * daysInMonth(month). February uses a fixed 28 days for a long-term average.
 * `JAN..DEC` -> 1..12; `ANN` is stored separately in `annual` and NEVER treated as a month.
 */
export function powerToClimateNormals(
  raw: PowerClimatologyResponse | null,
  provenance: Provenance,
  fallback: PowerClimatologyResponse | null = null
): ClimateNormals {
  const table = parameterTable(raw);
  const fallbackTable = parameterTable(fallback);
  const useFallback = Object.keys(table).length === 0 && Object.keys(fallbackTable).length > 0;
  const source = useFallback ? fallbackTable : table;

  const monthly: MonthlyClimate[] = MONTH_KEYS.map((key, index) => {
    const month = asMonth(index + 1);
    const precipMmDay = readNumber(source, 'PRECTOTCORR', key, NEUTRAL.precipMmDay);
    return {
      month,
      t2mC: readNumber(source, 'T2M', key, NEUTRAL.t2mC),
      t2mMaxC: readNumber(source, 'T2M_MAX', key, NEUTRAL.t2mMaxC),
      t2mMinC: readNumber(source, 'T2M_MIN', key, NEUTRAL.t2mMinC),
      precipMm: Math.round(precipMmDay * daysInMonth(month)),
      rhPct: readNumber(source, 'RH2M', key, NEUTRAL.rhPct),
      solarMjM2Day: readNumber(source, 'ALLSKY_SFC_SW_DWN', key, NEUTRAL.solarMjM2Day),
      windMs10m: readNumber(source, 'WS10M', key, NEUTRAL.windMs10m),
      gwetRoot: readNumber(source, 'GWETROOT', key, NEUTRAL.gwetRoot),
      gwetTop: readNumber(source, 'GWETTOP', key, NEUTRAL.gwetTop),
      et0MmDay: null,
    };
  });

  const annualT2m = readNumber(source, 'T2M', 'ANN', NEUTRAL.t2mC);
  const annualPrecipMmDay = readNumber(source, 'PRECTOTCORR', 'ANN', NEUTRAL.precipMmDay);

  return {
    monthly,
    annual: {
      t2mC: annualT2m,
      precipMm: Math.round(annualPrecipMmDay * 365),
    },
    periodLabel: CLIMATOLOGY_LABEL,
    source: provenance.sourceId === 'BUNDLED' ? 'BUNDLED' : 'NASA_POWER',
    provenance,
  };
}

export function meanEt0(raw: OpenMeteoForecastResponse | null): number | null {
  const values = raw?.daily?.et0_fao_evapotranspiration;
  if (!values || values.length === 0) return null;
  const finite = values.filter((value) => typeof value === 'number' && Number.isFinite(value));
  if (finite.length === 0) return null;
  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}

/**
 * Convert an Open-Meteo payload into `CurrentWeather`. When the forecast is missing the
 * current values are imputed from the target month's climatology and the provenance is
 * flipped to `estimated` — the UI never shows a blank or NaN.
 */
export function forecastToCurrent(
  raw: OpenMeteoForecastResponse | null,
  provenance: Provenance,
  monthlyForTarget: MonthlyClimate,
  location: FieldLocation
): CurrentWeather {
  const live = raw !== null;
  const current = raw?.current;
  const daily = raw?.daily;
  const effectiveProvenance: Provenance = live
    ? provenance
    : makeProvenance('OPEN_METEO', {
        status: 'estimated',
        freshness: CLIMATOLOGY_PERIOD,
        isEstimated: true,
        contribution: 'Current conditions estimated from long-term monthly averages',
      });

  const forecast: ForecastDay[] = [];
  const times = daily?.time ?? [];
  for (let i = 0; i < times.length; i += 1) {
    const date = times[i] ?? '';
    forecast.push({
      date,
      tMaxC: daily?.temperature_2m_max?.[i] ?? monthlyForTarget.t2mMaxC,
      tMinC: daily?.temperature_2m_min?.[i] ?? monthlyForTarget.t2mMinC,
      precipMm: daily?.precipitation_sum?.[i] ?? 0,
      et0Mm: daily?.et0_fao_evapotranspiration?.[i] ?? null,
      solarMjM2: daily?.shortwave_radiation_sum?.[i] ?? null,
    });
  }

  return {
    observedAt:
      current?.time ?? effectiveProvenance.retrievedAt ?? new Date().toISOString(),
    temperatureC: current?.temperature_2m ?? monthlyForTarget.t2mC,
    humidityPct: current?.relative_humidity_2m ?? monthlyForTarget.rhPct,
    precipitationMm: current?.precipitation ?? 0,
    soilMoisture01: current?.soil_moisture_0_to_1cm ?? null,
    forecast,
    timezone: raw?.timezone ?? location.timezone,
    elevationM: raw?.elevation ?? location.elevationM,
    source: 'OPEN_METEO',
    provenance: effectiveProvenance,
  };
}

/** Map a POWER month key to a canonical month (exported for tests). */
export function powerKeyToMonth(key: string): Month {
  return monthFromKey(key);
}

/** Map a canonical month to a POWER key (exported for tests). */
export function monthToPowerKey(month: Month): string {
  return keyFromMonth(month);
}
