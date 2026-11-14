import { describe, expect, it } from 'vitest';
import {
  CROP_FAIR_MIN,
  CROP_GOOD_MIN,
  FACTOR_FAIR_MIN,
  FACTOR_GOOD_MIN,
  FACTOR_ORDER,
  FACTOR_WEIGHTS,
  WEIGHTS_SUM,
} from '@/config/scoring';
import { allCrops } from '@/domain/crops';
import { verdictFromScore } from '@/domain/factors';
import {
  aggregateScore,
  compareScored,
  confidenceRank,
  cropVerdictFromScore,
  weightsSum,
  type ScoredCrop,
} from '@/domain/scoring';
import { bandFromCompleteness, completenessFrom } from '@/domain/confidence';
import { offlineSite } from '@/api/orchestrator';
import type { FactorScore } from '@/types/domain';
import type { ConfidenceLevel, FactorId } from '@/types/ui';

function factor(factorId: FactorId, score: number): FactorScore {
  return {
    factorId,
    name: factorId,
    weight: FACTOR_WEIGHTS[factorId],
    observedValue: '',
    rawValue: score,
    unit: '',
    score,
    verdict: 'Good',
    reason: 'test reason',
    source: 'test source',
    sourceId: 'BUNDLED',
    freshness: 'test freshness',
    isEstimated: false,
  };
}

function scored(overrides: Partial<ScoredCrop> & { cropId: string }): ScoredCrop {
  const { cropId, ...rest } = overrides;
  return {
    crop: { ...allCrops()[0], cropId },
    factors: [],
    score: 60,
    cropVerdict: 'Worth considering',
    completenessScore: 60,
    confidence: 'Medium',
    confidenceReason: '',
    ...rest,
  };
}

describe('published scoring weights', () => {
  it('sums to exactly 100 with the PRD values', () => {
    expect(weightsSum()).toBe(100);
    expect(WEIGHTS_SUM).toBe(100);
    expect(FACTOR_WEIGHTS).toEqual({ F1: 20, F2: 20, F3: 15, F4: 15, F5: 10, F6: 10, F7: 10 });
    expect(FACTOR_ORDER).toEqual(['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7']);
  });

  it('aggregates a weighted mean into an integer 0..100', () => {
    const perfect = FACTOR_ORDER.map((id) => factor(id, 100));
    expect(aggregateScore(perfect)).toBe(100);
    const zero = FACTOR_ORDER.map((id) => factor(id, 0));
    expect(aggregateScore(zero)).toBe(0);
    const half = FACTOR_ORDER.map((id) => factor(id, 50));
    expect(aggregateScore(half)).toBe(50);
    const mixed = [
      factor('F1', 100), factor('F2', 100), factor('F3', 100), factor('F4', 100),
      factor('F5', 0), factor('F6', 0), factor('F7', 0),
    ];
    // F1..F4 carry 70 of the 100 points.
    expect(aggregateScore(mixed)).toBe(70);
    expect(Number.isInteger(aggregateScore(FACTOR_ORDER.map((id) => factor(id, 37))))).toBe(true);
  });

  it('clamps out-of-range factor scores', () => {
    const over = FACTOR_ORDER.map((id) => factor(id, 500));
    expect(aggregateScore(over)).toBe(100);
    const under = FACTOR_ORDER.map((id) => factor(id, -50));
    expect(aggregateScore(under)).toBe(0);
  });

  it('maps scores to crop and factor verdict bands', () => {
    expect(cropVerdictFromScore(CROP_GOOD_MIN)).toBe('Good fit');
    expect(cropVerdictFromScore(CROP_GOOD_MIN - 1)).toBe('Worth considering');
    expect(cropVerdictFromScore(CROP_FAIR_MIN)).toBe('Worth considering');
    expect(cropVerdictFromScore(CROP_FAIR_MIN - 1)).toBe('Poor fit');
    expect(verdictFromScore(FACTOR_GOOD_MIN)).toBe('Good');
    expect(verdictFromScore(FACTOR_FAIR_MIN)).toBe('Fair');
    expect(verdictFromScore(FACTOR_FAIR_MIN - 1)).toBe('Poor');
  });
});

describe('deterministic final ordering', () => {
  it('ranks by score desc, then confidence desc, then completeness desc, then cropId asc', () => {
    expect(confidenceRank('High')).toBeGreaterThan(confidenceRank('Medium'));
    expect(confidenceRank('Medium')).toBeGreaterThan(confidenceRank('Low'));

    const highScore = scored({ cropId: 'aaa', score: 80 });
    const lowScore = scored({ cropId: 'bbb', score: 60 });
    expect(compareScored(highScore, lowScore)).toBeLessThan(0);
    expect(compareScored(lowScore, highScore)).toBeGreaterThan(0);

    const highConf = scored({ cropId: 'b', score: 70, confidence: 'High' });
    const lowConf = scored({ cropId: 'a', score: 70, confidence: 'Low' });
    expect(compareScored(highConf, lowConf)).toBeLessThan(0);

    const moreComplete = scored({ cropId: 'z', score: 70, confidence: 'Medium', completenessScore: 90 });
    const lessComplete = scored({ cropId: 'a', score: 70, confidence: 'Medium', completenessScore: 10 });
    expect(compareScored(moreComplete, lessComplete)).toBeLessThan(0);

    const alpha = scored({ cropId: 'alpha', score: 70, confidence: 'Medium', completenessScore: 50 });
    const beta = scored({ cropId: 'beta', score: 70, confidence: 'Medium', completenessScore: 50 });
    expect(compareScored(alpha, beta)).toBeLessThan(0);
    expect(compareScored(alpha, alpha)).toBe(0);
  });

  it('produces a stable, repeatable sort', () => {
    const list: ScoredCrop[] = [
      scored({ cropId: 'c', score: 50, confidence: 'Low' as ConfidenceLevel }),
      scored({ cropId: 'a', score: 70, confidence: 'High' as ConfidenceLevel }),
      scored({ cropId: 'b', score: 70, confidence: 'Medium' as ConfidenceLevel }),
      scored({ cropId: 'd', score: 50, confidence: 'High' as ConfidenceLevel }),
    ];
    const first = [...list].sort(compareScored).map((item) => item.crop.cropId);
    const second = [...list].sort(compareScored).map((item) => item.crop.cropId);
    expect(first).toEqual(second);
    expect(first).toEqual(['a', 'b', 'd', 'c']);
  });
});

describe('confidence is separate from score', () => {
  it('maps completeness to High / Medium / Low bands', () => {
    expect(bandFromCompleteness(95)).toBe('High');
    expect(bandFromCompleteness(60)).toBe('Medium');
    expect(bandFromCompleteness(10)).toBe('Low');
  });

  it('reduces completeness for estimated, fallback, coarse, offline and unknown-previous-crop data', () => {
    const site = offlineSite(undefined, undefined, 3);
    const clean = FACTOR_ORDER.map((id) => factor(id, 60));
    const estimated = FACTOR_ORDER.map((id) => ({ ...factor(id, 60), isEstimated: true }));
    expect(completenessFrom(site, estimated, 60)).toBeLessThan(
      completenessFrom(site, clean, 60)
    );
    // Offline sample is always the lowest-confidence situation.
    expect(site.appStatus).toBe('Offline sample');
    expect(completenessFrom(site, estimated, 60)).toBeLessThan(80);
    // A score near a verdict boundary lowers completeness further.
    expect(completenessFrom(site, clean, CROP_GOOD_MIN)).toBeLessThanOrEqual(
      completenessFrom(site, clean, 60)
    );
  });
});
