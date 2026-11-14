import type { FieldLocation } from '@/types/domain';

/** A realistic tropical smallholder site: Surakarta / Klaten area, Central Java. */
export const SAMPLE_LATITUDE = -7.55;
export const SAMPLE_LONGITUDE = 110.42;
export const SAMPLE_ELEVATION_M = 210;
export const SAMPLE_TIMEZONE = 'Asia/Jakarta';
export const SAMPLE_PLACE_NAME = 'Surakarta, Central Java, Indonesia';

export function sampleLocation(): FieldLocation {
  return {
    latitude: SAMPLE_LATITUDE,
    longitude: SAMPLE_LONGITUDE,
    elevationM: SAMPLE_ELEVATION_M,
    placeName: 'Surakarta',
    adminContext: SAMPLE_PLACE_NAME,
    timezone: SAMPLE_TIMEZONE,
    resolvedBy: 'sample',
    isCoarse: true,
    source: 'BUNDLED',
    retrievedAt: null,
  };
}
