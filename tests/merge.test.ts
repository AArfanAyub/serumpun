import { describe, expect, it } from 'vitest';
import { makeProvenance } from '@/config/sources';
import { SAMPLE_SOILGRIDS, SAMPLE_SOILGRIDS_NULL } from '@/data/sample';
import {
  defaultProfile,
  mergeProfile,
  remergeSite,
  soilFromSoilGrids,
  textureFromFractions,
} from '@/normalize/merge';
import { offlineSite } from '@/api/orchestrator';

const soilProv = makeProvenance('SOILGRIDS', { status: 'live', isEstimated: true });

describe('SoilGrids no-data and unit handling', () => {
  it('treats mean: null as a normal no-data outcome (never a crash, never blocking)', () => {
    const soil = soilFromSoilGrids(SAMPLE_SOILGRIDS_NULL, soilProv);
    expect(soil.texture).toBe('unknown');
    expect(soil.ph).toBeNull();
    expect(soil.clayPct).toBeNull();
    expect(soil.sandPct).toBeNull();
    expect(soil.origin).toBe('unknown');
    expect(soil.isEstimated).toBe(true);
    expect(soil.provenance.sourceId).toBe('SOILGRIDS');
  });

  it('treats a missing payload the same way', () => {
    const soil = soilFromSoilGrids(null, soilProv);
    expect(soil.texture).toBe('unknown');
    expect(soil.ph).toBeNull();
    expect(soil.isEstimated).toBe(true);
  });

  it('divides mapped integers by d_factor and STILL labels a successful value estimated', () => {
    const soil = soilFromSoilGrids(SAMPLE_SOILGRIDS, soilProv);
    // pH*10 -> 61/10 = 6.1; clay 370/10 = 37 (%); sand 280/10 = 28 (%); soc 145/10 = 14.5
    expect(soil.ph).toBeCloseTo(6.1, 5);
    expect(soil.clayPct).toBeCloseTo(37, 5);
    expect(soil.sandPct).toBeCloseTo(28, 5);
    expect(soil.socGkg).toBeCloseTo(14.5, 5);
    expect(soil.depthLabel).toBe('0-5cm');
    expect(soil.origin).toBe('soilgrids');
    expect(soil.isEstimated).toBe(true);
  });

  it('clamps pH into a sane agronomic range', () => {
    const highPh = {
      type: 'Feature',
      properties: {
        layers: [
          { name: 'phh2o', unit_measure: { d_factor: 1 }, depths: [{ label: '0-5cm', values: { mean: 99 } }] },
        ],
      },
    };
    expect(soilFromSoilGrids(highPh, soilProv).ph).toBe(10);
  });

  it('simplifies the USDA texture triangle from clay / sand fractions', () => {
    expect(textureFromFractions(40, 20)).toBe('clay');
    expect(textureFromFractions(10, 70)).toBe('sandy');
    expect(textureFromFractions(25, 35)).toBe('loam');
    expect(textureFromFractions(null, 35)).toBe('unknown');
    expect(textureFromFractions(25, null)).toBe('unknown');
  });
});

describe('field profile merge', () => {
  it('starts with "I don\'t know" everywhere and a neutral previous crop', () => {
    const profile = defaultProfile();
    expect(profile.soilTexture).toBe('unknown');
    expect(profile.soilPhOverride).toBeNull();
    expect(profile.irrigation).toBe('unknown');
    expect(profile.slope).toBe('unknown');
    expect(profile.shade).toBe('unknown');
    expect(profile.previousCropUnknown).toBe(true);
    expect(profile.previousCropId).toBeNull();
    expect(profile.priorities).toEqual([]);
  });

  it('returns the soil estimate untouched when the farmer answered nothing', () => {
    const soil = soilFromSoilGrids(SAMPLE_SOILGRIDS, soilProv);
    expect(mergeProfile(defaultProfile(), soil)).toBe(soil);
  });

  it('lets a self-reported texture and pH override win, labelled self-reported and estimated', () => {
    const soil = soilFromSoilGrids(SAMPLE_SOILGRIDS, soilProv);
    const profile = { ...defaultProfile(), soilTexture: 'loam' as const, soilPhOverride: 6.8 };
    const merged = mergeProfile(profile, soil);
    expect(merged.texture).toBe('loam');
    expect(merged.ph).toBe(6.8);
    expect(merged.origin).toBe('self-reported');
    expect(merged.isEstimated).toBe(true);
    expect(merged.provenance.sourceId).toBe('USER');
    expect(merged.provenance.status).toBe('self-reported');
  });

  it('clamps a self-reported pH into 4..9', () => {
    const soil = soilFromSoilGrids(SAMPLE_SOILGRIDS, soilProv);
    expect(mergeProfile({ ...defaultProfile(), soilPhOverride: 2 }, soil).ph).toBe(4);
    expect(mergeProfile({ ...defaultProfile(), soilPhOverride: 12 }, soil).ph).toBe(9);
  });
});

describe('remergeSite (no refetch)', () => {
  it('changes target month and monthlyForTarget without touching the network', () => {
    const site = offlineSite(undefined, undefined, 3);
    const changed = remergeSite(site, { targetMonth: 11 });
    expect(changed.targetMonth).toBe(11);
    expect(changed.monthlyForTarget.month).toBe(11);
    expect(changed.climate.monthly).toHaveLength(12);
    expect(site.targetMonth).toBe(3); // original is not mutated
    expect(changed.provenance.map((entry) => entry.sourceId)).toEqual(
      site.provenance.map((entry) => entry.sourceId)
    );
  });

  it('adds a USER provenance entry when the farmer supplies soil answers', () => {
    const site = offlineSite(undefined, undefined, 3);
    const profile = { ...defaultProfile(), soilTexture: 'clay' as const };
    const changed = remergeSite(site, { profile });
    expect(changed.profile.soilTexture).toBe('clay');
    expect(changed.soil.origin).toBe('self-reported');
    expect(changed.provenance.some((entry) => entry.sourceId === 'USER')).toBe(true);
  });
});
