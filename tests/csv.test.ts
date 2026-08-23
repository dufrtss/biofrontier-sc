import { describe, it, expect } from 'vitest'
import {
  escapeCsvField,
  toCsvRow,
  buildFrontierCsv,
  frontierCsvFilename,
  FRONTIER_CSV_HEADERS,
} from '@/lib/csv'
import type { ScoredHexbin, TaxonRecord } from '@/lib/types'

describe('escapeCsvField', () => {
  it('leaves plain values untouched', () => {
    expect(escapeCsvField('Panthera onca')).toBe('Panthera onca')
    expect(escapeCsvField(42)).toBe('42')
  })

  it('returns an empty string for null and undefined', () => {
    expect(escapeCsvField(null)).toBe('')
    expect(escapeCsvField(undefined)).toBe('')
  })

  it('quotes fields containing a comma', () => {
    // The real case: taxonomic authorship strings.
    expect(escapeCsvField('Leptodactylus latrans (Steffen, 1815)'))
      .toBe('"Leptodactylus latrans (Steffen, 1815)"')
  })

  it('escapes embedded double quotes by doubling them', () => {
    expect(escapeCsvField('cf. "Bothrops" sp.')).toBe('"cf. ""Bothrops"" sp."')
  })

  it('quotes fields containing newlines', () => {
    expect(escapeCsvField('line one\nline two')).toBe('"line one\nline two"')
    expect(escapeCsvField('line one\r\nline two')).toBe('"line one\r\nline two"')
  })

  it('preserves zero rather than blanking it', () => {
    expect(escapeCsvField(0)).toBe('0')
  })
})

describe('toCsvRow', () => {
  it('joins fields with commas', () => {
    expect(toCsvRow(['a', 1, null])).toBe('a,1,')
  })

  it('escapes each field independently', () => {
    expect(toCsvRow(['a,b', 'c'])).toBe('"a,b",c')
  })
})

function taxonRecord(overrides: Partial<TaxonRecord> = {}): TaxonRecord {
  return {
    occurrenceCount: 12,
    uniqueSpeciesCount: 5,
    uniqueObserverCount: 3,
    uniqueDateCount: 4,
    temporalSpanYears: 7,
    firstDate: '2001-03-04',
    lastDate: '2008-09-12',
    topSpecies: [
      { name: 'Panthera onca', count: 4 },
      { name: 'Leptodactylus latrans (Steffen, 1815)', count: 2 },
    ],
    ...overrides,
  }
}

function scoredHex(overrides: Partial<ScoredHexbin> = {}): ScoredHexbin {
  return {
    hexId: '86a91b477ffffff',
    all: taxonRecord(),
    vertebrates: taxonRecord({ occurrenceCount: 6, uniqueSpeciesCount: 2 }),
    habitatQuality: 0.75,
    effortScore: 0.25,
    frontierScore: 0.8,
    rank: 1,
    taxonomicIncompleteness: 0.6,
    expectedSpeciesCount: 20,
    missingSpeciesCount: 12,
    ...overrides,
  }
}

describe('buildFrontierCsv', () => {
  const hexbins = { '86a91b477ffffff': scoredHex() }

  it('emits a header row matching FRONTIER_CSV_HEADERS', () => {
    const csv = buildFrontierCsv([], {}, { taxonFilter: 'all' })
    expect(csv.split('\n')[0]).toBe(FRONTIER_CSV_HEADERS.join(','))
  })

  it('emits header only when there are no ranked hexbins', () => {
    const csv = buildFrontierCsv([], {}, { taxonFilter: 'all' })
    expect(csv.trimEnd().split('\n')).toHaveLength(1)
  })

  it('writes one row per ranked hexbin', () => {
    const csv = buildFrontierCsv(['86a91b477ffffff'], hexbins, { taxonFilter: 'all' })
    expect(csv.trimEnd().split('\n')).toHaveLength(2)
  })

  it('ends with a trailing newline', () => {
    expect(buildFrontierCsv(['86a91b477ffffff'], hexbins, { taxonFilter: 'all' }))
      .toMatch(/\n$/)
  })

  it('preserves the order given by rankedHexIds rather than re-sorting', () => {
    const multi = {
      a: scoredHex({ hexId: '86a91b477ffffff', rank: 2, frontierScore: 0.2 }),
      b: scoredHex({ hexId: '86a91b47bffffff', rank: 1, frontierScore: 0.9 }),
    }
    const csv = buildFrontierCsv(['a', 'b'], multi, { taxonFilter: 'all' })
    const [, first, second] = csv.trimEnd().split('\n')
    expect(first.startsWith('2,')).toBe(true)
    expect(second.startsWith('1,')).toBe(true)
  })

  it('quotes species names containing commas', () => {
    const csv = buildFrontierCsv(['86a91b477ffffff'], hexbins, { taxonFilter: 'all' })
    expect(csv).toContain('"Panthera onca; Leptodactylus latrans (Steffen, 1815)"')
  })

  it('leaves the incompleteness column empty when the score is null', () => {
    const withNull = {
      '86a91b477ffffff': scoredHex({ taxonomicIncompleteness: null }),
    }
    const csv = buildFrontierCsv(['86a91b477ffffff'], withNull, { taxonFilter: 'all' })
    const cells = csv.trimEnd().split('\n')[1].split(',')
    const col = FRONTIER_CSV_HEADERS.indexOf('taxonomic_incompleteness')
    expect(cells[col]).toBe('')
  })

  it('reports survey gap as the inverse of effort score', () => {
    const csv = buildFrontierCsv(['86a91b477ffffff'], hexbins, { taxonFilter: 'all' })
    const cells = csv.trimEnd().split('\n')[1].split(',')
    const col = FRONTIER_CSV_HEADERS.indexOf('survey_gap')
    expect(Number(cells[col])).toBeCloseTo(0.75, 4)  // 1 − 0.25
  })

  it('uses the taxon filter to pick which record block is exported', () => {
    const colOf = (name: string) => FRONTIER_CSV_HEADERS.indexOf(name as never)
    const cellsFor = (taxonFilter: 'all' | 'vertebrates') =>
      buildFrontierCsv(['86a91b477ffffff'], hexbins, { taxonFilter })
        .trimEnd().split('\n')[1].split(',')

    expect(cellsFor('all')[colOf('occurrence_count')]).toBe('12')
    expect(cellsFor('vertebrates')[colOf('occurrence_count')]).toBe('6')
  })

  it('honours the limit option', () => {
    const many = Object.fromEntries(
      ['a', 'b', 'c'].map(id => [id, scoredHex({ hexId: '86a91b477ffffff' })]),
    )
    const csv = buildFrontierCsv(['a', 'b', 'c'], many, { taxonFilter: 'all', limit: 2 })
    expect(csv.trimEnd().split('\n')).toHaveLength(3)  // header + 2
  })

  it('skips ranked ids with no matching hexbin instead of emitting a broken row', () => {
    const csv = buildFrontierCsv(['missing-id'], hexbins, { taxonFilter: 'all' })
    expect(csv.trimEnd().split('\n')).toHaveLength(1)
  })

  it('emits coordinates derived from the hex id', () => {
    const csv = buildFrontierCsv(['86a91b477ffffff'], hexbins, { taxonFilter: 'all' })
    const cells = csv.trimEnd().split('\n')[1].split(',')
    const lat = Number(cells[FRONTIER_CSV_HEADERS.indexOf('latitude')])
    const lng = Number(cells[FRONTIER_CSV_HEADERS.indexOf('longitude')])
    // Somewhere in Santa Catarina.
    expect(lat).toBeGreaterThan(-30)
    expect(lat).toBeLessThan(-25)
    expect(lng).toBeGreaterThan(-54)
    expect(lng).toBeLessThan(-48)
  })
})

describe('frontierCsvFilename', () => {
  it('includes the taxon filter and an ISO date', () => {
    expect(frontierCsvFilename('vertebrates', new Date('2026-08-23T12:00:00Z')))
      .toBe('biofrontier-sc_vertebrates_2026-08-23.csv')
  })
})
