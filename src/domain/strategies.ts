import { SEASON_DAYS } from '@/config/scoring';
import { t } from '@/i18n';
import type { Provenance } from '@/types/data';
import type {
  CropDefinition,
  RotationPlan,
  RotationStrategy,
  SiteConditions,
} from '@/types/domain';
import type { Lang, Month, WaterNeed } from '@/types/ui';
import { getCrop, neutralPrevCrop } from './crops';
import { monthName, roundToInt, wetnessWord, clamp } from './membership';
import { buildRotationPlan, countHardViolations, type StrategyWeights } from './rotation';

interface StrategySpec {
  strategyId: string;
  labelKey: string;
  summaryKey: string;
  weights: StrategyWeights;
  isExisting: boolean;
  plan?: RotationPlan;
}

function provenance(site: SiteConditions, sourceId: string): Provenance {
  return site.provenance.find((entry) => entry.sourceId === sourceId) ?? site.climate.provenance;
}

function cropsOf(plan: RotationPlan): CropDefinition[] {
  const crops: CropDefinition[] = [];
  for (const season of plan.seasons) {
    const crop = getCrop(season.cropId);
    if (crop) crops.push(crop);
  }
  return crops;
}

function majorityWater(crops: readonly CropDefinition[]): WaterNeed {
  const counts: Record<WaterNeed, number> = { Low: 0, Medium: 0, High: 0 };
  for (const crop of crops) counts[crop.waterNeed] += 1;
  if (counts.High >= counts.Medium && counts.High >= counts.Low) return 'High';
  if (counts.Medium >= counts.Low) return 'Medium';
  return 'Low';
}

function bareFieldWeeks(crops: readonly CropDefinition[]): number {
  let weeks = 0;
  for (const crop of crops) {
    weeks += Math.max(0, SEASON_DAYS - crop.daysToHarvest.max) / 7;
  }
  return roundToInt(weeks);
}

function ruleViolationsOf(site: SiteConditions, plan: RotationPlan): number {
  const crops = cropsOf(plan);
  if (crops.length !== 3) return 1;
  const prevKnown =
    !site.profile.previousCropUnknown && plan.previousCrop.cropId !== null;
  const prev = prevKnown ? getCrop(plan.previousCrop.cropId) ?? neutralPrevCrop() : neutralPrevCrop();
  const months: [Month, Month, Month] = [
    plan.seasons[0].targetMonth,
    plan.seasons[1].targetMonth,
    plan.seasons[2].targetMonth,
  ];
  return countHardViolations(prev, crops[0], crops[1], crops[2], months);
}

function comparisonOf(site: SiteConditions, plan: RotationPlan): RotationStrategy['comparison'] {
  const crops = cropsOf(plan);
  const legumes = crops.filter((crop) => crop.nitrogenRole === 'Legume').length;
  const heavy = crops.filter((crop) => crop.nitrogenRole === 'Heavy feeder').length;
  const ruleViolations = ruleViolationsOf(site, plan);
  const avgFitScore = roundToInt(
    plan.seasons.reduce((sum, season) => sum + season.fitScore, 0) / plan.seasons.length
  );
  let rootAlternation = 0;
  for (let i = 0; i < crops.length - 1; i += 1) {
    if (crops[i].rootDepth !== crops[i + 1].rootDepth) rootAlternation += 1;
  }
  const soilHealthScore = roundToInt(
    clamp(48 + legumes * 12 - heavy * 6 + rootAlternation * 5 - ruleViolations * 20 + avgFitScore * 0.15, 0, 100)
  );
  const nitrogenBalance: RotationStrategy['comparison']['nitrogenBalance'] =
    legumes >= 1 && heavy <= 1 ? 'building' : heavy >= 2 ? 'depleting' : 'neutral';

  return {
    soilHealthScore,
    waterDemand: majorityWater(crops),
    nitrogenBalance,
    bareFieldWeeks: bareFieldWeeks(crops),
    ruleViolations,
    avgFitScore,
  };
}

function evidenceOf(site: SiteConditions, lang: Lang): string[] {
  const climate = provenance(site, 'NASA_POWER');
  const current = provenance(site, 'OPEN_METEO');
  const soil = provenance(site, site.soil.provenance.sourceId);
  const mc = site.monthlyForTarget;
  const phText = site.soil.ph === null ? 'unknown' : (Math.round(site.soil.ph * 10) / 10).toFixed(1);
  return [
    t(lang, 'strategy.evidence.climate', {
      month: monthName(site.targetMonth),
      temp: roundToInt(mc.t2mC),
      rain: roundToInt(mc.precipMm),
      source: climate.source,
      freshness: climate.freshness,
    }),
    t(lang, 'strategy.evidence.current', {
      temp: roundToInt(site.current.temperatureC),
      humidity: roundToInt(site.current.humidityPct),
      source: current.source,
      freshness: current.freshness,
    }),
    t(lang, 'strategy.evidence.soil', {
      soil: site.soil.texture,
      ph: phText,
      source: soil.source,
      freshness: soil.freshness,
    }),
    t(lang, 'strategy.evidence.crops'),
  ];
}

function benefitsOf(
  site: SiteConditions,
  plan: RotationPlan,
  comparison: RotationStrategy['comparison'],
  lang: Lang
): string[] {
  const crops = cropsOf(plan);
  const legumes = crops.filter((crop) => crop.nitrogenRole === 'Legume').length;
  const benefits: string[] = [];
  if (legumes > 0) benefits.push(t(lang, 'strategy.benefit.legume'));
  if (new Set(crops.map((crop) => crop.family)).size === crops.length) {
    benefits.push(t(lang, 'strategy.benefit.family'));
  }
  if (crops.some((crop, index) => index > 0 && crop.rootDepth !== crops[index - 1].rootDepth)) {
    benefits.push(t(lang, 'strategy.benefit.root'));
  }
  if (comparison.bareFieldWeeks < 6) benefits.push(t(lang, 'strategy.benefit.cover'));
  if (comparison.waterDemand === 'Low') benefits.push(t(lang, 'strategy.benefit.water'));
  if (crops.some((crop) => crop.daysToHarvest.max <= 75)) {
    benefits.push(t(lang, 'strategy.benefit.quick'));
  }
  if (site.profile.priorities.length > 0) {
    benefits.push(
      `Your priorities were used as a soft preference: ${site.profile.priorities.join(', ')}.`
    );
  }
  return benefits;
}

function informationGapsOf(lang: Lang, isExisting: boolean): string[] {
  const gaps = [
    t(lang, 'strategy.gap.soil'),
    t(lang, 'strategy.gap.pest'),
    t(lang, 'strategy.gap.market'),
    t(lang, 'strategy.gap.clock'),
    t(lang, 'strategy.gap.yield'),
  ];
  if (isExisting) gaps.unshift(t(lang, 'strategy.inferred'));
  return gaps;
}

function risksOf(lang: Lang, plan: RotationPlan): string[] {
  const risks = [
    t(lang, 'strategy.risk.local'),
    t(lang, 'strategy.risk.tentative'),
    t(lang, 'strategy.risk.input'),
    t(lang, 'strategy.risk.variety'),
  ];
  if (plan.noConfidentMatch) {
    risks.unshift('Needs local review: no fully confident rotation match was found for this field.');
  }
  return risks;
}

function vulnerableSeasonsOf(plan: RotationPlan, lang: Lang): string[] {
  const result: string[] = [];
  plan.seasons.forEach((season, index) => {
    const crop = getCrop(season.cropId);
    const weeks = crop ? Math.max(0, SEASON_DAYS - crop.daysToHarvest.max) / 7 : 0;
    if (weeks >= 2) {
      result.push(t(lang, 'strategy.vulnerable.text', { index: index + 1, weeks: roundToInt(weeks) }));
    }
  });
  if (result.length === 0) result.push(t(lang, 'strategy.vulnerable.none'));
  return result;
}

/**
 * >= 3 comparable strategies, exactly one `isExisting`. Each has evidence referencing a
 * source + freshness, benefits, information gaps, risks needing LOCAL review, vulnerable
 * seasons and a comparable metric set. Every strategy wraps a full 3-season plan.
 */
export function buildStrategies(
  site: SiteConditions,
  s1: CropDefinition,
  primaryPlan: RotationPlan,
  lang: Lang
): RotationStrategy[] {
  const specs: StrategySpec[] = [
    {
      strategyId: 'existing',
      labelKey: 'strategy.existing',
      summaryKey: 'strategy.summary.existing',
      weights: { heavyFeederBonus: 14, avoidLegumeBonus: 14, quickHarvestBonus: 4 },
      isExisting: true,
    },
    {
      strategyId: 'balanced',
      labelKey: 'strategy.balanced',
      summaryKey: 'strategy.summary.balanced',
      weights: {},
      isExisting: false,
      plan: primaryPlan,
    },
    {
      strategyId: 'soil-restoring',
      labelKey: 'strategy.soilRestoring',
      summaryKey: 'strategy.summary.soilRestoring',
      weights: { legumeBonus: 20, soilCoverBonus: 14, erosionBonus: 10 },
      isExisting: false,
    },
    {
      strategyId: 'water-saving',
      labelKey: 'strategy.waterSaving',
      summaryKey: 'strategy.summary.waterSaving',
      weights: { lowWaterBonus: 22 },
      isExisting: false,
    },
    {
      strategyId: 'quick-income',
      labelKey: 'strategy.quickIncome',
      summaryKey: 'strategy.summary.quickIncome',
      weights: { quickHarvestBonus: 22 },
      isExisting: false,
    },
  ];

  const evidence = evidenceOf(site, lang);

  return specs.map((spec) => {
    const plan =
      spec.plan ??
      buildRotationPlan(site, s1, lang, {
        strategyId: spec.strategyId,
        weights: spec.weights,
      });
    const comparison = comparisonOf(site, plan);
    return {
      strategyId: spec.strategyId,
      label: t(lang, spec.labelKey),
      isExisting: spec.isExisting,
      summary: t(lang, spec.summaryKey),
      plan,
      evidence: [...evidence],
      benefits: benefitsOf(site, plan, comparison, lang),
      informationGaps: informationGapsOf(lang, spec.isExisting),
      risks: risksOf(lang, plan),
      vulnerableSeasons: vulnerableSeasonsOf(plan, lang),
      comparison,
    };
  });
}

/** Build just the "existing rotation" baseline plan (exported for tests). */
export function buildExistingStrategyPlan(
  site: SiteConditions,
  s1: CropDefinition,
  lang: Lang
): RotationPlan {
  return buildRotationPlan(site, s1, lang, {
    strategyId: 'existing',
    weights: { heavyFeederBonus: 14, avoidLegumeBonus: 14, quickHarvestBonus: 4 },
  });
}

export { wetnessWord };
