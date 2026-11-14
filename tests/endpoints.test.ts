import { describe, expect, it } from 'vitest';
import {
  ALLOWED_HOSTS,
  ALLOWED_HOST_PURPOSE,
  BlockedHostError,
  GIBS_FALLBACK_DATE,
  GIBS_LAYERS,
  POWER_PARAMETERS,
  assertAllowed,
  geocodeUrl,
  gibsDefaultDate,
  gibsTileTemplate,
  gibsTileUrl,
  hostOf,
  isAllowed,
  nominatimReverseUrl,
  openMeteoArchiveUrl,
  openMeteoForecastUrl,
  osmTileTemplate,
  osmTileUrl,
  powerClimatologyUrl,
  powerMonthlyUrl,
  soilGridsUrl,
} from '@/config/endpoints';

const REQUIRED_HOSTS = [
  'power.larc.nasa.gov',
  'gibs.earthdata.nasa.gov',
  'api.open-meteo.com',
  'archive-api.open-meteo.com',
  'geocoding-api.open-meteo.com',
  'rest.isric.org',
  'nominatim.openstreetmap.org',
  'tile.openstreetmap.org',
];

describe('single network allowlist', () => {
  it('contains exactly the eight verified keyless hosts', () => {
    expect([...ALLOWED_HOSTS].sort()).toEqual([...REQUIRED_HOSTS].sort());
    for (const host of REQUIRED_HOSTS) {
      expect(ALLOWED_HOST_PURPOSE[host]).toBeTruthy();
      expect(isAllowed(`https://${host}/anything`)).toBe(true);
    }
  });

  it('rejects malformed URLs, arbitrary hosts and forbidden Overpass/Earthdata-login hosts', () => {
    const forbidden = [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
      'https://urs.earthdata.nasa.gov/',
      'https://evil.example.com/steal',
      'https://power.larc.nasa.gov.evil.com/x',
      'not-a-url',
      '',
    ];
    for (const url of forbidden) {
      expect(isAllowed(url)).toBe(false);
      expect(() => assertAllowed(url)).toThrow(BlockedHostError);
    }
  });

  it('exposes the blocked host on the error for honest diagnostics', () => {
    try {
      assertAllowed('https://overpass-api.de/api/interpreter');
      throw new Error('expected assertAllowed to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BlockedHostError);
      const blocked = error as BlockedHostError;
      expect(blocked.host).toBe('overpass-api.de');
      expect(blocked.url).toContain('overpass-api.de');
    }
  });

  it('extracts hostnames case-insensitively', () => {
    expect(hostOf('https://API.Open-Meteo.COM/v1/forecast')).toBe('api.open-meteo.com');
    expect(hostOf('garbage')).toBe('');
  });
});

describe('verified request shapes', () => {
  it('builds the NASA POWER climatology URL with all nine AG parameters', () => {
    const url = new URL(powerClimatologyUrl(-7.55, 110.42));
    expect(url.hostname).toBe('power.larc.nasa.gov');
    expect(url.pathname).toContain('/api/temporal/climatology/point');
    expect(url.searchParams.get('community')).toBe('AG');
    expect(url.searchParams.get('format')).toBe('JSON');
    expect(url.searchParams.get('latitude')).toBe('-7.55');
    expect(url.searchParams.get('longitude')).toBe('110.42');
    expect(url.searchParams.get('parameters')).toBe(POWER_PARAMETERS);
    for (const param of [
      'T2M', 'T2M_MAX', 'T2M_MIN', 'PRECTOTCORR', 'RH2M',
      'ALLSKY_SFC_SW_DWN', 'WS10M', 'GWETROOT', 'GWETTOP',
    ]) {
      expect(POWER_PARAMETERS).toContain(param);
    }
    expect(isAllowed(url.toString())).toBe(true);
  });

  it('builds the optional NASA POWER monthly URL', () => {
    const url = new URL(powerMonthlyUrl(-7.55, 110.42, 2023, 2024));
    expect(url.pathname).toContain('/api/temporal/monthly/point');
    expect(url.searchParams.get('start')).toBe('2023');
    expect(url.searchParams.get('end')).toBe('2024');
    expect(isAllowed(url.toString())).toBe(true);
  });

  it('builds the Open-Meteo forecast URL with current + daily + 16 days', () => {
    const url = new URL(openMeteoForecastUrl(-7.55, 110.42));
    expect(url.hostname).toBe('api.open-meteo.com');
    expect(url.searchParams.get('forecast_days')).toBe('16');
    expect(url.searchParams.get('timezone')).toBe('auto');
    expect(url.searchParams.get('current')).toContain('soil_moisture_0_to_1cm');
    expect(url.searchParams.get('daily')).toContain('et0_fao_evapotranspiration');
    expect(isAllowed(url.toString())).toBe(true);
  });

  it('builds the Open-Meteo archive URL', () => {
    const url = new URL(openMeteoArchiveUrl(-7.55, 110.42, '2023-01-01', '2023-12-31'));
    expect(url.hostname).toBe('archive-api.open-meteo.com');
    expect(url.searchParams.get('start_date')).toBe('2023-01-01');
    expect(url.searchParams.get('end_date')).toBe('2023-12-31');
    expect(isAllowed(url.toString())).toBe(true);
  });

  it('builds the geocoding URL', () => {
    const url = new URL(geocodeUrl('Surakarta'));
    expect(url.hostname).toBe('geocoding-api.open-meteo.com');
    expect(url.searchParams.get('name')).toBe('Surakarta');
    expect(url.searchParams.get('count')).toBe('5');
    expect(isAllowed(url.toString())).toBe(true);
  });

  it('builds the SoilGrids URL with all seven properties and the mean value', () => {
    const url = new URL(soilGridsUrl(-7.55, 110.42));
    expect(url.hostname).toBe('rest.isric.org');
    expect(url.searchParams.get('depth')).toBe('0-5cm');
    expect(url.searchParams.get('value')).toBe('mean');
    expect(url.searchParams.getAll('property')).toEqual([
      'phh2o', 'clay', 'sand', 'silt', 'soc', 'nitrogen', 'cec',
    ]);
    expect(isAllowed(url.toString())).toBe(true);
  });

  it('builds the Nominatim reverse URL with zoom=10', () => {
    const url = new URL(nominatimReverseUrl(-7.55, 110.42));
    expect(url.hostname).toBe('nominatim.openstreetmap.org');
    expect(url.searchParams.get('zoom')).toBe('10');
    expect(url.searchParams.get('format')).toBe('json');
    expect(isAllowed(url.toString())).toBe(true);
  });
});

describe('map tile templates (allowlisted hosts only)', () => {
  it('builds OSM raster tiles and a Leaflet template', () => {
    expect(osmTileUrl(3, 4, 5)).toBe('https://tile.openstreetmap.org/3/4/5.png');
    expect(hostOf(osmTileUrl(3, 4, 5))).toBe('tile.openstreetmap.org');
    expect(osmTileTemplate()).toContain('{z}/{x}/{y}.png');
    expect(hostOf(osmTileTemplate().replace('{z}', '1').replace('{x}', '1').replace('{y}', '1'))).toBe(
      'tile.openstreetmap.org'
    );
  });

  it('only exposes the two verified true-colour GIBS layers (no NDVI/EVI)', () => {
    expect(GIBS_LAYERS).toHaveLength(2);
    expect(GIBS_LAYERS).toContain('MODIS_Terra_CorrectedReflectance_TrueColor');
    expect(GIBS_LAYERS).toContain('VIIRS_SNPP_CorrectedReflectance_TrueColor');
    expect(GIBS_LAYERS.join(' ')).not.toMatch(/NDVI|EVI/i);
  });

  it('falls back to a known-good layer/date for invalid GIBS input', () => {
    const url = gibsTileUrl('NDVI_Bogus', 'not-a-date', 3, 4, 5);
    expect(url).toContain(GIBS_LAYERS[0]);
    expect(url).toContain(GIBS_FALLBACK_DATE);
    expect(url).not.toContain('NDVI_Bogus');
    expect(hostOf(url)).toBe('gibs.earthdata.nasa.gov');
    expect(gibsTileTemplate(GIBS_LAYERS[1], '2024-06-01')).toContain('{z}/{y}/{x}.jpg');
  });

  it('computes a GIBS date ~7 days before a supplied instant', () => {
    expect(gibsDefaultDate(new Date('2024-01-15T00:00:00Z'))).toBe('2024-01-08');
  });
});
