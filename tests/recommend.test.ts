import { describe, expect, it } from 'vitest';
import { DISCLAIMER, REGIONAL_ESTIMATE_CAVEAT } from '@/config/attribution';
import { FACTOR_ORDER, FACTOR_WEIGHTS, TOP_N_RECOMMENDATIONS } from '@/config/scoring';
import { offlineSite } from '@/api/orchestrator';
import { allCrops, getCrop } from '@/domain/crops';
import { recommend } from '@/domain/recommend';
import { buildOfflineRaw, sampleLocation } from '@/data/sample';
import { toSiteConditions } from '@/normalize/normalize';
import { defaultProfile } from '@/normalize/merge';
import type { Month } from '@/types/ui';

function siteFor(month: Month) {
  return toSiteConditions(buildOfflineRaw(month), sampleLocation(), defaultProfile());
}

describe('full offline recommendation (P0 acceptance path)', () => {
  it('builds a complete SiteConditions from bundled payloads only', () => {
    const site = offlineSite(undefined, undefined, 3);
    expect(site.appStatus).toBe('Offline sample');
    expect(site.targetMonth).toBe(3);
    expect(site.climate.monthly).toHaveLength(12);
    expect(site.monthlyForTarget.month).toBe(3);
    expect(site.provenance.length).toBeGreaterThan(0);
    expect(site.sources.length).toBeGreaterThan(0);
    expect(site.provenance.every((entry) => entry.isEstimated)).toBe(true);
    expect(site.provenance.every((entry) => entry.status === 'bundled sample')).toBe(true);
    expect(site.location.latitude).toBeCloseTo(-7.55, 5);
    expect(site.location.longitude).toBeCloseTo(110.42, 5);
  });

  it('returns a ranked top-N list with integers 0..100 in descending order', () => {
    const recommendations = recommend(siteFor(3), 'en');
    expect(recommendations).toHaveLength(TOP_N_RECOMMENDATIONS);
    recommendations.forEach((rec, index) => {
      expect(rec.rank).toBe(index + 1);
      expect(Number.isInteger(rec.score)).toBe(true);
      expect(rec.score).toBeGreaterThanOrEqual(0);
      expect(rec.score).toBeLessThanOrEqual(100);
      expect(getCrop(rec.cropId)).not.toBeNull();
      expect(rec.targetMonth).toBe(3);
      expect(rec.whatThisMeans.length).toBeGreaterThan(0);
      expect(rec.disclaimer).toBe(DISCLAIMER);
      if (index > 0) {
        expect(recommendations[index - 1].score).toBeGreaterThanOrEqual(rec.score);
      }
    });
  });

  it('explains all seven factors with reason, source, freshness and isEstimated', () => {
    const recommendations = recommend(siteFor(3), 'en');
    for (const rec of recommendations) {
      expect(rec.factorBreakdown).toHaveLength(7);
      expect(rec.factorBreakdown.map((factor) => factor.factorId)).toEqual(FACTOR_ORDER);
      for (const factor of rec.factorBreakdown) {
        expect(factor.weight).toBe(FACTOR_WEIGHTS[factor.factorId]);
        expect(factor.score).toBeGreaterThanOrEqual(0);
        expect(factor.score).toBeLessThanOrEqual(100);
        expect(['Good', 'Fair', 'Poor']).toContain(factor.verdict);
        expect(factor.reason.length).toBeGreaterThan(0);
        expect(factor.source.length).toBeGreaterThan(0);
        expect(factor.freshness.length).toBeGreaterThan(0);
        expect(typeof factor.isEstimated).toBe('boolean');
        // Offline sample: EVERY factor is estimated.
        expect(factor.isEstimated).toBe(true);
      }
      // Provenance is threaded through unchanged from the fetch layer.
      expect(rec.dataProvenance.map((entry) => entry.sourceId)).toEqual(
        siteFor(3).provenance.map((entry) => entry.sourceId)
      );
    }
  });

  it('is deterministic: same site + lang gives byte-identical output', () => {
    const site = siteFor(11);
    const first = recommend(site, 'en');
    const second = recommend(site, 'en');
    expect(first).toEqual(second);
    expect(first.map((rec) => rec.cropId)).toEqual(second.map((rec) => rec.cropId));
  });

  it('keeps scores stable across languages (lang is an argument, not a clock)', () => {
    const site = siteFor(6);
    const english = recommend(site, 'en');
    const indonesian = recommend(site, 'id');
    expect(english.map((rec) => rec.cropId)).toEqual(indonesian.map((rec) => rec.cropId));
    expect(english.map((rec) => rec.score)).toEqual(indonesian.map((rec) => rec.score));
    expect(english[0].factorBreakdown[0].reason).not.toBe(indonesian[0].factorBreakdown[0].reason);
  });

  it('attaches a three-season rotation plan and >=3 strategies to every result', () => {
    const recommendations = recommend(siteFor(1), 'en');
    for (const rec of recommendations) {
      expect(rec.rotationPlan.seasons).toHaveLength(3);
      expect(rec.rotationPlan.seasons[0].cropId).toBe(rec.cropId);
      expect(rec.strategies.length).toBeGreaterThanOrEqual(3);
      expect(rec.strategies.filter((strategy) => strategy.isExisting)).toHaveLength(1);
      expect(rec.strategies.every((strategy) => strategy.evidence.length > 0)).toBe(true);
      expect(rec.strategies.every((strategy) => strategy.informationGaps.length > 0)).toBe(true);
      expect(rec.strategies.every((strategy) => strategy.risks.length > 0)).toBe(true);
    }
  });

  it('carries a planting window, harvest range, difficulty and risk notes', () => {
    const recommendations = recommend(siteFor(3), 'en');
    for (const rec of recommendations) {
      expect(['Plant now', 'Wait until <Month>', 'Out of season']).toContain(rec.plantingWindow.status);
      expect(rec.plantingWindow.note.length).toBeGreaterThan(0);
      expect(rec.daysToHarvest.min).toBeLessThanOrEqual(rec.daysToHarvest.max);
      expect(['Easy', 'Moderate', 'Demanding']).toContain(rec.difficulty);
      expect(rec.difficultyReason.length).toBeGreaterThan(0);
      expect(Array.isArray(rec.riskNotes)).toBe(true);
      for (const risk of rec.riskNotes) {
        expect(risk.plainText.length).toBeGreaterThan(0);
        expect(risk.source.length).toBeGreaterThan(0);
        expect(risk.freshness.length).toBeGreaterThan(0);
      }
    }
  });

  it('works for every canonical month and never produces NaN or a blank list', () => {
    for (let month = 1; month <= 12; month += 1) {
      const recommendations = recommend(siteFor(month as Month), 'en');
      expect(recommendations.length).toBe(TOP_N_RECOMMENDATIONS);
      expect(recommendations.every((rec) => Number.isFinite(rec.score))).toBe(true);
      expect(recommendations.every((rec) => rec.factorBreakdown.length === 7)).toBe(true);
    }
  });

  it('never throws with a full "I don\'t know" profile and includes the regional caveat', () => {
    const site = offlineSite(undefined, undefined, 3);
    expect(site.profile.previousCropUnknown).toBe(true);
    expect(site.profile.soilTexture).toBe('unknown');
    expect(site.soil.isEstimated).toBe(true);
    expect(REGIONAL_ESTIMATE_CAVEAT.length).toBeGreaterThan(0);
    expect(() => recommend(site, 'en')).not.toThrow();
    expect(allCrops().length).toBeGreaterThanOrEqual(30);
  });
});
