/** Shared unions used across every layer. Canonical internal month: 1 = January. */
export type Month = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export type FactorId = 'F1' | 'F2' | 'F3' | 'F4' | 'F5' | 'F6' | 'F7';

export type ConfidenceLevel = 'High' | 'Medium' | 'Low';
export type Verdict = 'Good' | 'Fair' | 'Poor';
export type CropVerdict = 'Good fit' | 'Worth considering' | 'Poor fit';

export type NitrogenRole = 'Legume' | 'Heavy feeder' | 'Light feeder';
export type RootDepth = 'Shallow' | 'Medium' | 'Deep';
export type WaterNeed = 'Low' | 'Medium' | 'High';
export type Difficulty = 'Easy' | 'Moderate' | 'Demanding';
export type SoilTexture = 'sandy' | 'loam' | 'clay' | 'peat' | 'unknown';
export type Irrigation = 'none' | 'partial' | 'reliable' | 'unknown';
export type Slope = 'flat' | 'gentle' | 'steep' | 'unknown';
export type Shade = 'none' | 'partial' | 'heavy' | 'unknown';
export type SurroundingTag = 'nearby-water' | 'nearby-forest' | 'nearby-urban' | 'none-known';

export type FarmerPriority =
  | 'low-water'
  | 'drought-tolerance'
  | 'nitrogen-fixation'
  | 'erosion-reduction'
  | 'organic-matter'
  | 'forage'
  | 'quick-harvest'
  | 'market-suitability'
  | 'low-labour';

/** Botanical family is an open string tag (Poaceae, Fabaceae, Solanaceae, ...). */
export type BotanicalFamily = string;

export type Lang = 'en' | 'id';

export type Screen =
  | 'S0_WELCOME'
  | 'S1_FIND_FIELD'
  | 'S2_SNAPSHOT'
  | 'S3_PROFILE'
  | 'S4_RECOMMENDATIONS'
  | 'S5_WHY'
  | 'S6_ROTATION'
  | 'S6_STRATEGY_COMPARE'
  | 'S7_DATA_SOURCES';
