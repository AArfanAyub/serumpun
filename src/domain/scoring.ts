import { CROP_FAIR_MIN, CROP_GOOD_MIN, FACTOR_WEIGHTS, WEIGHTS_SUM } from '@/config/scoring';
import type { CropDefinition, FactorScore } from '@/types/domain';
import type { ConfidenceLevel, CropVerdict } from '@/types/ui';
import { clamp, roundToInt } from './membership';

export interface ScoredCrop {
  crop: CropDefinition;
  factors: FactorScore[];
  score: number;
  cropVerdict: CropVerdict;
  completenessScore: number;
  confidence: ConfidenceLevel;
  confidenceReason: string;
}

/** Weighted sum -> integer 0..100. Weights sum to 100 (asserted in tests). */
export function aggregateScore(factors: readonly FactorScore[]): number {
  const total = factors.reduce((sum, factor) => sum + factor.score * factor.weight, 0);
  return roundToInt(clamp(total / (WEIGHTS_SUM || 100), 0, 100));
}

export function cropVerdictFromScore(score: number): CropVerdict {
  if (score >= CROP_GOOD_MIN) return 'Good fit';
  if (score >= CROP_FAIR_MIN) return 'Worth considering';
  return 'Poor fit';
}

export function confidenceRank(level: ConfidenceLevel): number {
  return level === 'High' ? 3 : level === 'Medium' ? 2 : 1;
}

/**
 * Deterministic final ordering: score desc -> confidence desc -> completeness desc ->
 * cropId asc. No randomness, no Date, no network.
 */
export function compareScored(a: ScoredCrop, b: ScoredCrop): number {
  if (a.score !== b.score) return b.score - a.score;
  const confidenceDelta = confidenceRank(b.confidence) - confidenceRank(a.confidence);
  if (confidenceDelta !== 0) return confidenceDelta;
  if (a.completenessScore !== b.completenessScore) {
    return b.completenessScore - a.completenessScore;
  }
  return a.crop.cropId.localeCompare(b.crop.cropId);
}

export function weightsSum(): number {
  return Object.values(FACTOR_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
}
