import {
  ET0_DEMAND_FACTOR,
  FACTOR_FAIR_MIN,
  FACTOR_GOOD_MIN,
  FACTOR_NAMES,
  FACTOR_WEIGHTS,
  IRRIGATION_BONUS_MM,
  SURROUNDINGS_NEUTRAL,
  WATER_DEMAND_MM,
  WINDOW_SCORE_BEST,
  WINDOW_SCORE_IN,
  WINDOW_SCORE_OUT,
  WINDOW_SCORE_WAIT,
} from '@/config/scoring';
import { t } from '@/i18n';
import type { Provenance, SourceId } from '@/types/data';
import type { CropDefinition, FactorScore, SiteConditions, SoilTexture } from '@/types/domain';
import type { FactorId, Lang, Verdict } from '@/types/ui';
import { getCrop } from './crops';
import {
  cautionText,
  f1Reason,
  f2Reason,
  f3Reason,
  f4Position,
  f4Reason,
  f5Reason,
  f6Reason,
  f7Reason,
  labelWord,
  verdictWord,
} from './explain';
import {
  clamp,
  daysInMonth,
  modularMonthDistance,
  monthName,
  monthShort,
  monthWithinWindow,
  roundTo1,
  roundToInt,
  trapezoid,
} from './membership';

export function verdictFromScore(score: number): Verdict {
  if (score >= FACTOR_GOOD_MIN) return 'Good';
  if (score >= FACTOR_FAIR_MIN) return 'Fair';
  return 'Poor';
}

function provenanceFor(site: SiteConditions, sourceId: SourceId): Provenance {
  const found = site.provenance.find((entry) => entry.sourceId === sourceId);
  if (found) return found;
  if (sourceId === 'NASA_POWER' || sourceId === 'BUNDLED') return site.climate.provenance;
  if (sourceId === 'USER') return site.soil.provenance;
  return site.current.provenance;
}

function baseFactor(
  factorId: FactorId,
  site: SiteConditions,
  sourceId: SourceId,
  value: string,
  rawValue: number | null,
  unit: string,
  score: number,
  isEstimated: boolean,
  reason: string
): FactorScore {
  const prov = provenanceFor(site, sourceId);
  const verdict = verdictFromScore(score);
  return {
    factorId,
    name: FACTOR_NAMES[factorId],
    weight: FACTOR_WEIGHTS[factorId],
    observedValue: value,
    rawValue,
    unit,
    score: roundToInt(score),
    verdict,
    reason,
    source: prov.source,
    sourceId: prov.sourceId,
    freshness: prov.freshness,
    isEstimated,
  };
}

const TEXTURE_ORDER: readonly SoilTexture[] = ['sandy', 'loam', 'clay', 'peat'];

function adjacentTexture(texture: SoilTexture, acceptable: readonly SoilTexture[]): boolean {
  const index = TEXTURE_ORDER.indexOf(texture);
  if (index < 0) return false;
  const left = TEXTURE_ORDER[index - 1];
  const right = TEXTURE_ORDER[index + 1];
  return (left !== undefined && acceptable.includes(left)) || (right !== undefined && acceptable.includes(right));
}

function textureWords(lang: Lang, textures: readonly SoilTexture[]): string {
  return textures.map((texture) => labelWord(lang, texture)).join(' / ');
}

function sharesDiseaseGroup(a: CropDefinition, b: CropDefinition): boolean {
  return a.diseaseGroups.some((group) => b.diseaseGroups.includes(group));
}

const NITROGEN_RANK: Readonly<Record<CropDefinition['nitrogenRole'], number>> = {
  Legume: 0,
  'Heavy feeder': 1,
  'Light feeder': 2,
};

/** Soft nitrogen-sequence signal for F7 (the rotation planner applies the hard rules). */
export function nitrogenSequenceOff(a: CropDefinition, b: CropDefinition): boolean {
  const from = NITROGEN_RANK[a.nitrogenRole];
  const to = NITROGEN_RANK[b.nitrogenRole];
  if (from === 1 && to === 1) return false; // handled by the dedicated heavier penalty
  return !((to === from + 1) || (from === 2 && to === 0));
}

/** F1 — Temperature fit, weight 20. */
export function scoreF1(site: SiteConditions, crop: CropDefinition, lang: Lang): FactorScore {
  const mc = site.monthlyForTarget;
  const req = crop.requirements;
  const temp = req.temperatureC;
  const base = trapezoid(mc.t2mC, temp.min, temp.optMin, temp.optMax, temp.max);
  const heatPenalty = clamp((mc.t2mMaxC - req.heatStressC) / 5, 0, 1) * 20;
  const frostPenalty = req.frostTolerant ? 0 : clamp((5 - mc.t2mMinC) / 5, 0, 1) * 20;
  const score = clamp(base - heatPenalty - frostPenalty, 0, 100);
  const verdict = verdictFromScore(score);
  const isEstimated = site.climate.provenance.status !== 'live' || site.climate.provenance.isEstimated;

  const reason = f1Reason(lang, {
    month: monthName(site.targetMonth),
    temp: roundToInt(mc.t2mC),
    optMin: temp.optMin,
    optMax: temp.optMax,
    verdict: verdictWord(lang, verdict),
    heat: mc.t2mMaxC > req.heatStressC ? roundToInt(mc.t2mMaxC) : null,
    frost: !req.frostTolerant && mc.t2mMinC < 5 ? roundToInt(mc.t2mMinC) : null,
  });

  return baseFactor('F1', site, 'NASA_POWER', `${roundToInt(mc.t2mC)} °C`, mc.t2mC, '°C', score, isEstimated, reason);
}

/** F2 — Water fit, weight 20. PRECTOTCORR was already converted to monthly mm. */
export function scoreF2(site: SiteConditions, crop: CropDefinition, lang: Lang): FactorScore {
  const mc = site.monthlyForTarget;
  const month = site.targetMonth;
  const irrigationBonus = IRRIGATION_BONUS_MM[site.profile.irrigation];
  const demandMm =
    WATER_DEMAND_MM[crop.waterNeed] +
    (mc.et0MmDay !== null ? mc.et0MmDay * daysInMonth(month) * ET0_DEMAND_FACTOR : 0);
  const supplyMm = mc.precipMm + irrigationBonus;
  const ratio = supplyMm / Math.max(1, demandMm);
  const base = trapezoid(ratio, 0.4, 0.85, 1.3, 2.2);
  const wetnessMod = mc.gwetRoot < 0.25 ? -10 : mc.gwetRoot > 0.75 ? 5 : 0;
  const waterlogPenalty = ratio > 2.2 ? clamp((ratio - 2.2) * 25, 0, 25) : 0;
  const score = clamp(base + wetnessMod - waterlogPenalty, 0, 100);
  const verdict = verdictFromScore(score);
  const isEstimated =
    site.climate.provenance.status !== 'live' ||
    site.climate.provenance.isEstimated ||
    mc.et0MmDay === null ||
    site.profile.irrigation === 'unknown';

  const reason = f2Reason(lang, {
    month: monthName(month),
    rain: roundToInt(mc.precipMm),
    crop: crop.cropName,
    need: labelWord(lang, `water.${crop.waterNeed}`),
    irrigation: labelWord(lang, `irrigation.${site.profile.irrigation}`),
    verdict: verdictWord(lang, verdict),
  });

  return baseFactor(
    'F2',
    site,
    'NASA_POWER',
    `${roundToInt(mc.precipMm)} mm`,
    mc.precipMm,
    'mm/month',
    score,
    isEstimated,
    reason
  );
}

/** F3 — Soil fit, weight 15. SoilGrids success is STILL labelled estimated. */
export function scoreF3(site: SiteConditions, crop: CropDefinition, lang: Lang): FactorScore {
  const soil = site.soil;
  const req = crop.requirements;
  const phScore =
    soil.ph === null ? 50 : trapezoid(soil.ph, req.ph.min, req.ph.optMin, req.ph.optMax, req.ph.max);
  const texScore =
    soil.texture === 'unknown'
      ? 50
      : req.texture.includes(soil.texture)
        ? 100
        : adjacentTexture(soil.texture, req.texture)
          ? 45
          : 10;
  const drainPenalty = soil.texture === 'clay' && req.drainageTolerance === 'low' ? 20 : 0;
  const score = clamp(0.6 * phScore + 0.4 * texScore - drainPenalty, 0, 100);
  const verdict = verdictFromScore(score);

  const soilWord =
    soil.texture === 'unknown' ? labelWord(lang, 'soilUnknown') : labelWord(lang, soil.texture);
  const phText = soil.ph !== null ? `, pH ${roundTo1(soil.ph)}` : '';
  const reason = f3Reason(lang, {
    soil: soilWord,
    ph: phText,
    crop: crop.cropName,
    textures: textureWords(lang, req.texture),
    range: `${req.ph.optMin}–${req.ph.optMax}`,
    verdict: verdictWord(lang, verdict),
  });

  return baseFactor(
    'F3',
    site,
    soil.provenance.sourceId,
    `${soilWord}${phText}`,
    soil.ph,
    'pH',
    score,
    soil.isEstimated,
    reason
  );
}

/** F4 — Season / planting window, weight 15. Only this factor sets the window status. */
export function scoreF4(site: SiteConditions, crop: CropDefinition, lang: Lang): FactorScore {
  const month = site.targetMonth;
  const window = crop.plantingWindow;
  const inWindow = monthWithinWindow(month, window.startMonth, window.endMonth);
  const distance = modularMonthDistance(month, window.bestMonth);
  const score =
    month === window.bestMonth
      ? WINDOW_SCORE_BEST
      : inWindow
        ? WINDOW_SCORE_IN
        : distance <= 1
          ? WINDOW_SCORE_WAIT
          : WINDOW_SCORE_OUT;
  const verdict = verdictFromScore(score);
  const position: 'in' | 'before' | 'out' =
    inWindow ? 'in' : distance <= 1 ? 'before' : 'out';

  const reason = f4Reason(lang, {
    month: monthName(month),
    position: f4Position(lang, position),
    crop: crop.cropName,
    start: monthShort(window.startMonth),
    end: monthShort(window.endMonth),
  });

  return baseFactor(
    'F4',
    site,
    'BUNDLED',
    monthName(month),
    month,
    'month',
    score,
    site.appStatus === 'Offline sample',
    reason
  );
}

/** F5 — Terrain & erosion, weight 10. */
export function scoreF5(site: SiteConditions, crop: CropDefinition, lang: Lang): FactorScore {
  const mc = site.monthlyForTarget;
  const req = crop.requirements;
  const elevation = site.location.elevationM;
  const elevRange = req.elevationM;
  const elevScore =
    elevation === null
      ? 60
      : trapezoid(
          elevation,
          elevRange.min,
          elevRange.min + 100,
          Math.max(elevRange.min + 101, elevRange.max - 100),
          elevRange.max
        );
  const slope = site.profile.slope;
  const slopeScore =
    slope === 'unknown' ? 60 : req.slopeTolerance.includes(slope) ? 100 : slope === 'steep' ? 25 : 55;
  const heavyRisk = mc.precipMm / daysInMonth(site.targetMonth) > req.heavyRainMmDay;
  const erosionPenalty = slope === 'steep' && heavyRisk ? 30 : heavyRisk ? 10 : 0;
  const score = clamp(0.5 * elevScore + 0.5 * slopeScore - erosionPenalty, 0, 100);
  const verdict = verdictFromScore(score);
  const isEstimated =
    elevation === null || slope === 'unknown' || site.climate.provenance.isEstimated;

  const reason = f5Reason(lang, {
    slope: labelWord(lang, `slope.${slope}`),
    elev: elevation === null ? 'unknown' : roundToInt(elevation),
    crop: crop.cropName,
    slopes: req.slopeTolerance.map((item) => labelWord(lang, `slope.${item}`)).join(' / '),
  });

  return baseFactor(
    'F5',
    site,
    'OPEN_METEO',
    elevation === null ? 'elevation unknown' : `${roundToInt(elevation)} m`,
    elevation,
    'm',
    score,
    isEstimated,
    reason
  );
}

/** F6 — Surroundings & field context, weight 10. */
export function scoreF6(site: SiteConditions, crop: CropDefinition, lang: Lang): FactorScore {
  const profile = site.profile;
  const req = crop.requirements;
  let score = SURROUNDINGS_NEUTRAL;
  if (profile.irrigation === 'reliable') score += 10;
  else if (profile.irrigation === 'partial') score += 5;
  if (profile.shade === 'heavy' && !req.shadeTolerance.includes('heavy')) score -= 15;
  if (profile.surroundings.includes('nearby-water')) score += 8;
  if (profile.surroundings.includes('nearby-forest')) score += 3;
  if (profile.surroundings.includes('nearby-urban')) score -= 5;
  if (
    profile.landSizeHa !== null &&
    profile.landSizeHa < 0.2 &&
    crop.daysToHarvest.max <= 90
  ) {
    score += 5;
  }
  score = clamp(score, 0, 100);

  const noData =
    profile.irrigation === 'unknown' &&
    profile.shade === 'unknown' &&
    profile.landSizeHa === null &&
    (profile.surroundings.length === 0 || profile.surroundings.every((tag) => tag === 'none-known'));
  const isEstimated = noData || site.appStatus === 'Offline sample';
  const verdict = verdictFromScore(score);

  const surroundWords =
    profile.surroundings.length === 0 || profile.surroundings.every((tag) => tag === 'none-known')
      ? labelWord(lang, 'surround.none-known')
      : profile.surroundings
          .filter((tag) => tag !== 'none-known')
          .map((tag) => labelWord(lang, `surround.${tag}`))
          .join(', ');

  const reason = f6Reason(lang, {
    irrigation: labelWord(lang, `irrigation.${profile.irrigation}`),
    shade: labelWord(lang, `shade.${profile.shade}`),
    surroundings: surroundWords,
    crop: crop.cropName,
    verdict: verdictWord(lang, verdict),
  });

  return baseFactor(
    'F6',
    site,
    'USER',
    `${labelWord(lang, `irrigation.${profile.irrigation}`)} irrigation, ${labelWord(lang, `shade.${profile.shade}`)} shade`,
    null,
    '',
    score,
    isEstimated,
    reason
  );
}

/** F7 — Rotation continuity, weight 10 (SOFT; rotation.ts applies hard rejects). */
export function scoreF7(site: SiteConditions, crop: CropDefinition, lang: Lang): FactorScore {
  const profile = site.profile;
  const prev = profile.previousCropUnknown ? null : getCrop(profile.previousCropId);
  let score = 100;
  let continuity: string;

  if (!prev) {
    score = 70;
    continuity = t(lang, 'f7.unknown');
  } else {
    if (prev.family === crop.family) continuity = t(lang, 'f7.sameFamily');
    else if (crop.nitrogenRole === 'Legume') continuity = t(lang, 'f7.addsNitrogen');
    else if (crop.nitrogenRole === 'Light feeder') continuity = t(lang, 'f7.restsSoil');
    else continuity = t(lang, 'f7.differentFamily');

    if (prev.family === crop.family) score -= 45;
    if (prev.nitrogenRole === 'Heavy feeder' && crop.nitrogenRole === 'Heavy feeder') score -= 35;
    else if (nitrogenSequenceOff(prev, crop)) score -= 25;
    if (prev.rootDepth === crop.rootDepth) score -= 20;
    if (sharesDiseaseGroup(prev, crop)) score -= 30;
  }
  score = clamp(score, 0, 100);
  const verdict = verdictFromScore(score);
  const isEstimated = !prev;

  const reason = f7Reason(lang, {
    prev: prev ? prev.cropName : t(lang, 'label.unknown'),
    family: prev ? prev.family : t(lang, 'label.unknown'),
    crop: crop.cropName,
    continuity,
    verdict: verdictWord(lang, verdict),
  });

  return baseFactor(
    'F7',
    site,
    'USER',
    prev ? prev.cropName : t(lang, 'label.unknown'),
    null,
    '',
    score,
    isEstimated,
    reason
  );
}

/** All seven factors, in stable published order, each with reason + source + freshness. */
export function scoreAllFactors(site: SiteConditions, crop: CropDefinition, lang: Lang): FactorScore[] {
  return [
    scoreF1(site, crop, lang),
    scoreF2(site, crop, lang),
    scoreF3(site, crop, lang),
    scoreF4(site, crop, lang),
    scoreF5(site, crop, lang),
    scoreF6(site, crop, lang),
    scoreF7(site, crop, lang),
  ];
}

export { sharesDiseaseGroup, adjacentTexture, cautionText };
