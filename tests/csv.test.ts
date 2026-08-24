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

const ALL_ACTIVE = { habitat: true, incompleteness: true }
const NONE_ACTIVE = { habitat: false, incompleteness: false }

/** Strips the `#` provenance header so row assertions stay focused. */
function dataLines(csv: string): string[] {
  return csv.replace(/^\uFEFF/, '').trimEnd().split('\n').filter(l => !l.startsWith('#'))
}

describe('buildFrontierCsv', () => {
  const hexbins = { '86a91b477ffffff': scoredHex() }

  it('emits a header row matching FRONTIER_CSV_HEADERS', () => {
    const csv = buildFrontierCsv([], {}, { taxonFilter: 'all', activeComponents: ALL_ACTIVE })
    expect(dataLines(csv)[0]).toBe(FRONTIER_CSV_HEADERS.join(','))
  })

  it('emits header only when there are no ranked hexbins', () => {
    const csv = buildFrontierCsv([], {}, { taxonFilter: 'all', activeComponents: ALL_ACTIVE })
    expect(dataLines(csv)).toHaveLength(1)
  })

  it('writes one row per ranked hexbin', () => {
    const csv = buildFrontierCsv(['86a91b477ffffff'], hexbins, { taxonFilter: 'all', activeComponents: ALL_ACTIVE })
    expect(dataLines(csv)).toHaveLength(2)
  })

  it('ends with a trailing newline', () => {
    expect(buildFrontierCsv(['86a91b477ffffff'], hexbins, { taxonFilter: 'all', activeComponents: ALL_ACTIVE }))
      .toMatch(/\n$/)
  })

  it('preserves the order given by rankedHexIds rather than re-sorting', () => {
    const multi = {
      a: scoredHex({ hexId: '86a91b477ffffff', rank: 2, frontierScore: 0.2 }),
      b: scoredHex({ hexId: '86a91b47bffffff', rank: 1, frontierScore: 0.9 }),
    }
    const csv = buildFrontierCsv(['a', 'b'], multi, { taxonFilter: 'all', activeComponents: ALL_ACTIVE })
    const [, first, second] = dataLines(csv)
    expect(first.startsWith('2,')).toBe(true)
    expect(second.startsWith('1,')).toBe(true)
  })

  it('quotes species names containing commas', () => {
    const csv = buildFrontierCsv(['86a91b477ffffff'], hexbins, { taxonFilter: 'all', activeComponents: ALL_ACTIVE })
    expect(csv).toContain('"Panthera onca; Leptodactylus latrans (Steffen, 1815)"')
  })

  it('leaves the incompleteness column empty when the score is null', () => {
    const withNull = {
      '86a91b477ffffff': scoredHex({ taxonomicIncompleteness: null }),
    }
    const csv = buildFrontierCsv(['86a91b477ffffff'], withNull, { taxonFilter: 'all', activeComponents: ALL_ACTIVE })
    const cells = dataLines(csv)[1].split(',')
    const col = FRONTIER_CSV_HEADERS.indexOf('taxonomic_incompleteness')
    expect(cells[col]).toBe('')
  })

  it('reports survey gap as the inverse of effort score', () => {
    const csv = buildFrontierCsv(['86a91b477ffffff'], hexbins, { taxonFilter: 'all', activeComponents: ALL_ACTIVE })
    const cells = dataLines(csv)[1].split(',')
    const col = FRONTIER_CSV_HEADERS.indexOf('survey_gap')
    expect(Number(cells[col])).toBeCloseTo(0.75, 4)  // 1 − 0.25
  })

  it('uses the taxon filter to pick which record block is exported', () => {
    const colOf = (name: string) => FRONTIER_CSV_HEADERS.indexOf(name as never)
    const cellsFor = (taxonFilter: 'all' | 'vertebrates') =>
      dataLines(
        buildFrontierCsv(['86a91b477ffffff'], hexbins, {
          taxonFilter, activeComponents: ALL_ACTIVE,
        }),
      )[1].split(',')

    expect(cellsFor('all')[colOf('occurrence_count')]).toBe('12')
    expect(cellsFor('vertebrates')[colOf('occurrence_count')]).toBe('6')
  })

  it('honours the limit option', () => {
    const many = Object.fromEntries(
      ['a', 'b', 'c'].map(id => [id, scoredHex({ hexId: '86a91b477ffffff' })]),
    )
    const csv = buildFrontierCsv(['a', 'b', 'c'], many, { taxonFilter: 'all', activeComponents: ALL_ACTIVE, limit: 2 })
    expect(dataLines(csv)).toHaveLength(3)  // header + 2
  })

  it('skips ranked ids with no matching hexbin instead of emitting a broken row', () => {
    const csv = buildFrontierCsv(['missing-id'], hexbins, { taxonFilter: 'all', activeComponents: ALL_ACTIVE })
    expect(dataLines(csv)).toHaveLength(1)
  })

  it('emits coordinates derived from the hex id', () => {
    const csv = buildFrontierCsv(['86a91b477ffffff'], hexbins, { taxonFilter: 'all', activeComponents: ALL_ACTIVE })
    const cells = dataLines(csv)[1].split(',')
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

describe('escapeCsvField — spreadsheet formula injection', () => {
  // Species names and collector strings come from third-party APIs, so a value
  // starting with one of these would otherwise be evaluated on open in Excel
  // and LibreOffice.
  it.each(['=', '+', '-', '@'])('neutralises a leading %s', (trigger) => {
    expect(escapeCsvField(`${trigger}HYPERLINK("http://evil","x")`)).toMatch(/^'?"?'/)
  })

  it('prefixes rather than deletes, preserving the original text', () => {
    expect(escapeCsvField('=SUM(A1)')).toBe("'=SUM(A1)")
  })

  it('neutralises leading tab and carriage return', () => {
    // A tab needs no RFC-4180 quoting, so it is only prefixed; a carriage
    // return triggers both.
    expect(escapeCsvField('\tx')).toBe("'\tx")
    expect(escapeCsvField('\rx')).toBe('"\'\rx"')
  })

  it('quotes and neutralises together when both apply', () => {
    expect(escapeCsvField('=a,b')).toBe('"\'=a,b"')
  })

  it('leaves negative numbers intact', () => {
    // Coordinates are all negative in Santa Catarina — prefixing them would
    // turn every latitude and longitude into text.
    expect(escapeCsvField(-27.5954)).toBe('-27.5954')
  })

  it('does not touch names that merely contain a trigger character', () => {
    expect(escapeCsvField('Bothrops jararaca-do-sul')).toBe('Bothrops jararaca-do-sul')
  })
})

describe('buildFrontierCsv — provenance header', () => {
  const hexbins = { '86a91b477ffffff': scoredHex() }

  const header = (activeComponents: { habitat: boolean; incompleteness: boolean }) =>
    buildFrontierCsv(['86a91b477ffffff'], hexbins, {
      taxonFilter: 'all',
      activeComponents,
      generatedAt: '2026-08-23T00:00:00.000Z',
      sources: ['gbif', 'inaturalist'],
    })
      .split('\n')
      .filter(l => l.startsWith('#'))
      .join('\n')

  it('records the dataset timestamp and sources', () => {
    const h = header(ALL_ACTIVE)
    expect(h).toContain('2026-08-23T00:00:00.000Z')
    expect(h).toContain('gbif, inaturalist')
  })

  it('names the components that actually produced the score', () => {
    expect(header(ALL_ACTIVE)).toContain(
      'survey_gap + habitat_quality + taxonomic_incompleteness',
    )
  })

  it('calls out excluded components so the score is reproducible', () => {
    // Without this the export is silently unreproducible: habitat_quality reads
    // 0.5 on every row while contributing nothing to frontier_score.
    const h = header(NONE_ACTIVE)
    expect(h).toContain('EXCLUDED from frontier_score: habitat_quality')
    expect(h).toContain('EXCLUDED from frontier_score: taxonomic_incompleteness')
    expect(h).toContain('# frontier_score computed from: survey_gap')
  })

  it('carries the uncalibrated-weights caveat out of the UI with the data', () => {
    expect(header(ALL_ACTIVE)).toContain('uncalibrated hypothesis')
  })

  it('marks per-row whether each optional component entered the score', () => {
    const cells = dataLines(
      buildFrontierCsv(['86a91b477ffffff'], hexbins, {
        taxonFilter: 'all', activeComponents: NONE_ACTIVE,
      }),
    )[1].split(',')
    expect(cells[FRONTIER_CSV_HEADERS.indexOf('habitat_in_score')]).toBe('no')
    expect(cells[FRONTIER_CSV_HEADERS.indexOf('incompleteness_in_score')]).toBe('no')
  })

  it('uses # so R, pandas and QGIS skip the header as comments', () => {
    const csv = buildFrontierCsv(['86a91b477ffffff'], hexbins, {
      taxonFilter: 'all', activeComponents: ALL_ACTIVE,
    })
    const beforeHeaderRow = csv.split('\n').slice(0, -3)
    expect(beforeHeaderRow.every(l => l.startsWith('#') || l.startsWith('rank,'))).toBe(true)
  })
})

describe('escapeCsvField — numeric strings are not mistaken for formulas', () => {
  it('leaves a negative coordinate string intact', () => {
    // Regression: every SC longitude starts with '-' and arrives pre-formatted
    // by toFixed, so prefixing it made the column unparseable (Number() → NaN).
    expect(escapeCsvField('-48.515839')).toBe('-48.515839')
    expect(escapeCsvField('-27.596615')).toBe('-27.596615')
  })

  it('leaves scientific notation intact', () => {
    expect(escapeCsvField('-1.5e-7')).toBe('-1.5e-7')
  })

  it('still neutralises a formula that merely looks numeric at the start', () => {
    expect(escapeCsvField('-1+cmd|calc')).toBe("'-1+cmd|calc")
  })
})
