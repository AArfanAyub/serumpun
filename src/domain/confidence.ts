import {
  BOUNDARY_DISTANCE,
  CONFIDENCE_HIGH_MIN,
  CONFIDENCE_MEDIUM_MIN,
  CROP_FAIR_MIN,
  CROP_GOOD_MIN,
} from '@/config/scoring';
import { t } from '@/i18n';
import type { FactorScore, SiteConditions } from '@/types/domain';
import type { ConfidenceLevel, Lang } from '@/types/ui';
import { confidenceReason as formatConfidenceReason } from './explain';
import { clamp, roundToInt } from './membership';

export interface ConfidenceResult {
  completenessScore: number;
  confidence: ConfidenceLevel;
  confidenceReason: string;
}

export function completenessFrom(site: SiteConditions, factors: readonly FactorScore[], score: number): number {
  const estimatedCount = factors.filter((factor) => factor.isEstimated).length;
  let completeness = 100 - Math.min(45, 15 * estimatedCount);

  if (site.sources.some((source) => source.fallbackUsed)) completeness -= 20;
  if (site.location.isCoarse) completeness -= 15;
  const nearBoundary =
    Math.abs(score - CROP_GOOD_MIN) <= BOUNDARY_DISTANCE ||
    Math.abs(score - CROP_FAIR_MIN) <= BOUNDARY_DISTANCE;
  if (nearBoundary) completeness -= 10;
  if (site.profile.previousCropUnknown) completeness -= 10;
  if (site.appStatus === 'Offline sample') completeness -= 10;

  return roundToInt(clamp(completeness, 0, 100));
}

export function bandFromCompleteness(completeness: number): ConfidenceLevel {
  if (completeness >= CONFIDENCE_HIGH_MIN) return 'High';
  if (completeness >= CONFIDENCE_MEDIUM_MIN) return 'Medium';
  return 'Low';
}

/** Confidence is separate from the score; every reduction carries a plain-language reason. */
export function computeConfidence(
  site: SiteConditions,
  factors: readonly FactorScore[],
  score: number,
  lang: Lang
): ConfidenceResult {
  const completenessScore = completenessFrom(site, factors, score);
  const confidence = bandFromCompleteness(completenessScore);
  const triggers: string[] = [];

  const estimatedCount = factors.filter((factor) => factor.isEstimated).length;
  if (estimatedCount > 0) {
    triggers.push(t(lang, 'confidence.reason.estimated', { count: estimatedCount }));
  }
  if (site.sources.some((source) => source.fallbackUsed)) {
    triggers.push(t(lang, 'confidence.reason.fallback'));
  }
  if (site.location.isCoarse) triggers.push(t(lang, 'confidence.reason.coarse'));
  const nearBoundary =
    Math.abs(score - CROP_GOOD_MIN) <= BOUNDARY_DISTANCE ||
    Math.abs(score - CROP_FAIR_MIN) <= BOUNDARY_DISTANCE;
  if (nearBoundary) triggers.push(t(lang, 'confidence.reason.boundary'));
  if (site.profile.previousCropUnknown) triggers.push(t(lang, 'confidence.reason.prevUnknown'));
  if (site.appStatus === 'Offline sample') triggers.push(t(lang, 'confidence.reason.offline'));

  return {
    completenessScore,
    confidence,
    confidenceReason: formatConfidenceReason(lang, confidence, triggers),
  };
}
