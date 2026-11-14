import type {
  Provenance,
  DataSourceStatus,
  SourceId,
  AppDataStatus,
} from './data';
// Re-export the shared unions so consumers can import every domain type from one module.
export type {
  Month,
  FactorId,
  ConfidenceLevel,
  Verdict,
  CropVerdict,
  NitrogenRole,
  RootDepth,
  WaterNeed,
  Difficulty,
  SoilTexture,
  Irrigation,
  Slope,
  Shade,
  SurroundingTag,
  FarmerPriority,
  BotanicalFamily,
  Lang,
  Screen,
} from './ui';

import type {
  Month,
  FactorId,
  ConfidenceLevel,
  Verdict,
  CropVerdict,
  NitrogenRole,
  RootDepth,
  WaterNeed,
  Difficulty,
  SoilTexture,
  Irrigation,
  Slope,
  Shade,
  SurroundingTag,
  FarmerPriority,
  BotanicalFamily,
} from './ui';

export interface FieldLocation {
  latitude: number;
  longitude: number;
  elevationM: number | null;
  placeName: string | null;
  adminContext: string | null;
  timezone: string;
  resolvedBy: 'search' | 'gps' | 'pin' | 'manual' | 'sample';
  isCoarse: boolean;
  source: SourceId;
  retrievedAt: string | null;
}

export interface FieldProfile {
  soilTexture: SoilTexture;
  soilPhOverride: number | null;
  irrigation: Irrigation;
  slope: Slope;
  shade: Shade;
  previousCropId: string | null;
  previousCropUnknown: boolean;
  landSizeHa: number | null;
  surroundings: SurroundingTag[];
  priorities: FarmerPriority[];
  answered: Partial<
    Record<
      'soil' | 'irrigation' | 'slope' | 'shade' | 'previousCrop' | 'landSize' | 'surroundings',
      'answered' | 'unknown'
    >
  >;
  isSelfReported: boolean;
}

export interface MonthlyClimate {
  month: Month;
  t2mC: number;
  t2mMaxC: number;
  t2mMinC: number;
  precipMm: number;
  rhPct: number;
  solarMjM2Day: number;
  windMs10m: number;
  gwetRoot: number;
  gwetTop: number;
  et0MmDay: number | null;
}

export interface ClimateNormals {
  monthly: MonthlyClimate[];
  annual: { t2mC: number; precipMm: number } | null;
  periodLabel: string;
  source: SourceId;
  provenance: Provenance;
}

export interface ForecastDay {
  date: string;
  tMaxC: number;
  tMinC: number;
  precipMm: number;
  et0Mm: number | null;
  solarMjM2: number | null;
}

export interface CurrentWeather {
  observedAt: string;
  temperatureC: number;
  humidityPct: number;
  precipitationMm: number;
  soilMoisture01: number | null;
  forecast: ForecastDay[];
  timezone: string;
  elevationM: number | null;
  source: SourceId;
  provenance: Provenance;
}

export interface SoilProfile {
  texture: SoilTexture;
  ph: number | null;
  clayPct: number | null;
  sandPct: number | null;
  socGkg: number | null;
  depthLabel: string;
  origin: 'soilgrids' | 'self-reported' | 'bundled' | 'unknown';
  isEstimated: boolean;
  provenance: Provenance;
}

export interface Range {
  min: number;
  max: number;
}

/** Trapezoidal suitability range: zero at min/max, 100 between optMin and optMax. */
export interface OptRange {
  min: number;
  optMin: number;
  optMax: number;
  max: number;
}

export interface CropDefinition {
  cropId: string;
  cropName: string;
  localName?: string;
  family: BotanicalFamily;
  nitrogenRole: NitrogenRole;
  rootDepth: RootDepth;
  diseaseGroups: string[];
  plantingMonths: Month[];
  plantingWindow: { startMonth: Month; endMonth: Month; bestMonth: Month };
  daysToHarvest: Range;
  waterNeed: WaterNeed;
  difficulty: Difficulty;
  difficultyReason: string;
  requirements: {
    temperatureC: OptRange;
    rainfallMmMonth: OptRange;
    ph: OptRange;
    elevationM: Range;
    texture: SoilTexture[];
    drainageTolerance: 'low' | 'medium' | 'high';
    slopeTolerance: Slope[];
    shadeTolerance: Shade[];
    frostTolerant: boolean;
    heatStressC: number;
    heavyRainMmDay: number;
  };
  notes: string;
  literature: string;
}

/** The single normalised object every pure domain function consumes. */
export interface SiteConditions {
  location: FieldLocation;
  targetMonth: Month;
  climate: ClimateNormals;
  current: CurrentWeather;
  soil: SoilProfile;
  profile: FieldProfile;
  monthlyForTarget: MonthlyClimate;
  provenance: Provenance[];
  sources: DataSourceStatus[];
  appStatus: AppDataStatus;
}

export interface FactorScore {
  factorId: FactorId;
  name: string;
  weight: number;
  observedValue: string;
  rawValue: number | null;
  unit: string;
  score: number;
  verdict: Verdict;
  reason: string;
  source: string;
  sourceId: SourceId;
  freshness: string;
  isEstimated: boolean;
}

export interface PlantingWindow {
  status: 'Plant now' | 'Wait until <Month>' | 'Out of season';
  startMonth: Month;
  endMonth: Month;
  bestMonth: Month;
  note: string;
}

export interface RiskNote {
  type: 'drought' | 'heat' | 'heavy rain' | 'erosion' | 'frost' | 'pest-rotation';
  severity: 'low' | 'medium' | 'high';
  plainText: string;
  source: string;
  freshness: string;
}

/** PRD 5.2 recommendation object, verbatim plus strategy comparison. */
export interface CropRecommendation {
  rank: number;
  cropId: string;
  cropName: string;
  localName?: string;
  score: number;
  confidence: ConfidenceLevel;
  confidenceReason: string;
  completenessScore: number;
  verdict: CropVerdict;
  factorBreakdown: FactorScore[];
  whatThisMeans: string;
  plantingWindow: PlantingWindow;
  daysToHarvest: Range;
  waterNeed: WaterNeed;
  waterNeedNote: string;
  difficulty: Difficulty;
  difficultyReason: string;
  riskNotes: RiskNote[];
  dataProvenance: Provenance[];
  rotationPlan: RotationPlan;
  strategies: RotationStrategy[];
  disclaimer: string;
  targetMonth: Month;
}

export interface RotationSeason {
  seasonIndex: 1 | 2 | 3;
  periodLabel: string;
  targetMonth: Month;
  cropId: string;
  cropName: string;
  family: BotanicalFamily;
  nitrogenRole: NitrogenRole;
  rootDepth: RootDepth;
  fitScore: number;
  confidence: ConfidenceLevel;
  reasons: string[];
  cautions: string[];
  tentative: boolean;
  tentativeNotice?: string;
}

export interface RotationPlan {
  seasons: [RotationSeason, RotationSeason, RotationSeason];
  transitionReasons: [string, string, string];
  previousCrop: { cropId: string | null; assumedNeutral: boolean; note: string };
  strategyId: string;
  noConfidentMatch: boolean;
  noMatchNote?: string;
  disclaimer: string;
}

export interface RotationStrategy {
  strategyId: string;
  label: string;
  isExisting: boolean;
  summary: string;
  plan: RotationPlan;
  evidence: string[];
  benefits: string[];
  informationGaps: string[];
  risks: string[];
  vulnerableSeasons: string[];
  comparison: {
    soilHealthScore: number;
    waterDemand: WaterNeed;
    nitrogenBalance: 'building' | 'neutral' | 'depleting';
    bareFieldWeeks: number;
    ruleViolations: number;
    avgFitScore: number;
  };
}
