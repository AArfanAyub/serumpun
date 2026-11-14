import type { Provenance, SoilGridsResponse } from '@/types/data';
import type { FieldProfile, SiteConditions, SoilProfile, SoilTexture } from '@/types/domain';
import type { Month } from '@/types/ui';
import { userProvenance } from '@/config/sources';
import { clamp } from './units';

/** Every question answered with "I don't know" still produces a full recommendation. */
export function defaultProfile(): FieldProfile {
  return {
    soilTexture: 'unknown',
    soilPhOverride: null,
    irrigation: 'unknown',
    slope: 'unknown',
    shade: 'unknown',
    previousCropId: null,
    previousCropUnknown: true,
    landSizeHa: null,
    surroundings: ['none-known'],
    priorities: [],
    answered: {},
    isSelfReported: false,
  };
}

function layerMean(raw: SoilGridsResponse, name: string): { value: number; divided: number } | null {
  const layers = raw.properties?.layers;
  if (!layers) return null;
  const layer = layers.find((item) => item.name === name);
  if (!layer) return null;
  const mean = layer.depths?.[0]?.values?.mean;
  if (typeof mean !== 'number' || !Number.isFinite(mean)) return null;
  const factor = layer.unit_measure?.d_factor;
  const divisor = typeof factor === 'number' && factor > 0 ? factor : 1;
  return { value: mean, divided: mean / divisor };
}

/** USDA-ish texture triangle simplification from clay / sand percentages. */
export function textureFromFractions(clayPct: number | null, sandPct: number | null): SoilTexture {
  if (clayPct === null || sandPct === null) return 'unknown';
  if (clayPct >= 35) return 'clay';
  if (sandPct >= 55) return 'sandy';
  return 'loam';
}

/**
 * Parse the optional SoilGrids response. `mean: null` is a NORMAL no-data outcome, not an
 * error: it yields an unknown soil profile so the UI shows the manual picker labelled
 * "self-reported". A successful SoilGrids value is STILL labelled estimated.
 */
export function soilFromSoilGrids(raw: SoilGridsResponse | null, provenance: Provenance): SoilProfile {
  if (!raw) {
    return {
      texture: 'unknown',
      ph: null,
      clayPct: null,
      sandPct: null,
      socGkg: null,
      depthLabel: '0-5cm',
      origin: 'unknown',
      isEstimated: true,
      provenance,
    };
  }

  const ph = layerMean(raw, 'phh2o');
  const clay = layerMean(raw, 'clay');
  const sand = layerMean(raw, 'sand');
  const soc = layerMean(raw, 'soc');

  if (!ph && !clay && !sand) {
    return {
      texture: 'unknown',
      ph: null,
      clayPct: null,
      sandPct: null,
      socGkg: null,
      depthLabel: '0-5cm',
      origin: 'unknown',
      isEstimated: true,
      provenance,
    };
  }

  const clayPct = clay ? clay.divided : null;
  const sandPct = sand ? sand.divided : null;

  return {
    texture: textureFromFractions(clayPct, sandPct),
    ph: ph ? clamp(ph.divided, 3, 10) : null,
    clayPct,
    sandPct,
    socGkg: soc ? soc.divided : null,
    depthLabel: '0-5cm',
    origin: 'soilgrids',
    isEstimated: true,
    provenance,
  };
}

/**
 * Apply the farmer's answers on top of the SoilGrids estimate. A pH override always wins;
 * a chosen texture always wins. Anything user-supplied is labelled "self-reported".
 */
export function mergeProfile(profile: FieldProfile, soil: SoilProfile): SoilProfile {
  const hasTexture = profile.soilTexture !== 'unknown';
  const hasPh = profile.soilPhOverride !== null;
  if (!hasTexture && !hasPh) return soil;

  return {
    ...soil,
    texture: hasTexture ? profile.soilTexture : soil.texture,
    ph: hasPh && profile.soilPhOverride !== null ? clamp(profile.soilPhOverride, 4, 9) : soil.ph,
    origin: 'self-reported',
    isEstimated: true,
    provenance: userProvenance(
      'Soil texture / pH you entered on this device (self-reported, estimated)'
    ),
  };
}

/**
 * Re-merge a changed field profile or month override without refetching anything.
 * Pure with respect to network: it only rebuilds the normalised object.
 */
export function remergeSite(
  site: SiteConditions,
  patch: { profile?: FieldProfile; targetMonth?: Month }
): SiteConditions {
  const profile = patch.profile ?? site.profile;
  const targetMonth = patch.targetMonth ?? site.targetMonth;
  const climate = {
    ...site.climate,
    monthly: site.climate.monthly.map((month) => ({ ...month })),
  };
  const monthlyForTarget = climate.monthly[targetMonth - 1] ?? climate.monthly[0];
  const soil = mergeProfile(profile, site.soil);

  const hasUserEntry = profile.soilTexture !== 'unknown' || profile.soilPhOverride !== null;
  const provenance = [...site.provenance];
  if (hasUserEntry && !provenance.some((item) => item.sourceId === 'USER')) {
    provenance.push(userProvenance());
  }

  return {
    ...site,
    profile,
    targetMonth,
    climate,
    monthlyForTarget,
    soil,
    provenance,
  };
}
