import { EVIDENCE_CONFIG } from './scoring-config'
import { taxonDataFor } from './hexbins-file'
import type { ScoredHexbin, TaxonFilter } from './types'

export type EvidenceLevel = 'weak' | 'moderate' | 'strong'

/** The verdict keys HexDetail renders under the score. */
export type FrontierVerdict =
  | 'criticalGap'
  | 'highPotential'
  | 'moderate'
  | 'wellSurveyed'
  | 'highPotentialWeakEvidence'
  | 'weakEvidence'

/** Evidence level for a record count. See `EVIDENCE_CONFIG` for the reasoning. */
export function evidenceLevel(records: number): EvidenceLevel {
  const { moderate, strong } = EVIDENCE_CONFIG.thresholds
  if (records >= strong) return 'strong'
  if (records >= moderate) return 'moderate'
  return 'weak'
}

/**
 * The label shown under a hexbin's score.
 *
 * On weak evidence the absolute verdicts are withheld in both directions: a
 * single record is not a critical gap, and two records are not a well surveyed
 * cell. What remains true is that the score is high and the evidence is thin,
 * so that is what the label says.
 */
export function frontierVerdict(score: number, level: EvidenceLevel): FrontierVerdict {
  if (level === 'weak') {
    return score >= 0.6 ? 'highPotentialWeakEvidence' : 'weakEvidence'
  }
  if (score >= 0.8) return 'criticalGap'
  if (score >= 0.6) return 'highPotential'
  if (score >= 0.4) return 'moderate'
  return 'wellSurveyed'
}

/**
 * Ranked hexbin ids holding at least `minRecords` records under `filter`, in
 * ranking order.
 *
 * Filters the list and nothing else. Ranks are not recomputed: a hexbin keeps
 * the rank it has on the map, in the detail panel and in the CSV, so a gap in
 * the numbering is how the reader sees that cells were set aside.
 */
export function filterByEvidence(
  rankedHexIds: string[],
  hexbins: Record<string, ScoredHexbin>,
  filter: TaxonFilter,
  minRecords: number,
): string[] {
  return rankedHexIds.filter(id => {
    const hex = hexbins[id]
    return !!hex && taxonDataFor(hex, filter).occurrenceCount >= minRecords
  })
}
