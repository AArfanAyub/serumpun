import {
  MIN_SEASON_FIT,
  PRIORITY_BONUS,
  SEASON_OFFSETS,
  WATER_DEMAND_MM,
} from '@/config/scoring';
import { DISCLAIMER, NO_MATCH_NOTE, REGIONAL_ESTIMATE_CAVEAT, TENTATIVE_NOTICE } from '@/config/attribution';
import { t } from '@/i18n';
import type { CropDefinition, MonthlyClimate, RotationPlan, RotationSeason, SiteConditions } from '@/types/domain';
import type { ConfidenceLevel, FarmerPriority, Lang, Month } from '@/types/ui';
import { getCrop, neutralPrevCrop, allCrops } from './crops';
import { cautionText, rotationRule, seasonPeriodLabel, transitionReason } from './explain';
import {
  addMonths,
  clamp,
  monthWithinWindow,
  roundToInt,
  trapezoid,
} from './membership';

export interface StrategyWeights {
  legumeBonus?: number;
  lowWaterBonus?: number;
  quickHarvestBonus?: number;
  erosionBonus?: number;
  soilCoverBonus?: number;
  nitrogenBonus?: number;
  heavyFeederBonus?: number;
  avoidLegumeBonus?: number;
}

export interface RotationOptions {
  strategyId?: string;
  weights?: StrategyWeights;
}

interface Candidate {
  c2: CropDefinition;
  c3: CropDefinition;
  utility: number;
  cautions: [string[], string[], string[]];
  violations: number;
}

export function windowOverlaps(crop: CropDefinition, month: Month): boolean {
  return monthWithinWindow(month, crop.plantingWindow.startMonth, crop.plantingWindow.endMonth);
}

/**
 * Season fit for a FUTURE month: climatology only, never the 16-day forecast.
 * 0.5 * temperature trapezoid + 0.5 * water-balance trapezoid.
 */
export function seasonFitScore(crop: CropDefinition, monthly: MonthlyClimate): number {
  const temp = crop.requirements.temperatureC;
  const temperature = trapezoid(monthly.t2mC, temp.min, temp.optMin, temp.optMax, temp.max);
  const demand = WATER_DEMAND_MM[crop.waterNeed];
  const ratio = monthly.precipMm / Math.max(1, demand);
  const water = trapezoid(ratio, 0.4, 0.85, 1.3, 2.2);
  return clamp(0.5 * temperature + 0.5 * water, 0, 100);
}

function sharedDisease(a: CropDefinition, b: CropDefinition): boolean {
  return a.diseaseGroups.some((group) => b.diseaseGroups.includes(group));
}

const NITROGEN_RANK: Readonly<Record<CropDefinition['nitrogenRole'], number>> = {
  Legume: 0,
  'Heavy feeder': 1,
  'Light feeder': 2,
};

function pairViolations(a: CropDefinition, b: CropDefinition): string[] {
  const violations: string[] = [];
  if (a.family !== '__none__' && a.family === b.family) violations.push('family');
  if (a.nitrogenRole === 'Heavy feeder' && b.nitrogenRole === 'Heavy feeder') {
    violations.push('two-heavy');
  }
  if (
    (a.rootDepth === 'Deep' && b.rootDepth === 'Deep') ||
    (a.rootDepth === 'Shallow' && b.rootDepth === 'Shallow')
  ) {
    violations.push('root-depth');
  }
  if (sharedDisease(a, b)) violations.push('disease-break');
  return violations;
}

/**
 * The six hard rules (PRD 6.2 / architecture 8.2).
 *
 * Hard rejects: same family, two heavy feeders back-to-back, Deep-Deep / Shallow-Shallow
 * consecutive, a shared disease group at distance 1, and no planting-window overlap for
 * the CHOSEN seasons 2 and 3. Season 1 is FIXED by the recommendation, not selected by
 * this search; if its window does not include the current month the plan carries an
 * explicit caution instead of silently hiding the problem.
 *
 * Everything else (preferred N sequence, Medium-Medium roots, distance-2 shared disease,
 * low season fit) is a soft score / caution, never a hidden rule break.
 */
export function isHardValid(
  prev: CropDefinition,
  c1: CropDefinition,
  c2: CropDefinition,
  c3: CropDefinition,
  months: readonly [Month, Month, Month]
): boolean {
  const chain = [prev, c1, c2, c3];
  for (let i = 0; i < chain.length - 1; i += 1) {
    if (pairViolations(chain[i], chain[i + 1]).length > 0) return false;
  }
  if (!windowOverlaps(c2, months[1])) return false;
  if (!windowOverlaps(c3, months[2])) return false;
  return true;
}

/** Count hard-rule violations for the honest "closest option" fallback. */
export function countHardViolations(
  prev: CropDefinition,
  c1: CropDefinition,
  c2: CropDefinition,
  c3: CropDefinition,
  months: readonly [Month, Month, Month]
): number {
  const chain = [prev, c1, c2, c3];
  let count = 0;
  for (let i = 0; i < chain.length - 1; i += 1) count += pairViolations(chain[i], chain[i + 1]).length;
  if (!windowOverlaps(c2, months[1])) count += 1;
  if (!windowOverlaps(c3, months[2])) count += 1;
  return count;
}

function nitrogenSequenceCredit(chain: readonly CropDefinition[]): number {
  let credit = 0;
  for (let i = 0; i < chain.length - 1; i += 1) {
    const from = NITROGEN_RANK[chain[i].nitrogenRole];
    const to = NITROGEN_RANK[chain[i + 1].nitrogenRole];
    if ((to === from + 1) || (from === 2 && to === 0)) credit += 8;
  }
  return credit;
}

function rootAlternationCredit(chain: readonly CropDefinition[]): number {
  let credit = 0;
  for (let i = 0; i < chain.length - 1; i += 1) {
    const a = chain[i].rootDepth;
    const b = chain[i + 1].rootDepth;
    if (a === 'Medium' && b === 'Medium') credit -= 4;
    else if (a !== b) credit += 6;
  }
  return credit;
}

function priorityBonus(priorities: readonly FarmerPriority[], chain: readonly CropDefinition[]): number {
  if (priorities.length === 0) return 0;
  const chosen = chain.slice(1);
  const legumes = chosen.filter((crop) => crop.nitrogenRole === 'Legume').length;
  const lowWater = chosen.filter((crop) => crop.waterNeed === 'Low').length;
  const easy = chosen.filter((crop) => crop.difficulty === 'Easy').length;
  const quick = chosen.filter((crop) => crop.daysToHarvest.max <= 90).length;
  const deepOrCover = chosen.filter(
    (crop) => crop.rootDepth === 'Deep' || crop.daysToHarvest.max <= 75
  ).length;
  const forage = chosen.filter((crop) =>
    ['alfalfa', 'clover', 'oats', 'sorghum', 'millet'].includes(crop.cropId)
  ).length;
  let bonus = 0;
  for (const priority of priorities) {
    switch (priority) {
      case 'low-water':
        bonus += PRIORITY_BONUS[priority] * (lowWater / chosen.length);
        break;
      case 'drought-tolerance':
        bonus += PRIORITY_BONUS[priority] * (lowWater / chosen.length);
        break;
      case 'nitrogen-fixation':
        bonus += PRIORITY_BONUS[priority] * (legumes / chosen.length);
        break;
      case 'organic-matter':
        bonus += PRIORITY_BONUS[priority] * (legumes / chosen.length);
        break;
      case 'erosion-reduction':
        bonus += PRIORITY_BONUS[priority] * (deepOrCover / chosen.length);
        break;
      case 'forage':
        bonus += PRIORITY_BONUS[priority] * (forage / chosen.length);
        break;
      case 'quick-harvest':
        bonus += PRIORITY_BONUS[priority] * (quick / chosen.length);
        break;
      case 'low-labour':
        bonus += PRIORITY_BONUS[priority] * (easy / chosen.length);
        break;
      case 'market-suitability':
        bonus += PRIORITY_BONUS[priority] * (quick / chosen.length);
        break;
      default:
        break;
    }
  }
  return bonus;
}

function strategyBonus(weights: StrategyWeights, chain: readonly CropDefinition[]): number {
  const chosen = chain.slice(1);
  let bonus = 0;
  const legumes = chosen.filter((crop) => crop.nitrogenRole === 'Legume').length;
  const lowWater = chosen.filter((crop) => crop.waterNeed === 'Low').length;
  const quick = chosen.filter((crop) => crop.daysToHarvest.max <= 90).length;
  const cover = chosen.filter((crop) => crop.daysToHarvest.max <= 75).length;
  const heavy = chosen.filter((crop) => crop.nitrogenRole === 'Heavy feeder').length;
  if (weights.legumeBonus) bonus += weights.legumeBonus * legumes;
  if (weights.nitrogenBonus) bonus += weights.nitrogenBonus * legumes;
  if (weights.avoidLegumeBonus) bonus -= weights.avoidLegumeBonus * legumes;
  if (weights.heavyFeederBonus) bonus += weights.heavyFeederBonus * heavy;
  if (weights.lowWaterBonus) bonus += weights.lowWaterBonus * lowWater;
  if (weights.quickHarvestBonus) bonus += weights.quickHarvestBonus * quick;
  if (weights.erosionBonus) bonus += weights.erosionBonus * cover;
  if (weights.soilCoverBonus) bonus += weights.soilCoverBonus * cover;
  return bonus;
}

function seasonCautions(
  lang: Lang,
  chain: readonly CropDefinition[],
  months: readonly [Month, Month, Month],
  fits: readonly [number, number, number]
): [string[], string[], string[]] {
  const cautions: [string[], string[], string[]] = [[], [], []];

  for (let i = 0; i < 3; i += 1) {
    if (fits[i] < MIN_SEASON_FIT) {
      cautions[i].push(cautionText(lang, 'fit', { score: roundToInt(fits[i]) }));
    }
  }

  if (!windowOverlaps(chain[1], months[0])) {
    cautions[0].push(cautionText(lang, 'c1Window'));
  }

  for (let i = 0; i < 3; i += 1) {
    const a = chain[i];
    const b = chain[i + 1];
    if (a.rootDepth === 'Medium' && b.rootDepth === 'Medium') {
      cautions[Math.min(i + 1, 2)].push(cautionText(lang, 'mediumRoot'));
    }
  }

  // Shared disease group at distance 2 -> caution, not a hard reject.
  for (const [i, j] of [
    [0, 2],
    [1, 3],
  ] as const) {
    const group = chain[i].diseaseGroups.find((item) => chain[j].diseaseGroups.includes(item));
    if (group) {
      cautions[Math.min(j - 1, 2)].push(cautionText(lang, 'disease2', { group }));
    }
  }

  return cautions;
}

function seasonReasons(lang: Lang, chain: readonly CropDefinition[], index: 0 | 1 | 2): string[] {
  const from = chain[index];
  const to = chain[index + 1];
  const reasons: string[] = [];
  if (from.family !== to.family) reasons.push(rotationRule(lang, 'family'));
  const fromRank = NITROGEN_RANK[from.nitrogenRole];
  const toRank = NITROGEN_RANK[to.nitrogenRole];
  if (toRank === fromRank + 1 || (fromRank === 2 && toRank === 0)) {
    reasons.push(rotationRule(lang, 'nitrogen'));
  }
  if (from.rootDepth !== to.rootDepth) reasons.push(rotationRule(lang, 'root'));
  if (!sharedDisease(from, to)) reasons.push(rotationRule(lang, 'disease'));
  reasons.push(rotationRule(lang, 'season'));
  return reasons;
}

function fitConfidence(site: SiteConditions, fit: number): ConfidenceLevel {
  if (fit >= 70 && site.appStatus === 'Live') return 'High';
  if (fit >= 50) return 'Medium';
  return 'Low';
}

function assemblePlan(
  site: SiteConditions,
  lang: Lang,
  prev: CropDefinition,
  prevKnown: boolean,
  chain: [CropDefinition, CropDefinition, CropDefinition],
  months: readonly [Month, Month, Month],
  fits: readonly [number, number, number],
  cautions: [string[], string[], string[]],
  strategyId: string,
  noConfidentMatch: boolean,
  weakRules: string[]
): RotationPlan {
  const seasonList: RotationSeason[] = chain.map((crop, index) => {
    const seasonIndex = (index + 1) as 1 | 2 | 3;
    const tentative = seasonIndex !== 1;
    const seasonCautions = [...cautions[index]];
    if (tentative) seasonCautions.push(TENTATIVE_NOTICE);
    if (noConfidentMatch && index === 0) {
      seasonCautions.push(
        t(lang, 'rotation.noMatchWeak', { rules: weakRules.join(', ') || 'no fully valid sequence' })
      );
    }
    return {
      seasonIndex,
      periodLabel: seasonPeriodLabel(lang, seasonIndex, months[index]),
      targetMonth: months[index],
      cropId: crop.cropId,
      cropName: crop.cropName,
      family: crop.family,
      nitrogenRole: crop.nitrogenRole,
      rootDepth: crop.rootDepth,
      fitScore: roundToInt(fits[index]),
      confidence: noConfidentMatch ? 'Low' : fitConfidence(site, fits[index]),
      reasons: seasonReasons(lang, [prev, ...chain], index as 0 | 1 | 2),
      cautions: seasonCautions,
      tentative,
      tentativeNotice: tentative ? TENTATIVE_NOTICE : undefined,
    };
  });

  const prevName = prevKnown ? prev.cropName : t(lang, 'label.unknown');
  const transitionReasons: [string, string, string] = [
    transitionReason(lang, prevName, chain[0].cropName, seasonReasons(lang, [prev, ...chain], 0), !prevKnown),
    transitionReason(lang, chain[0].cropName, chain[1].cropName, seasonReasons(lang, [prev, ...chain], 1)),
    transitionReason(lang, chain[1].cropName, chain[2].cropName, seasonReasons(lang, [prev, ...chain], 2)),
  ];

  return {
    seasons: [seasonList[0], seasonList[1], seasonList[2]],
    transitionReasons,
    previousCrop: {
      cropId: prevKnown ? prev.cropId : null,
      assumedNeutral: !prevKnown,
      note: prevKnown
        ? `${prev.cropName} (${prev.family}) was reported as the previous crop.`
        : t(lang, 'rotation.neutral'),
    },
    strategyId,
    noConfidentMatch,
    noMatchNote: noConfidentMatch
      ? `${NO_MATCH_NOTE} ${t(lang, 'rotation.noMatchWeak', {
          rules: weakRules.join(', ') || 'no fully valid three-season sequence',
        })} ${REGIONAL_ESTIMATE_CAVEAT}`
      : undefined,
    disclaimer: DISCLAIMER,
  };
}

/**
 * Build exactly 3 seasons. Exhaustive DFS over all crop pairs (<= 40^2 = 1600 combos),
 * keeping only fully hard-valid sequences. If none exists, return the closest honest
 * option with `noConfidentMatch: true` — never a silent rule break, never a fabricated
 * confident plan.
 */
export function buildRotationPlan(
  site: SiteConditions,
  s1: CropDefinition,
  lang: Lang,
  options: RotationOptions = {}
): RotationPlan {
  const months: [Month, Month, Month] = [
    site.targetMonth,
    addMonths(site.targetMonth, SEASON_OFFSETS[1] ?? 4),
    addMonths(site.targetMonth, SEASON_OFFSETS[2] ?? 8),
  ];
  const prevKnown = !site.profile.previousCropUnknown && getCrop(site.profile.previousCropId) !== null;
  const prev = prevKnown ? getCrop(site.profile.previousCropId)! : neutralPrevCrop();
  const weights = options.weights ?? {};
  const strategyId = options.strategyId ?? 'balanced';

  const monthClimate: [MonthlyClimate, MonthlyClimate, MonthlyClimate] = [
    site.climate.monthly[months[0] - 1],
    site.climate.monthly[months[1] - 1],
    site.climate.monthly[months[2] - 1],
  ];

  const fitFor = (crop: CropDefinition, index: number): number =>
    seasonFitScore(crop, monthClimate[index]);
  const fit1 = fitFor(s1, 0);
  const crops = allCrops();
  let best: Candidate | null = null;
  let closest: Candidate | null = null;

  for (const c2 of crops) {
    const fit2 = fitFor(c2, 1);
    for (const c3 of crops) {
      const chain: [CropDefinition, CropDefinition, CropDefinition] = [s1, c2, c3];
      const fullChain = [prev, ...chain];
      const fits: [number, number, number] = [fit1, fit2, fitFor(c3, 2)];
      const cautions = seasonCautions(lang, fullChain, months, fits);
      const cautionCount = cautions.reduce((sum, list) => sum + list.length, 0);
      const utility =
        fits[0] +
        fits[1] +
        fits[2] +
        nitrogenSequenceCredit(fullChain) +
        rootAlternationCredit(fullChain) +
        priorityBonus(site.profile.priorities, fullChain) +
        strategyBonus(weights, fullChain) -
        cautionCount * 5;

      const violations = countHardViolations(prev, s1, c2, c3, months);
      const candidate: Candidate = { c2, c3, utility, cautions, violations };

      if (!closest || violations < closest.violations || (violations === closest.violations && utility > closest.utility)) {
        closest = candidate;
      }

      if (violations === 0 && isHardValid(prev, s1, c2, c3, months)) {
        if (!best || utility > best.utility) best = candidate;
      }
    }
  }

  if (best) {
    const chain: [CropDefinition, CropDefinition, CropDefinition] = [s1, best.c2, best.c3];
    const fits: [number, number, number] = [fit1, fitFor(best.c2, 1), fitFor(best.c3, 2)];
    return assemblePlan(
      site,
      lang,
      prev,
      prevKnown,
      chain,
      months,
      fits,
      best.cautions,
      strategyId,
      false,
      []
    );
  }

  // No combination satisfies all hard rules: honest closest option, confidence Low.
  const chain: [CropDefinition, CropDefinition, CropDefinition] = closest
    ? [s1, closest.c2, closest.c3]
    : [s1, s1, s1];
  const fits: [number, number, number] = [
    fit1,
    fitFor(chain[1], 1),
    fitFor(chain[2], 2),
  ];
  const weakRules: string[] = [];
  if (closest && closest.violations > 0) {
    weakRules.push(`${closest.violations} hard-rule conflict(s)`);
  }
  if (!windowOverlaps(chain[0], months[0])) weakRules.push('season 1 planting window');
  if (fits.some((fit) => fit < MIN_SEASON_FIT)) weakRules.push('low climate fit in a future season');

  return assemblePlan(
    site,
    lang,
    prev,
    prevKnown,
    chain,
    months,
    fits,
    closest ? closest.cautions : [[], [], []],
    strategyId,
    true,
    weakRules
  );
}
