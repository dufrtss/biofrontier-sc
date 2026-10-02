import { describe, it, expect } from 'vitest'
import { evidenceLevel, frontierVerdict, filterByEvidence } from '@/lib/evidence'
import { EVIDENCE_CONFIG } from '@/lib/scoring-config'
import type { ScoredHexbin } from '@/lib/types'

function hex(hexId: string, rank: number, records: number): ScoredHexbin {
  return {
    hexId,
    taxa: {
      all: {
        occurrenceCount: records,
        uniqueSpeciesCount: 1,
        uniqueObserverCount: 1,
        uniqueDateCount: 1,
        temporalSpanYears: 0,
        firstDate: null,
        lastDate: null,
        topSpecies: [],
      },
    },
    habitatQuality: 0.9,
    effortScore: 0.1,
    frontierScore: 0.8,
    rank,
    taxonomicIncompleteness: null,
    expectedSpeciesCount: 0,
    missingSpeciesCount: 0,
  }
}

describe('evidenceLevel', () => {
  const { moderate, strong } = EVIDENCE_CONFIG.thresholds

  it('calls a single record weak', () => {
    expect(evidenceLevel(1)).toBe('weak')
  })

  it('switches to moderate exactly at the moderate threshold', () => {
    expect(evidenceLevel(moderate - 1)).toBe('weak')
    expect(evidenceLevel(moderate)).toBe('moderate')
  })

  it('switches to strong exactly at the strong threshold', () => {
    expect(evidenceLevel(strong - 1)).toBe('moderate')
    expect(evidenceLevel(strong)).toBe('strong')
  })

  it('treats zero records as weak rather than throwing', () => {
    expect(evidenceLevel(0)).toBe('weak')
  })
})

describe('frontierVerdict', () => {
  it('keeps the absolute verdicts for cells with enough evidence', () => {
    expect(frontierVerdict(0.85, 'moderate')).toBe('criticalGap')
    expect(frontierVerdict(0.65, 'strong')).toBe('highPotential')
    expect(frontierVerdict(0.45, 'moderate')).toBe('moderate')
    expect(frontierVerdict(0.2, 'strong')).toBe('wellSurveyed')
  })

  it('never calls a weak-evidence cell a critical gap', () => {
    expect(frontierVerdict(0.95, 'weak')).toBe('highPotentialWeakEvidence')
    expect(frontierVerdict(0.65, 'weak')).toBe('highPotentialWeakEvidence')
  })

  it('never calls a weak-evidence cell well surveyed either', () => {
    // A handful of records is not a survey, whatever the score says.
    expect(frontierVerdict(0.2, 'weak')).toBe('weakEvidence')
    expect(frontierVerdict(0.45, 'weak')).toBe('weakEvidence')
  })
})

describe('filterByEvidence', () => {
  const hexbins = {
    a: hex('a', 1, 1),
    b: hex('b', 2, 7),
    c: hex('c', 3, 2),
    d: hex('d', 4, 40),
  }
  const ranked = ['a', 'b', 'c', 'd']

  it('keeps every cell at a minimum of one record', () => {
    expect(filterByEvidence(ranked, hexbins, 'all', 1)).toEqual(ranked)
  })

  it('drops cells below the minimum and keeps the ranking order', () => {
    expect(filterByEvidence(ranked, hexbins, 'all', 5)).toEqual(['b', 'd'])
  })

  it('counts records under the active taxon filter only', () => {
    // No bird records anywhere, so nothing clears even a minimum of one.
    expect(filterByEvidence(ranked, hexbins, 'birds', 1)).toEqual([])
  })

  it('skips ids with no matching hexbin', () => {
    expect(filterByEvidence(['a', 'zz', 'd'], hexbins, 'all', 1)).toEqual(['a', 'd'])
  })
})

describe('EVIDENCE_CONFIG', () => {
  it('offers the default minimum among the selectable options', () => {
    expect(EVIDENCE_CONFIG.minRecordOptions).toContain(EVIDENCE_CONFIG.defaultMinRecords)
  })

  it('orders its thresholds', () => {
    expect(EVIDENCE_CONFIG.thresholds.moderate).toBeLessThan(EVIDENCE_CONFIG.thresholds.strong)
  })
})
