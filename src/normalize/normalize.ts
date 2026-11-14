import type { DataSourceStatus, Provenance, RawSiteData } from '@/types/data';
import type {
  FieldLocation,
  FieldProfile,
  MonthlyClimate,
  SiteConditions,
} from '@/types/domain';
import { SAMPLE_POWER } from '@/data/sample';
import { userProvenance } from '@/config/sources';
import { monthName } from './units';
import {
  elevationFromPower,
  forecastToCurrent,
  meanEt0,
  powerToClimateNormals,
} from './climate';
import { mergeProfile, soilFromSoilGrids } from './merge';

export interface NormalizeExtras {
  provenance?: Provenance[];
  statuses?: DataSourceStatus[];
}

function placeFromNominatim(raw: RawSiteData): { placeName: string | null; adminContext: string | null } {
  const nominatim = raw.nominatim;
  if (!nominatim) return { placeName: null, adminContext: null };
  const address = nominatim.address ?? {};
  const placeName =
    nominatim.name ??
    address.city ??
    address.town ??
    address.village ??
    address.county ??
    address.state ??
    null;
  const adminContext = nominatim.display_name ?? placeName;
  return { placeName, adminContext };
}

function dedupeProvenance(entries: Provenance[]): Provenance[] {
  const seen = new Set<string>();
  const result: Provenance[] = [];
  for (const entry of entries) {
    const key = `${entry.sourceId}:${entry.contribution}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(entry);
  }
  return result;
}

function dedupeStatuses(entries: DataSourceStatus[]): DataSourceStatus[] {
  const seen = new Set<string>();
  const result: DataSourceStatus[] = [];
  for (const entry of entries) {
    if (seen.has(entry.sourceId)) continue;
    seen.add(entry.sourceId);
    result.push(entry);
  }
  return result;
}

/**
 * Build the single normalised `SiteConditions` object the pure domain engine consumes.
 * Provenance objects are threaded through unchanged; nothing is invented here.
 */
export function toSiteConditions(
  raw: RawSiteData,
  location: FieldLocation,
  profile: FieldProfile,
  extras: NormalizeExtras = {}
): SiteConditions {
  const targetMonth = raw.targetMonth;

  const climate = powerToClimateNormals(raw.power, raw.powerProv, SAMPLE_POWER);
  const baseMonthly: MonthlyClimate = climate.monthly[targetMonth - 1] ?? climate.monthly[0];
  const et0 = meanEt0(raw.forecast);
  const monthlyForTarget: MonthlyClimate = { ...baseMonthly, et0MmDay: et0 };
  climate.monthly[targetMonth - 1] = monthlyForTarget;

  const current = forecastToCurrent(raw.forecast, raw.forecastProv, monthlyForTarget, location);
  const estimatedSoil = soilFromSoilGrids(raw.soil, raw.soilProv);
  const soil = mergeProfile(profile, estimatedSoil);

  const place = placeFromNominatim(raw);
  const enrichedLocation: FieldLocation = {
    ...location,
    placeName: place.placeName ?? location.placeName,
    adminContext: place.adminContext ?? location.adminContext,
    elevationM: current.elevationM ?? elevationFromPower(raw.power) ?? location.elevationM,
    timezone: current.timezone || location.timezone,
  };

  const hasUserEntry =
    profile.soilTexture !== 'unknown' ||
    profile.soilPhOverride !== null ||
    profile.irrigation !== 'unknown' ||
    profile.slope !== 'unknown' ||
    profile.shade !== 'unknown' ||
    profile.previousCropId !== null ||
    profile.landSizeHa !== null;

  const provenance = dedupeProvenance([
    raw.powerProv,
    raw.forecastProv,
    raw.soilProv,
    raw.nominatimProv,
    raw.archiveProv,
    raw.bundledProv,
    ...(extras.provenance ?? []),
    ...(hasUserEntry
      ? [userProvenance(`Field profile answers (${monthName(targetMonth)} session)`)]
      : []),
  ]);

  const sources = dedupeStatuses([...raw.sources, ...(extras.statuses ?? [])]);

  return {
    location: enrichedLocation,
    targetMonth,
    climate,
    current,
    soil,
    profile,
    monthlyForTarget,
    provenance,
    sources,
    appStatus: raw.appStatus,
  };
}
