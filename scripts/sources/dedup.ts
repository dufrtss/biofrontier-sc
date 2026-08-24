import type { Occurrence } from './types'

/**
 * Cross-source deduplication.
 *
 * This is not optional bookkeeping. GBIF ingests iNaturalist research-grade
 * observations, so running both sources double-counts a large share of records.
 * Left unhandled that would corrupt the survey effort score — record density
 * and unique-date counts would both inflate for precisely the well-observed
 * areas that already dominate the data, widening the apparent gap between
 * popular and neglected regions for no biological reason.
 *
 * Coordinates are rounded to ~11 m before comparison. Providers round and
 * reproject differently, so byte-identical coordinates are rare even for the
 * same underlying observation; 4 decimal places is tight enough to keep genuinely
 * distinct nearby records apart and loose enough to catch reprojection drift.
 */
const COORD_PRECISION = 4

export function occurrenceKey(o: Occurrence): string {
  return [
    o.species ?? '?',
    o.lat.toFixed(COORD_PRECISION),
    o.lng.toFixed(COORD_PRECISION),
    o.date ?? '?',
  ].join('|')
}

export interface DedupResult {
  records: Occurrence[]
  /** Duplicates dropped, keyed by the source whose record was discarded. */
  droppedBySource: Record<string, number>
}

/**
 * Removes duplicates across sources, keeping the first occurrence of each key.
 *
 * Records without a species name are always kept. Their key would rest on
 * little more than a coordinate, and iNaturalist reports `species: null` for
 * every identification coarser than species rank — so deduplicating on it would
 * silently merge genuinely distinct genus-level observations that happen to
 * share an 11 m cell and a date. Over-counting a handful of records is a much
 * smaller error than deleting real observations.
 */
export function dedupeOccurrences(records: Occurrence[]): DedupResult {
  const seen = new Set<string>()
  const kept: Occurrence[] = []
  const droppedBySource: Record<string, number> = {}

  for (const record of records) {
    if (record.species === null) {
      kept.push(record)
      continue
    }

    const key = occurrenceKey(record)
    if (seen.has(key)) {
      droppedBySource[record.source] = (droppedBySource[record.source] ?? 0) + 1
      continue
    }
    seen.add(key)
    kept.push(record)
  }

  return { records: kept, droppedBySource }
}
