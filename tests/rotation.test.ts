import { describe, expect, it } from 'vitest';
import { SEASON_OFFSETS } from '@/config/scoring';
import { allCrops, getCrop, neutralPrevCrop } from '@/domain/crops';
import { addMonths } from '@/domain/membership';
import {
  buildRotationPlan,
  countHardViolations,
  isHardValid,
  seasonFitScore,
  windowOverlaps,
} from '@/domain/rotation';
import { offlineSite } from '@/api/orchestrator';
import type { CropDefinition, SiteConditions } from '@/types/domain';
import type { Month } from '@/types/ui';

let syntheticSeq = 0;

/** Each synthetic crop gets a unique family so tests isolate ONE hard rule at a time. */
function synthetic(overrides: Partial<CropDefinition> = {}): CropDefinition {
  syntheticSeq += 1;
  return {
    ...neutralPrevCrop(),
    cropId: `synthetic-${syntheticSeq}`,
    cropName: `Synthetic crop ${syntheticSeq}`,
    family: `Family${syntheticSeq}`,
    nitrogenRole: 'Light feeder',
    rootDepth: 'Medium',
    diseaseGroups: [],
    plantingWindow: { startMonth: 1, endMonth: 12, bestMonth: 1 },
    ...overrides,
  };
}

const MONTHS: [Month, Month, Month] = [3, 7, 11];

describe('rotation hard rules', () => {
  it('accepts a clean chain and rejects same-family neighbours', () => {
    const prev = neutralPrevCrop();
    const c1 = synthetic({ family: 'FamA' });
    const c2 = synthetic({ family: 'FamB' });
    const c3 = synthetic({ family: 'FamC' });
    expect(isHardValid(prev, c1, c2, c3, MONTHS)).toBe(true);
    expect(countHardViolations(prev, c1, c2, c3, MONTHS)).toBe(0);

    const sameFamily = synthetic({ family: 'FamA' });
    expect(isHardValid(prev, c1, sameFamily, c3, MONTHS)).toBe(false);
    expect(countHardViolations(prev, c1, sameFamily, c3, MONTHS)).toBeGreaterThan(0);
  });

  it('rejects two heavy feeders back-to-back', () => {
    const prev = neutralPrevCrop();
    const c1 = synthetic({ nitrogenRole: 'Heavy feeder' });
    const c2 = synthetic({ nitrogenRole: 'Heavy feeder' });
    const c3 = synthetic();
    expect(isHardValid(prev, c1, c2, c3, MONTHS)).toBe(false);
  });

  it('rejects Deep-Deep and Shallow-Shallow consecutive root depths', () => {
    const prev = neutralPrevCrop();
    const deep1 = synthetic({ rootDepth: 'Deep' });
    const deep2 = synthetic({ rootDepth: 'Deep' });
    expect(isHardValid(prev, deep1, deep2, synthetic(), MONTHS)).toBe(false);

    const shallow1 = synthetic({ rootDepth: 'Shallow' });
    const shallow2 = synthetic({ rootDepth: 'Shallow' });
    expect(isHardValid(prev, shallow1, shallow2, synthetic(), MONTHS)).toBe(false);

    // Alternating depths is allowed.
    expect(isHardValid(prev, deep1, synthetic({ rootDepth: 'Shallow' }), synthetic({ rootDepth: 'Deep' }), MONTHS)).toBe(true);
  });

  it('rejects a shared disease group at distance 1 (disease break)', () => {
    const prev = neutralPrevCrop();
    const c1 = synthetic({ diseaseGroups: ['soilborne-fungus'] });
    const c2 = synthetic({ diseaseGroups: ['soilborne-fungus'] });
    expect(isHardValid(prev, c1, c2, synthetic(), MONTHS)).toBe(false);
  });

  it('requires seasons 2 and 3 to overlap their planting windows', () => {
    const prev = neutralPrevCrop();
    const c1 = synthetic();
    const c2 = synthetic({ plantingWindow: { startMonth: 1, endMonth: 2, bestMonth: 1 } });
    const c3 = synthetic();
    // Month 7 is outside the c2 window -> hard reject.
    expect(isHardValid(prev, c1, c2, c3, MONTHS)).toBe(false);
    expect(countHardViolations(prev, c1, c2, c3, MONTHS)).toBeGreaterThan(0);
  });

  it('supports wrap-around planting windows', () => {
    const crop = synthetic({ plantingWindow: { startMonth: 11, endMonth: 2, bestMonth: 12 } });
    expect(windowOverlaps(crop, 11)).toBe(true);
    expect(windowOverlaps(crop, 1)).toBe(true);
    expect(windowOverlaps(crop, 2)).toBe(true);
    expect(windowOverlaps(crop, 6)).toBe(false);
  });

  it('computes climatology-only season fit in 0..100', () => {
    const site = offlineSite(undefined, undefined, 3);
    for (const crop of allCrops()) {
      const fit = seasonFitScore(crop, site.monthlyForTarget);
      expect(fit).toBeGreaterThanOrEqual(0);
      expect(fit).toBeLessThanOrEqual(100);
      expect(Number.isFinite(fit)).toBe(true);
    }
  });
});

describe('three-season rotation plan assembly', () => {
  it('produces exactly three seasons with four-month offsets and a fixed season 1', () => {
    const site = offlineSite(undefined, undefined, 3);
    const s1 = getCrop('maize')!;
    const plan = buildRotationPlan(site, s1, 'en', { strategyId: 'balanced' });

    expect(plan.seasons).toHaveLength(3);
    expect(plan.seasons[0].seasonIndex).toBe(1);
    expect(plan.seasons[1].seasonIndex).toBe(2);
    expect(plan.seasons[2].seasonIndex).toBe(3);
    expect(plan.seasons[0].cropId).toBe(s1.cropId);
    expect(plan.seasons[0].targetMonth).toBe(3);
    expect(plan.seasons[1].targetMonth).toBe(addMonths(3, SEASON_OFFSETS[1]!));
    expect(plan.seasons[2].targetMonth).toBe(addMonths(3, SEASON_OFFSETS[2]!));
    expect(plan.transitionReasons).toHaveLength(3);
    expect(plan.transitionReasons.every((reason) => reason.length > 0)).toBe(true);
    expect(plan.strategyId).toBe('balanced');
    expect(plan.disclaimer.length).toBeGreaterThan(0);
  });

  it('marks seasons 2 and 3 tentative and gives every season reasons', () => {
    const site = offlineSite(undefined, undefined, 3);
    const plan = buildRotationPlan(site, getCrop('rice')!, 'en');
    expect(plan.seasons[0].tentative).toBe(false);
    expect(plan.seasons[1].tentative).toBe(true);
    expect(plan.seasons[2].tentative).toBe(true);
    expect(plan.seasons[1].tentativeNotice).toBeTruthy();
    expect(plan.seasons.every((season) => season.reasons.length > 0)).toBe(true);
    expect(plan.seasons.every((season) => season.periodLabel.length > 0)).toBe(true);
    for (const season of plan.seasons) {
      expect(season.fitScore).toBeGreaterThanOrEqual(0);
      expect(season.fitScore).toBeLessThanOrEqual(100);
      expect(['High', 'Medium', 'Low']).toContain(season.confidence);
      expect(getCrop(season.cropId)).not.toBeNull();
    }
  });

  it('assumes and discloses a neutral non-legume medium-root previous crop by default', () => {
    const site = offlineSite(undefined, undefined, 3);
    const plan = buildRotationPlan(site, getCrop('soybean')!, 'en');
    expect(plan.previousCrop.assumedNeutral).toBe(true);
    expect(plan.previousCrop.cropId).toBeNull();
    expect(plan.previousCrop.note.toLowerCase()).toMatch(/unknown|neutral|assum/);
  });

  it('honours a reported previous crop instead of assuming', () => {
    const site = offlineSite(undefined, undefined, 3);
    const withPrev: SiteConditions = {
      ...site,
      profile: {
        ...site.profile,
        previousCropUnknown: false,
        previousCropId: 'maize',
      },
    };
    const plan = buildRotationPlan(withPrev, getCrop('cowpea')!, 'en');
    expect(plan.previousCrop.assumedNeutral).toBe(false);
    expect(plan.previousCrop.cropId).toBe('maize');
    expect(plan.previousCrop.note).toContain('reported');
  });

  it('is fully deterministic and never silently breaks a hard rule', () => {
    const site = offlineSite(undefined, undefined, 8);
    const s1 = getCrop('cassava')!;
    const first = buildRotationPlan(site, s1, 'en');
    const second = buildRotationPlan(site, s1, 'en');
    expect(first).toEqual(second);

    if (!first.noConfidentMatch) {
      const prev = neutralPrevCrop();
      const [c1, c2, c3] = [
        getCrop(first.seasons[0].cropId),
        getCrop(first.seasons[1].cropId),
        getCrop(first.seasons[2].cropId),
      ];
      expect(c1 && c2 && c3).toBeTruthy();
      expect(
        isHardValid(prev, c1!, c2!, c3!, [
          first.seasons[0].targetMonth,
          first.seasons[1].targetMonth,
          first.seasons[2].targetMonth,
        ])
      ).toBe(true);
    } else {
      expect(first.noMatchNote).toBeTruthy();
      expect(first.seasons.every((season) => season.confidence === 'Low')).toBe(true);
    }
  });
});
