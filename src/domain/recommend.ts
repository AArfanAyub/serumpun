import { TOP_N_RECOMMENDATIONS, WATER_DEMAND_MM } from '@/config/scoring';
import { DISCLAIMER } from '@/config/attribution';
import { t } from '@/i18n';
import type { CropDefinition, CropRecommendation, SiteConditions } from '@/types/domain';
import type { Lang } from '@/types/ui';
import { allCrops } from './crops';
import { computeConfidence } from './confidence';
import {
  cropVerdictLabel,
  labelWord,
  plantingWindowFromScore,
  whatThisMeans,
} from './explain';
import { scoreAllFactors } from './factors';
import { monthName } from './membership';
import { buildRotationPlan } from './rotation';
import { aggregateScore, compareScored, cropVerdictFromScore, type ScoredCrop } from './scoring';
import { buildStrategies } from './strategies';
import { buildRiskNotes } from './risks';

function waterSentenceFor(
  site: SiteConditions,
  crop: CropDefinition,
  f2Score: number,
  lang: Lang
): string {
  if (f2Score >= 70) return t(lang, 'whatThisMeans.waterGood');
  if (site.monthlyForTarget.precipMm > 2 * WATER_DEMAND_MM[crop.waterNeed]) {
    return t(lang, 'whatThisMeans.waterHigh');
  }
  return t(lang, 'whatThisMeans.waterLow');
}

/**
 * Top-level PURE orchestration: `f(SiteConditions, lang) -> CropRecommendation[]`.
 * No fetch, no Date.now(), no Math.random(). `targetMonth` lives inside `site`.
 */
export function recommend(site: SiteConditions, lang: Lang = 'en'): CropRecommendation[] {
  const scored: ScoredCrop[] = allCrops().map((crop) => {
    const factors = scoreAllFactors(site, crop, lang);
    const score = aggregateScore(factors);
    const cropVerdict = cropVerdictFromScore(score);
    const { completenessScore, confidence, confidenceReason } = computeConfidence(
      site,
      factors,
      score,
      lang
    );
    return {
      crop,
      factors,
      score,
      cropVerdict,
      completenessScore,
      confidence,
      confidenceReason,
    };
  });

  scored.sort(compareScored);
  const top = scored.slice(0, TOP_N_RECOMMENDATIONS);

  return top.map((entry, index): CropRecommendation => {
    const { crop } = entry;
    const f4 = entry.factors.find((factor) => factor.factorId === 'F4');
    const f2 = entry.factors.find((factor) => factor.factorId === 'F2');
    const plantingWindow = plantingWindowFromScore(
      lang,
      crop,
      site.targetMonth,
      f4 ? f4.score : 20
    );
    const waterSentence = waterSentenceFor(site, crop, f2 ? f2.score : 50, lang);
    const rotationPlan = buildRotationPlan(site, crop, lang, { strategyId: 'balanced' });
    const strategies = buildStrategies(site, crop, rotationPlan, lang);

    return {
      rank: index + 1,
      cropId: crop.cropId,
      cropName: crop.cropName,
      localName: crop.localName,
      score: entry.score,
      confidence: entry.confidence,
      confidenceReason: entry.confidenceReason,
      completenessScore: entry.completenessScore,
      verdict: entry.cropVerdict,
      factorBreakdown: entry.factors,
      whatThisMeans: whatThisMeans(lang, {
        crop: crop.cropName,
        score: entry.score,
        month: monthName(site.targetMonth),
        verdict: cropVerdictLabel(lang, entry.cropVerdict),
        waterSentence,
      }),
      plantingWindow,
      daysToHarvest: { ...crop.daysToHarvest },
      waterNeed: crop.waterNeed,
      waterNeedNote: `${labelWord(lang, `water.${crop.waterNeed}`)} water need. ${waterSentence}`,
      difficulty: crop.difficulty,
      difficultyReason: crop.difficultyReason,
      riskNotes: buildRiskNotes(site, crop, lang),
      dataProvenance: [...site.provenance],
      rotationPlan,
      strategies,
      disclaimer: DISCLAIMER,
      targetMonth: site.targetMonth,
    };
  });
}
