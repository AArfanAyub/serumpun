import { describe, expect, it } from 'vitest';
import { allCrops, CROP_DB, cropsByFamily, getCrop, neutralPrevCrop, validateCropDB } from '@/domain/crops';
import { isMonth } from '@/domain/membership';
import type { CropDefinition } from '@/types/domain';

describe('curated crop database', () => {
  it('validates cleanly with at least 30 crops and unique ids', () => {
    const result = validateCropDB();
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.count).toBeGreaterThanOrEqual(30);
    const ids = CROP_DB.map((crop) => crop.cropId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers the required tropical and temperate smallholder crops', () => {
    const ids = new Set(CROP_DB.map((crop) => crop.cropId));
    const required = [
      'rice', 'maize', 'cassava', 'sweet-potato', 'soybean', 'peanut', 'mung-bean',
      'cowpea', 'chili', 'tomato', 'eggplant', 'cucumber', 'shallot', 'cabbage',
      'carrot', 'potato', 'banana', 'sugarcane', 'coffee', 'cocoa', 'ginger',
      'turmeric', 'sorghum', 'millet', 'sesame', 'sunflower', 'wheat', 'barley',
      'oats', 'peas', 'lentils', 'chickpea', 'pumpkin', 'kangkung', 'long-bean', 'taro',
    ];
    for (const id of required) expect(ids.has(id)).toBe(true);
  });

  it('has all three nitrogen roles and several botanical families', () => {
    const roles = new Set(CROP_DB.map((crop) => crop.nitrogenRole));
    expect(roles.has('Legume')).toBe(true);
    expect(roles.has('Heavy feeder')).toBe(true);
    expect(roles.has('Light feeder')).toBe(true);
    expect(cropsByFamily().size).toBeGreaterThan(8);
    expect(cropsByFamily().get('Fabaceae')?.length).toBeGreaterThan(3);
  });

  it('has complete, ordered requirement ranges and valid planting months for every crop', () => {
    for (const crop of CROP_DB) {
      const req = crop.requirements;
      for (const range of [req.temperatureC, req.rainfallMmMonth, req.ph]) {
        expect(range.min).toBeLessThanOrEqual(range.optMin);
        expect(range.optMin).toBeLessThanOrEqual(range.optMax);
        expect(range.optMax).toBeLessThanOrEqual(range.max);
      }
      expect(req.elevationM.min).toBeLessThanOrEqual(req.elevationM.max);
      expect(req.texture.length).toBeGreaterThan(0);
      expect(req.slopeTolerance.length).toBeGreaterThan(0);
      expect(req.shadeTolerance.length).toBeGreaterThan(0);
      expect(crop.plantingMonths.every(isMonth)).toBe(true);
      expect(crop.plantingMonths.length).toBeGreaterThan(0);
      expect(isMonth(crop.plantingWindow.startMonth)).toBe(true);
      expect(isMonth(crop.plantingWindow.endMonth)).toBe(true);
      expect(crop.daysToHarvest.min).toBeLessThanOrEqual(crop.daysToHarvest.max);
      expect(crop.literature.length).toBeGreaterThan(0);
      expect(crop.notes.length).toBeGreaterThan(0);
    }
  });

  it('looks up crops by id and returns null for unknown/missing ids', () => {
    expect(getCrop('rice')?.cropName).toBeTruthy();
    expect(getCrop('does-not-exist')).toBeNull();
    expect(getCrop(null)).toBeNull();
    expect(allCrops()).toBe(CROP_DB);
    expect(Object.isFrozen(CROP_DB)).toBe(true);
  });

  it('rejects an invalid crop database', () => {
    const broken: CropDefinition[] = [
      { ...CROP_DB[0], cropId: 'dup' },
      { ...CROP_DB[0], cropId: 'dup', nitrogenRole: 'Wrong' as CropDefinition['nitrogenRole'] },
    ];
    const result = validateCropDB(broken);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('at least 30'))).toBe(true);
    expect(result.errors.some((error) => error.includes('Duplicate'))).toBe(true);
    expect(result.errors.some((error) => error.includes('invalid nitrogenRole'))).toBe(true);
  });
});

describe('neutral previous crop assumption', () => {
  it('is a non-legume, medium-root, family-free placeholder and says so', () => {
    const prev = neutralPrevCrop();
    expect(prev.nitrogenRole).toBe('Light feeder');
    expect(prev.rootDepth).toBe('Medium');
    expect(prev.family).toBe('__none__');
    expect(prev.diseaseGroups).toEqual([]);
    expect(prev.notes.toLowerCase()).toContain('neutral');
    expect(prev.plantingWindow.startMonth).toBe(1);
    expect(prev.plantingWindow.endMonth).toBe(12);
  });
});
