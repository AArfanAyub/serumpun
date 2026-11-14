/** Exact, legally required and fixed strings. Rendered on S7, in the footer and on SourceLabel. */

export const DISCLAIMER =
  'This is decision support based on regional climate data and general crop requirements, ' +
  'not agronomic advice for your field. Check with a local extension officer before ' +
  'committing your season.';

export const REGIONAL_ESTIMATE_CAVEAT = 'regional estimate, not a measurement at your field';
export const CLIMATOLOGY_LABEL = 'long-term monthly average, not a forecast';
export const CLIMATOLOGY_PERIOD = 'long-term average 1991–2020';
export const FORECAST_LABEL = 'forecast';
export const CURRENT_LABEL = 'current conditions';
export const TENTATIVE_NOTICE = 'Tentative — check conditions again before planting.';
export const NO_MATCH_NOTE =
  'No fully confident rotation match for this field — this is the closest option, ' +
  'and here is what is weak about it.';
export const OFFLINE_SAMPLE_LABEL = 'Offline sample data';
export const NOT_AVAILABLE = 'Not available right now';

export const ATTRIBUTION = {
  NASA_POWER: 'Data: NASA POWER / NASA Langley Research Center (public domain / open use)',
  NASA_GIBS: 'Imagery: NASA EOSDIS GIBS',
  OPEN_METEO: 'Weather data by Open-Meteo.com (CC BY 4.0)',
  SOILGRIDS: 'Soil data: ISRIC SoilGrids v2 (CC BY 4.0)',
  OSM: '© OpenStreetMap contributors (ODbL)',
  NOMINATIM: 'Place names: Nominatim / OpenStreetMap (ODbL)',
  CROPS:
    'Crop requirement ranges: literature-based heuristics (EcoCrop / FAO GAEZ-style), decision support only.',
} as const;

export const LICENCE = {
  NASA_POWER: 'NASA public domain / open use',
  NASA_GIBS: 'NASA EOSDIS open imagery',
  OPEN_METEO: 'CC BY 4.0',
  SOILGRIDS: 'CC BY 4.0',
  NOMINATIM: 'ODbL',
  OSM_TILES: 'ODbL',
  BUNDLED: 'In-repo content, open use',
  USER: 'Self-reported by the farmer',
} as const;

/**
 * Challenge resources credited as inspiration only — they are NOT called at runtime.
 * Most require Earthdata Login, credentials or bulk-download workflows, or are US-only.
 */
export const DATA_INSPIRATION: readonly string[] = Object.freeze([
  'SMAP (soil moisture / freeze-thaw)',
  'GPM / IMERG (precipitation)',
  'Landsat, MODIS / VIIRS (reflectance, vegetation indices)',
  'SRTM (elevation / terrain)',
  'ECOSTRESS (land surface temperature / evapotranspiration)',
  'NLDAS / GLDAS (land data assimilation)',
  'GEDI (canopy structure)',
  'Sentinel-2 (ESA)',
  'ERA5 (ECMWF)',
  'FAO GAEZ / EcoCrop (crop requirement literature)',
  'USDA Ag Data Commons, Web Soil Survey, CropScape CDL, PRISM, SSURGO/STATSGO2',
  'NAIP, NLCD, CoCoRaHS, USGS NWIS, USDA AMS / NASS, OpenET, LANDFIRE',
]);

export const GLOSSARY: ReadonlyArray<{ term: string; meaning: string }> = Object.freeze([
  {
    term: 'Evapotranspiration (ET0)',
    meaning:
      'How much water a reference crop and the soil would lose to the air in a day. Higher ET0 means crops need more water.',
  },
  {
    term: 'Soil wetness / soil moisture anomaly',
    meaning:
      'NASA POWER gives a 0–1 relative wetness for the root and top soil layer, not a direct measurement in your field. Open-Meteo gives a modelled surface soil moisture. Both are estimates for a broad grid square.',
  },
  {
    term: 'Vegetation index',
    meaning:
      'A number derived from satellite colours that describes how green an area is. Serumpun shows plain true-colour NASA GIBS imagery, not a vegetation-index layer.',
  },
  {
    term: 'Frost risk',
    meaning: 'A risk that cold nights near 0 °C damage a crop that cannot tolerate frost.',
  },
  {
    term: 'Water balance',
    meaning:
      'Rain plus irrigation compared with what a crop is likely to use. Too little means drought stress; far too much means waterlogging.',
  },
  {
    term: 'Satellite vs. ground measurement',
    meaning:
      'Satellites and weather models describe a wide area (a grid square), not your exact plot. A ground measurement from your own field would always be more precise.',
  },
]);

export const BANNER_LABEL = {
  Live: 'Live',
  'Partly estimated': 'Partly estimated',
  'Offline sample': 'Offline sample',
} as const;
