/**
 * CSV export of the frontier ranking.
 *
 * Kept free of DOM and React so it can be unit tested and reused from the
 * data pipeline scripts. `downloadCsv` in `features/export` handles the
 * browser side.
 */

import type { ScoredHexbin, TaxonFilter } from './types'
import { hexCenter } from './h3-utils'

/**
 * Escapes a single CSV field per RFC 4180.
 *
 * Species names are the real hazard here: `Leptodactylus latrans (Steffen, 1815)`
 * is fine, but authorship strings routinely contain commas, and quoting is the
 * only thing keeping a spreadsheet from splitting them across columns.
 */
export function escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function toCsvRow(fields: Array<string | number | null | undefined>): string {
  return fields.map(escapeCsvField).join(',')
}

export const FRONTIER_CSV_HEADERS = [
  'rank',
  'hex_id',
  'latitude',
  'longitude',
  'frontier_score',
  'survey_gap',
  'habitat_quality',
  'taxonomic_incompleteness',
  'expected_species',
  'missing_species',
  'occurrence_count',
  'unique_species',
  'unique_observers',
  'unique_survey_days',
  'temporal_span_years',
  'first_record',
  'last_record',
  'top_species',
] as const

/** Rounds to `places` decimals, returning '' for null so the column stays empty. */
function num(value: number | null, places = 4): string {
  if (value === null || Number.isNaN(value)) return ''
  return value.toFixed(places)
}

export interface FrontierCsvOptions {
  taxonFilter: TaxonFilter
  /** Limit to the first N ranked hexbins. Omit to export all of them. */
  limit?: number
}

/**
 * Serialises ranked hexbins to CSV.
 *
 * `rankedHexIds` carries the ordering rather than re-sorting here, so the export
 * always matches exactly what the ranking sidebar is showing.
 */
export function buildFrontierCsv(
  rankedHexIds: string[],
  hexbins: Record<string, ScoredHexbin>,
  { taxonFilter, limit }: FrontierCsvOptions,
): string {
  const ids = limit === undefined ? rankedHexIds : rankedHexIds.slice(0, limit)

  const lines = [toCsvRow([...FRONTIER_CSV_HEADERS])]

  for (const hexId of ids) {
    const hex = hexbins[hexId]
    if (!hex) continue

    const td = taxonFilter === 'vertebrates' ? hex.vertebrates : hex.all
    const [lat, lng] = hexCenter(hexId)

    lines.push(toCsvRow([
      hex.rank,
      hexId,
      lat.toFixed(6),
      lng.toFixed(6),
      num(hex.frontierScore),
      num(1 - hex.effortScore),
      num(hex.habitatQuality),
      num(hex.taxonomicIncompleteness),
      hex.expectedSpeciesCount,
      hex.missingSpeciesCount,
      td.occurrenceCount,
      td.uniqueSpeciesCount,
      td.uniqueObserverCount,
      td.uniqueDateCount,
      td.temporalSpanYears,
      td.firstDate,
      td.lastDate,
      td.topSpecies.map(s => s.name).join('; '),
    ]))
  }

  // Trailing newline: POSIX convention, and some spreadsheet importers drop the
  // final row without it.
  return lines.join('\n') + '\n'
}

/** e.g. `biofrontier-sc_vertebrates_2026-08-23.csv` */
export function frontierCsvFilename(taxonFilter: TaxonFilter, date = new Date()): string {
  return `biofrontier-sc_${taxonFilter}_${date.toISOString().slice(0, 10)}.csv`
}
