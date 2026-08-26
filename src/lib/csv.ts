/**
 * CSV export of the frontier ranking.
 *
 * Kept free of DOM and React so it can be unit tested and reused from the
 * data pipeline scripts. `downloadCsv` in `features/export` handles the
 * browser side.
 */

import type { ScoredHexbin, TaxonFilter } from './types'
import type { ActiveComponents } from './scoring'
import { hexCenter } from './h3-utils'
import { taxonDataFor } from './hexbins-file'

/**
 * Characters that make Excel and LibreOffice treat a cell as a formula.
 *
 * Species names and collector strings arrive from third-party APIs, so their
 * content is not under our control. A value beginning with one of these is
 * evaluated on open — at minimum showing a garbled cell, at worst triggering a
 * data-exfiltration prompt via `=HYPERLINK(...)` or `=WEBSERVICE(...)`.
 */
const FORMULA_TRIGGERS = ['=', '+', '-', '@', '\t', '\r']

/**
 * Escapes a single CSV field per RFC 4180, and neutralises spreadsheet formula
 * injection.
 *
 * Quoting alone handles the structural hazard: `Leptodactylus latrans
 * (Steffen, 1815)` would otherwise split across columns on its comma. But
 * quoting does *not* stop a leading `=` from being interpreted as a formula, so
 * such values are additionally prefixed with a single quote — the convention
 * every major spreadsheet reads as "this is literal text".
 */
export function escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return String(value)

  // Numeric strings are exempt. Every coordinate in Santa Catarina is negative
  // and reaches this function already formatted by `toFixed`, so treating a
  // leading '-' as an injection trigger would prefix every latitude and
  // longitude and turn the columns into unparseable text. A value that parses
  // cleanly as a number cannot carry a formula payload anyway.
  const isNumeric = value !== '' && Number.isFinite(Number(value))

  const neutralised = !isNumeric && FORMULA_TRIGGERS.some(c => value.startsWith(c))
    ? `'${value}`
    : value

  if (/[",\r\n]/.test(neutralised)) {
    return `"${neutralised.replace(/"/g, '""')}"`
  }
  return neutralised
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
  'habitat_in_score',
  'taxonomic_incompleteness',
  'incompleteness_in_score',
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
  /** Which components entered the score. Determines the provenance header. */
  activeComponents: ActiveComponents
  /** Limit to the first N ranked hexbins. Omit to export all of them. */
  limit?: number
  /** ISO timestamp of the underlying dataset, for the provenance header. */
  generatedAt?: string | null
  /** Source ids behind the dataset, for the provenance header. */
  sources?: string[]
}

/**
 * Comment lines describing how the scores were produced.
 *
 * Without these the export is quietly unreproducible: `habitat_quality` reads
 * `0.5000` on every row while the score excludes it, so anyone recomputing
 * `0.40·gap + 0.35·habitat + 0.25·incompleteness` from the columns gets a
 * different number with nothing to explain the discrepancy. The honesty the UI
 * carries has to travel with the data.
 *
 * `#`-prefixed lines are ignored by R's `read.csv(comment.char = "#")`, pandas'
 * `comment='#'`, and QGIS, and are visible as plain text everywhere else.
 */
function provenanceHeader(
  { taxonFilter, activeComponents, generatedAt, sources }: FrontierCsvOptions,
): string[] {
  const included = [
    'survey_gap',
    activeComponents.habitat ? 'habitat_quality' : null,
    activeComponents.incompleteness ? 'taxonomic_incompleteness' : null,
  ].filter(Boolean).join(' + ')

  const excluded = [
    activeComponents.habitat ? null : 'habitat_quality (uniform placeholder in this dataset)',
    activeComponents.incompleteness ? null : 'taxonomic_incompleteness (not computable for every ranked hexbin)',
  ].filter(Boolean)

  const lines = [
    '# BioFrontier SC — frontier ranking export',
    `# generated: ${new Date().toISOString()}`,
    `# dataset: ${generatedAt ?? 'unknown'}`,
    `# sources: ${sources?.length ? sources.join(', ') : 'unknown'}`,
    `# taxon filter: ${taxonFilter}`,
    `# frontier_score computed from: ${included}`,
  ]

  for (const item of excluded) {
    lines.push(`# EXCLUDED from frontier_score: ${item}`)
  }
  if (excluded.length > 0) {
    lines.push('# Excluded columns are reported for reference but did not affect the score or ranking.')
  }
  lines.push('# Weights are an uncalibrated hypothesis — treat relative ranking as more reliable than absolute scores.')

  return lines
}

/**
 * Serialises ranked hexbins to CSV, preceded by a `#` provenance header.
 *
 * `rankedHexIds` carries the ordering rather than re-sorting here, so the export
 * always matches exactly what the ranking sidebar is showing.
 */
export function buildFrontierCsv(
  rankedHexIds: string[],
  hexbins: Record<string, ScoredHexbin>,
  options: FrontierCsvOptions,
): string {
  const { taxonFilter, limit } = options
  const ids = limit === undefined ? rankedHexIds : rankedHexIds.slice(0, limit)

  const lines = [
    ...provenanceHeader(options),
    toCsvRow([...FRONTIER_CSV_HEADERS]),
  ]

  for (const hexId of ids) {
    const hex = hexbins[hexId]
    if (!hex) continue

    const td = taxonDataFor(hex, taxonFilter)
    const [lat, lng] = hexCenter(hexId)

    lines.push(toCsvRow([
      hex.rank,
      hexId,
      lat.toFixed(6),
      lng.toFixed(6),
      num(hex.frontierScore),
      num(1 - hex.effortScore),
      num(hex.habitatQuality),
      options.activeComponents.habitat ? 'yes' : 'no',
      num(hex.taxonomicIncompleteness),
      options.activeComponents.incompleteness ? 'yes' : 'no',
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
