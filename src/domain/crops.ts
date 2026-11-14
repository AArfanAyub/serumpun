import cropsJson from '@/data/crops.json';
import type { CropDefinition } from '@/types/domain';

/** Curated, literature-based, in-repo crop database. No network, no account, no key. */
export const CROP_DB: readonly CropDefinition[] = Object.freeze(
  (cropsJson as unknown as CropDefinition[]).map((crop) => ({ ...crop }))
);

const byId = new Map<string, CropDefinition>();
for (const crop of CROP_DB) {
  byId.set(crop.cropId, crop);
}

export function allCrops(): readonly CropDefinition[] {
  return CROP_DB;
}

export function getCrop(cropId: string | null | undefined): CropDefinition | null {
  if (!cropId) return null;
  return byId.get(cropId) ?? null;
}

export function cropsByFamily(): ReadonlyMap<string, readonly CropDefinition[]> {
  const result = new Map<string, CropDefinition[]>();
  for (const crop of CROP_DB) {
    const list = result.get(crop.family) ?? [];
    list.push(crop);
    result.set(crop.family, list);
  }
  return result;
}

export interface CropDbValidation {
  valid: boolean;
  errors: string[];
  count: number;
}

/** Load-time validation: every crop must carry complete requirement ranges and rotation tags. */
export function validateCropDB(db: readonly CropDefinition[] = CROP_DB): CropDbValidation {
  const errors: string[] = [];
  if (db.length < 30) errors.push(`Crop DB has only ${db.length} crops; at least 30 are required.`);

  const ids = new Set<string>();
  for (const crop of db) {
    const tag = crop.cropId || '(missing id)';
    if (!crop.cropId) errors.push('A crop is missing cropId.');
    if (ids.has(crop.cropId)) errors.push(`Duplicate cropId: ${tag}`);
    ids.add(crop.cropId);
    if (!crop.cropName) errors.push(`${tag}: missing cropName`);
    if (!crop.family) errors.push(`${tag}: missing family`);
    if (!['Legume', 'Heavy feeder', 'Light feeder'].includes(crop.nitrogenRole)) {
      errors.push(`${tag}: invalid nitrogenRole`);
    }
    if (!['Shallow', 'Medium', 'Deep'].includes(crop.rootDepth)) {
      errors.push(`${tag}: invalid rootDepth`);
    }
    if (!Array.isArray(crop.diseaseGroups)) errors.push(`${tag}: missing diseaseGroups`);
    if (!Array.isArray(crop.plantingMonths) || crop.plantingMonths.length === 0) {
      errors.push(`${tag}: missing plantingMonths`);
    }
    if (!crop.plantingWindow) errors.push(`${tag}: missing plantingWindow`);
    if (!crop.daysToHarvest) errors.push(`${tag}: missing daysToHarvest`);
    if (!['Low', 'Medium', 'High'].includes(crop.waterNeed)) errors.push(`${tag}: invalid waterNeed`);
    if (!['Easy', 'Moderate', 'Demanding'].includes(crop.difficulty)) {
      errors.push(`${tag}: invalid difficulty`);
    }
    const req = crop.requirements;
    if (!req) {
      errors.push(`${tag}: missing requirements`);
      continue;
    }
    for (const key of ['temperatureC', 'rainfallMmMonth', 'ph'] as const) {
      const range = req[key];
      if (
        !range ||
        !Number.isFinite(range.min) ||
        !Number.isFinite(range.optMin) ||
        !Number.isFinite(range.optMax) ||
        !Number.isFinite(range.max)
      ) {
        errors.push(`${tag}: incomplete ${key} range`);
      }
    }
    if (!req.elevationM || !Number.isFinite(req.elevationM.min) || !Number.isFinite(req.elevationM.max)) {
      errors.push(`${tag}: incomplete elevationM range`);
    }
    if (!Array.isArray(req.texture) || req.texture.length === 0) {
      errors.push(`${tag}: missing acceptable textures`);
    }
    if (!Array.isArray(req.slopeTolerance)) errors.push(`${tag}: missing slopeTolerance`);
    if (!Array.isArray(req.shadeTolerance)) errors.push(`${tag}: missing shadeTolerance`);
    if (!Number.isFinite(req.heatStressC)) errors.push(`${tag}: missing heatStressC`);
    if (!Number.isFinite(req.heavyRainMmDay)) errors.push(`${tag}: missing heavyRainMmDay`);
    if (!crop.literature) errors.push(`${tag}: missing literature attribution`);
  }

  return { valid: errors.length === 0, errors, count: db.length };
}

/**
 * PRD 6.2: if the previous crop is unknown, assume a NEUTRAL, non-legume, medium-root
 * starting point AND say so in the reason. Never fabricate a reported previous crop.
 */
export function neutralPrevCrop(): CropDefinition {
  return {
    cropId: '__neutral_previous__',
    cropName: 'an unknown previous crop',
    family: '__none__',
    nitrogenRole: 'Light feeder',
    rootDepth: 'Medium',
    diseaseGroups: [],
    plantingMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    plantingWindow: { startMonth: 1, endMonth: 12, bestMonth: 1 },
    daysToHarvest: { min: 90, max: 120 },
    waterNeed: 'Medium',
    difficulty: 'Easy',
    difficultyReason: 'Assumed neutral starting point, not a reported crop.',
    requirements: {
      temperatureC: { min: -10, optMin: 0, optMax: 45, max: 55 },
      rainfallMmMonth: { min: 0, optMin: 0, optMax: 600, max: 700 },
      ph: { min: 3, optMin: 3, optMax: 9.5, max: 10 },
      elevationM: { min: 0, max: 5000 },
      texture: ['sandy', 'loam', 'clay', 'peat', 'unknown'],
      drainageTolerance: 'high',
      slopeTolerance: ['flat', 'gentle', 'steep', 'unknown'],
      shadeTolerance: ['none', 'partial', 'heavy', 'unknown'],
      frostTolerant: true,
      heatStressC: 50,
      heavyRainMmDay: 50,
    },
    notes: 'Neutral placeholder only. Never displayed as farmer-reported history.',
    literature: 'Serumpun rotation assumption',
  };
}
