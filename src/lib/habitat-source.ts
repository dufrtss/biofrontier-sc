/**
 * Which MapBiomas release the bundled habitat data came from.
 *
 * Single source of truth for the pipeline and the methodology panel alike:
 * `scripts/compute-habitat.ts` builds its download URL from these values, and
 * the panel interpolates them into the habitat section, so regenerating from a
 * different collection or year cannot leave the published methodology
 * describing a dataset the app is no longer serving.
 *
 * Changing the release means editing this file and re-running
 * `npm run data:habitat`.
 */
export const HABITAT_SOURCE = {
  /** Bucket path segment for the collection. */
  collection: 'collection11',
  /** Human-readable name, as MapBiomas cites it. */
  collectionLabel: 'Collection 11',
  /** Reference year of the annual land-cover mosaic. */
  year: 2025,
  /** Native pixel size in metres. */
  resolutionM: 30,
} as const

/** Public cloud-optimised GeoTIFF for one year of the collection. */
export function habitatRasterUrl(year: number = HABITAT_SOURCE.year): string {
  return 'https://storage.googleapis.com/mapbiomas-public/initiatives/brasil/' +
    `${HABITAT_SOURCE.collection}/lulc/coverage/brazil_coverage/` +
    `brazil_coverage-col11_${year}.tif`
}
