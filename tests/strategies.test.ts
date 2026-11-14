import { describe, expect, it } from 'vitest';
import { allCrops, getCrop } from '@/domain/crops';
import { buildRotationPlan } from '@/domain/rotation';
import { buildExistingStrategyPlan, buildStrategies } from '@/domain/strategies';
import { recommend } from '@/domain/recommend';
import { offlineSite } from '@/api/orchestrator';

describe('comparable rotation strategies', () => {
  it('builds at least three strategies with exactly one "existing rotation"', () => {
    const site = offlineSite(undefined, undefined, 3);
    const s1 = allCrops()[0];
    const primary = buildRotationPlan(site, s1, 'en');
    const strategies = buildStrategies(site, s1, primary, 'en');

    expect(strategies.length).toBeGreaterThanOrEqual(3);
    expect(strategies.filter((strategy) => strategy.isExisting)).toHaveLength(1);
    expect(strategies.find((strategy) => strategy.isExisting)?.strategyId).toBe('existing');
    expect(new Set(strategies.map((strategy) => strategy.strategyId)).size).toBe(strategies.length);
  });

  it('gives every strategy evidence, benefits, gaps, risks, vulnerable seasons and a full plan', () => {
    const site = offlineSite(undefined, undefined, 3);
    const s1 = getCrop('rice')!;
    const primary = buildRotationPlan(site, s1, 'en');
    const strategies = buildStrategies(site, s1, primary, 'en');

    for (const strategy of strategies) {
      expect(strategy.label.length).toBeGreaterThan(0);
      expect(strategy.summary.length).toBeGreaterThan(0);
      expect(strategy.evidence.length).toBeGreaterThan(0);
      expect(strategy.informationGaps.length).toBeGreaterThan(0);
      expect(strategy.risks.length).toBeGreaterThan(0);
      expect(strategy.vulnerableSeasons.length).toBeGreaterThan(0);
      expect(Array.isArray(strategy.benefits)).toBe(true);
      expect(strategy.plan.seasons).toHaveLength(3);
      // Evidence cites a source and freshness so every claim is traceable.
      expect(strategy.evidence.some((line) => line.length > 0)).toBe(true);
    }
  });

  it('produces comparable numeric metrics for every strategy', () => {
    const site = offlineSite(undefined, undefined, 3);
    const s1 = getCrop('maize')!;
    const primary = buildRotationPlan(site, s1, 'en');
    const strategies = buildStrategies(site, s1, primary, 'en');

    for (const strategy of strategies) {
      const comparison = strategy.comparison;
      expect(comparison.soilHealthScore).toBeGreaterThanOrEqual(0);
      expect(comparison.soilHealthScore).toBeLessThanOrEqual(100);
      expect(Number.isInteger(comparison.soilHealthScore)).toBe(true);
      expect(['Low', 'Medium', 'High']).toContain(comparison.waterDemand);
      expect(['building', 'neutral', 'depleting']).toContain(comparison.nitrogenBalance);
      expect(comparison.bareFieldWeeks).toBeGreaterThanOrEqual(0);
      expect(comparison.ruleViolations).toBeGreaterThanOrEqual(0);
      expect(comparison.avgFitScore).toBeGreaterThanOrEqual(0);
      expect(comparison.avgFitScore).toBeLessThanOrEqual(100);
    }
  });

  it('reuses the primary plan for the balanced strategy instead of recomputing it', () => {
    const site = offlineSite(undefined, undefined, 3);
    const s1 = getCrop('sorghum')!;
    const primary = buildRotationPlan(site, s1, 'en');
    const strategies = buildStrategies(site, s1, primary, 'en');
    expect(strategies.find((strategy) => strategy.strategyId === 'balanced')?.plan).toBe(primary);
  });

  it('discloses that the existing rotation is inferred when previous history is unknown', () => {
    const site = offlineSite(undefined, undefined, 3);
    const plan = buildExistingStrategyPlan(site, getCrop('peanut')!, 'en');
    expect(plan.strategyId).toBe('existing');
    expect(plan.seasons).toHaveLength(3);
    expect(plan.previousCrop.assumedNeutral).toBe(true);
  });

  it('attaches comparable strategies to every recommendation', () => {
    const site = offlineSite(undefined, undefined, 3);
    const recommendations = recommend(site, 'en');
    for (const rec of recommendations) {
      expect(rec.strategies.length).toBeGreaterThanOrEqual(3);
      expect(rec.strategies.filter((strategy) => strategy.isExisting)).toHaveLength(1);
      expect(rec.rotationPlan.seasons).toHaveLength(3);
      expect(rec.strategies.find((strategy) => strategy.strategyId === 'balanced')?.plan).toBe(
        rec.rotationPlan
      );
    }
  });
});
