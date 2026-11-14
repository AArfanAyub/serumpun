import type { FactorId, FarmerPriority, WaterNeed } from '@/types/ui';

/** PRD 5.1 weights. MUST sum to 100 and are published verbatim in "Scoring method". */
export const FACTOR_WEIGHTS: Readonly<Record<FactorId, number>> = Object.freeze({
  F1: 20,
  F2: 20,
  F3: 15,
  F4: 15,
  F5: 10,
  F6: 10,
  F7: 10,
});

export const FACTOR_NAMES: Readonly<Record<FactorId, string>> = Object.freeze({
  F1: 'Temperature fit',
  F2: 'Water fit',
  F3: 'Soil fit',
  F4: 'Season / planting window',
  F5: 'Terrain & erosion',
  F6: 'Surroundings & field context',
  F7: 'Rotation continuity',
});

export const FACTOR_ORDER: readonly FactorId[] = Object.freeze([
  'F1',
  'F2',
  'F3',
  'F4',
  'F5',
  'F6',
  'F7',
]);

export const WEIGHTS_SUM = Object.values(FACTOR_WEIGHTS).reduce((sum, w) => sum + w, 0);

/** Factor-level verdict bands (applied to each 0..100 factor score). */
export const FACTOR_GOOD_MIN = 75;
export const FACTOR_FAIR_MIN = 45;

/** Crop-level verdict bands (applied to the aggregate integer score). */
export const CROP_GOOD_MIN = 75;
export const CROP_FAIR_MIN = 50;

/** Confidence bands on the internal 0..100 completeness scale. */
export const CONFIDENCE_HIGH_MIN = 80;
export const CONFIDENCE_MEDIUM_MIN = 50;

/** Near a verdict boundary reduces confidence. */
export const BOUNDARY_DISTANCE = 3;

/** Rotation: three broad ~4-month blocks (PRD Q4), and minimum climatology fit. */
export const SEASON_OFFSETS: readonly number[] = Object.freeze([0, 4, 8]);
export const MIN_SEASON_FIT = 45;

/** F2 water model constants (mm per month). */
export const IRRIGATION_BONUS_MM: Readonly<Record<'none' | 'partial' | 'reliable' | 'unknown', number>> =
  Object.freeze({ none: 0, partial: 30, reliable: 80, unknown: 0 });

export const WATER_DEMAND_MM: Readonly<Record<WaterNeed, number>> = Object.freeze({
  Low: 60,
  Medium: 110,
  High: 180,
});

/** ET0 contributes a fraction of the monthly evaporative demand. */
export const ET0_DEMAND_FACTOR = 0.35;

/** Planting-window score used by F4. */
export const WINDOW_SCORE_BEST = 100;
export const WINDOW_SCORE_IN = 85;
export const WINDOW_SCORE_WAIT = 55;
export const WINDOW_SCORE_OUT = 20;

/** Neutral starting score for F6 surroundings. */
export const SURROUNDINGS_NEUTRAL = 70;

/** Soft bonuses in rotation strategy utility. */
export const PRIORITY_BONUS: Readonly<Record<FarmerPriority, number>> = Object.freeze({
  'low-water': 18,
  'drought-tolerance': 16,
  'nitrogen-fixation': 18,
  'erosion-reduction': 14,
  'organic-matter': 12,
  forage: 10,
  'quick-harvest': 16,
  'market-suitability': 6,
  'low-labour': 12,
});

/** How many recommendations S4 shows. */
export const TOP_N_RECOMMENDATIONS = 5;

/** A 4-month season in days, used for the bare-field estimate. */
export const SEASON_DAYS = 122;
