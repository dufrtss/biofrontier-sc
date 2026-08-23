import { describe, it, expect } from 'vitest'
import { normalizeHexbinsFile, habitatDataIsPlaceholder, CURRENT_SCHEMA_VERSION } from '@/lib/hexbins-file'
import type { HexbinsFile, TaxonRecord } from '@/lib/types'

function taxonRecord(topSpecies: string[], overrides: Partial<TaxonRecord> = {}): TaxonRecord {
  return {
    occurrenceCount: topSpecies.length,
    uniqueSpeciesCount: topSpecies.length,
    uniqueObserverCount: 1,
    uniqueDateCount: 1,
    temporalSpanYears: 0,
    firstDate: null,
    lastDate: null,
    topSpecies: topSpecies.map(name => ({ name, count: 1 })),
    ...overrides,
  }
}

function v1File(): HexbinsFile {
  return {
    generatedAt: '2026-06-10T16:18:57.699Z',
    hexbinCount: 2,
    hexbins: [
      {
        hexId: '86a91b477ffffff',
        all: taxonRecord(['Panthera onca', 'Tapirus terrestris']),
        vertebrates: taxonRecord(['Panthera onca']),
        habitatQuality: 0.8,
      },
      {
        hexId: '86a91b47bffffff',
        all: taxonRecord(['Tapirus terrestris', 'Chrysocyon brachyurus']),
        vertebrates: taxonRecord(['Chrysocyon brachyurus']),
        habitatQuality: 0.4,
      },
    ],
  }
}

describe('normalizeHexbinsFile — v1 input', () => {
  it('stamps schemaVersion 1 when the field is absent', () => {
    expect(normalizeHexbinsFile(v1File()).schemaVersion).toBe(1)
  })

  it('flags species data as partial', () => {
    expect(normalizeHexbinsFile(v1File()).speciesDataIsPartial).toBe(true)
  })

  it('builds a deduplicated species index from topSpecies', () => {
    const { speciesIndex } = normalizeHexbinsFile(v1File())
    // Tapirus appears in both hexbins but must be indexed once.
    expect(speciesIndex).toHaveLength(3)
    expect([...speciesIndex].sort()).toEqual([
      'Chrysocyon brachyurus',
      'Panthera onca',
      'Tapirus terrestris',
    ])
  })

  it('assigns speciesIds that resolve back to the right names', () => {
    const file = normalizeHexbinsFile(v1File())
    const resolve = (ids: number[] | undefined) => (ids ?? []).map(i => file.speciesIndex[i])

    expect(resolve(file.hexbins[0].all.speciesIds)).toEqual([
      'Panthera onca',
      'Tapirus terrestris',
    ])
    expect(resolve(file.hexbins[1].all.speciesIds)).toEqual([
      'Tapirus terrestris',
      'Chrysocyon brachyurus',
    ])
    expect(resolve(file.hexbins[1].vertebrates.speciesIds)).toEqual([
      'Chrysocyon brachyurus',
    ])
  })

  it('gives the same species the same id across hexbins and taxon filters', () => {
    const file = normalizeHexbinsFile(v1File())
    const tapirInHex0 = file.hexbins[0].all.speciesIds![1]
    const tapirInHex1 = file.hexbins[1].all.speciesIds![0]
    expect(tapirInHex0).toBe(tapirInHex1)

    const oncaAll  = file.hexbins[0].all.speciesIds![0]
    const oncaVert = file.hexbins[0].vertebrates.speciesIds![0]
    expect(oncaAll).toBe(oncaVert)
  })

  it('defaults sources to an empty list', () => {
    expect(normalizeHexbinsFile(v1File()).sources).toEqual([])
  })

  it('handles a hexbin with no recorded species', () => {
    const file = v1File()
    file.hexbins[0].all = taxonRecord([], { occurrenceCount: 0, uniqueSpeciesCount: 0 })
    const normalized = normalizeHexbinsFile(file)
    expect(normalized.hexbins[0].all.speciesIds).toEqual([])
  })
})

describe('normalizeHexbinsFile — v2 input', () => {
  function v2File(): HexbinsFile {
    return {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      generatedAt: '2026-08-23T00:00:00.000Z',
      hexbinCount: 1,
      speciesIndex: ['Panthera onca', 'Tapirus terrestris', 'Leopardus wiedii'],
      sources: [
        { id: 'gbif', recordCount: 10, duplicatesDropped: 0, fetchedAt: '2026-08-23T00:00:00.000Z' },
      ],
      hexbins: [
        {
          hexId: '86a91b477ffffff',
          all: taxonRecord(['Panthera onca'], { speciesIds: [0, 1, 2] }),
          vertebrates: taxonRecord(['Panthera onca'], { speciesIds: [0, 2] }),
          habitatQuality: 0.8,
        },
      ],
    }
  }

  it('passes the species index through untouched', () => {
    const file = normalizeHexbinsFile(v2File())
    expect(file.speciesIndex).toHaveLength(3)
    expect(file.speciesDataIsPartial).toBe(false)
  })

  it('preserves speciesIds beyond what topSpecies would have yielded', () => {
    // The point of v2: 3 species recorded, only 1 in the top-10 list.
    const file = normalizeHexbinsFile(v2File())
    expect(file.hexbins[0].all.speciesIds).toEqual([0, 1, 2])
  })

  it('preserves source provenance', () => {
    expect(normalizeHexbinsFile(v2File()).sources[0].id).toBe('gbif')
  })

  it('falls back to reconstruction if a v2-stamped file is missing its index', () => {
    const broken = { ...v2File(), speciesIndex: undefined }
    const file = normalizeHexbinsFile(broken)
    expect(file.speciesDataIsPartial).toBe(true)
    expect(file.speciesIndex.length).toBeGreaterThan(0)
  })
})

describe('habitatDataIsPlaceholder', () => {
  const hex = (hexId: string, habitatQuality: number) => ({
    hexId,
    all: taxonRecord([]),
    vertebrates: taxonRecord([]),
    habitatQuality,
  })

  it('detects the uniform 0.5 fallback', () => {
    expect(habitatDataIsPlaceholder([
      hex('a', 0.5), hex('b', 0.5), hex('c', 0.5),
    ])).toBe(true)
  })

  it('returns false once any hexbin differs', () => {
    expect(habitatDataIsPlaceholder([
      hex('a', 0.5), hex('b', 0.5), hex('c', 0.81),
    ])).toBe(false)
  })

  it('treats a uniform non-0.5 value as a placeholder too', () => {
    // Any constant is equally useless for discriminating between hexbins.
    expect(habitatDataIsPlaceholder([hex('a', 0.3), hex('b', 0.3)])).toBe(true)
  })

  it('treats a degenerate dataset as placeholder rather than throwing', () => {
    expect(habitatDataIsPlaceholder([])).toBe(true)
    expect(habitatDataIsPlaceholder([hex('a', 0.7)])).toBe(true)
  })

  it('is surfaced on the normalized file', () => {
    expect(normalizeHexbinsFile(v1File()).habitatIsPlaceholder).toBe(false)
  })
})
