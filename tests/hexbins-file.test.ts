import { describe, it, expect } from 'vitest'
import {
  normalizeHexbinsFile,
  habitatDataIsPlaceholder,
  resolveAvailableFilters,
  taxonDataFor,
  CURRENT_SCHEMA_VERSION,
} from '@/lib/hexbins-file'
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

    expect(resolve(taxonDataFor(file.hexbins[0], 'all').speciesIds)).toEqual([
      'Panthera onca',
      'Tapirus terrestris',
    ])
    expect(resolve(taxonDataFor(file.hexbins[1], 'all').speciesIds)).toEqual([
      'Tapirus terrestris',
      'Chrysocyon brachyurus',
    ])
    expect(resolve(taxonDataFor(file.hexbins[1], 'vertebrates').speciesIds)).toEqual([
      'Chrysocyon brachyurus',
    ])
  })

  it('gives the same species the same id across hexbins and taxon filters', () => {
    const file = normalizeHexbinsFile(v1File())
    const tapirInHex0 = taxonDataFor(file.hexbins[0], 'all').speciesIds![1]
    const tapirInHex1 = taxonDataFor(file.hexbins[1], 'all').speciesIds![0]
    expect(tapirInHex0).toBe(tapirInHex1)

    const oncaAll  = taxonDataFor(file.hexbins[0], 'all').speciesIds![0]
    const oncaVert = taxonDataFor(file.hexbins[0], 'vertebrates').speciesIds![0]
    expect(oncaAll).toBe(oncaVert)
  })

  it('defaults sources to an empty list', () => {
    expect(normalizeHexbinsFile(v1File()).sources).toEqual([])
  })

  it('handles a hexbin with no recorded species', () => {
    const file = v1File()
    file.hexbins[0].all = taxonRecord([], { occurrenceCount: 0, uniqueSpeciesCount: 0 })
    const normalized = normalizeHexbinsFile(file)
    expect(taxonDataFor(normalized.hexbins[0], 'all').speciesIds).toEqual([])
  })
})

describe('normalizeHexbinsFile — v2 input', () => {
  function v2File(): HexbinsFile {
    return {
      schemaVersion: 2,
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
    expect(taxonDataFor(file.hexbins[0], 'all').speciesIds).toEqual([0, 1, 2])
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

describe('normalizeHexbinsFile — v3 input', () => {
  function v3File(): HexbinsFile {
    return {
      schemaVersion: 3,
      generatedAt: '2026-08-26T00:00:00.000Z',
      hexbinCount: 2,
      speciesIndex: ['Ramphastos dicolorus', 'Boana faber', 'Leopardus wiedii'],
      sources: [
        { id: 'gbif', recordCount: 10, duplicatesDropped: 0, fetchedAt: '2026-08-26T00:00:00.000Z' },
      ],
      hexbins: [
        {
          hexId: '86a91b477ffffff',
          taxa: {
            all:         taxonRecord(['Ramphastos dicolorus'], { speciesIds: [0, 1, 2] }),
            vertebrates: taxonRecord(['Ramphastos dicolorus'], { speciesIds: [0, 1, 2] }),
            birds:       taxonRecord(['Ramphastos dicolorus'], { speciesIds: [0] }),
            herpetofauna: taxonRecord(['Boana faber'], { speciesIds: [1] }),
          },
          habitatQuality: 0.8,
        },
        // Every filter omitted: the pipeline writes nothing for a hexbin with
        // no records rather than six zeroed blocks.
        { hexId: '86a91b47bffffff', taxa: {}, habitatQuality: 0.4 },
      ],
    }
  }

  it('passes a v3 taxa map through without rebuilding it', () => {
    const file = normalizeHexbinsFile(v3File())
    expect(file.speciesDataIsPartial).toBe(false)
    expect(taxonDataFor(file.hexbins[0], 'birds').speciesIds).toEqual([0])
  })

  it('substitutes an empty record for a filter the hexbin omits', () => {
    const file = normalizeHexbinsFile(v3File())
    const mammals = taxonDataFor(file.hexbins[0], 'mammals')
    expect(mammals.occurrenceCount).toBe(0)
    expect(mammals.topSpecies).toEqual([])
    expect(taxonDataFor(file.hexbins[1], 'all').occurrenceCount).toBe(0)
  })

  it('offers the shared empty record as frozen, so a stray write cannot leak', () => {
    const file = normalizeHexbinsFile(v3File())
    const empty = taxonDataFor(file.hexbins[1], 'all')
    expect(() => { empty.occurrenceCount = 99 }).toThrow()
    expect(taxonDataFor(file.hexbins[0], 'mammals').occurrenceCount).toBe(0)
  })
})

describe('normalizeHexbinsFile — GBIF usage keys', () => {
  function v4File(speciesKeys?: Array<number | null>): HexbinsFile {
    return {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      generatedAt: '2026-08-30T00:00:00.000Z',
      hexbinCount: 1,
      speciesIndex: ['Rothschildia speculifer', 'Boana faber', 'Leopardus wiedii'],
      speciesKeys,
      hexbins: [
        {
          hexId: '86a91b477ffffff',
          taxa: { all: taxonRecord(['Rothschildia speculifer'], { speciesIds: [0, 1, 2] }) },
          habitatQuality: 0.8,
        },
      ],
    }
  }

  it('pairs each key with its species name', () => {
    const { gbifKeyByName } = normalizeHexbinsFile(v4File([5124607, 2426857, 2434970]))
    expect(gbifKeyByName.get('Rothschildia speculifer')).toBe(5124607)
    expect(gbifKeyByName.get('Leopardus wiedii')).toBe(2434970)
  })

  it('omits names the backbone could not match', () => {
    const { gbifKeyByName } = normalizeHexbinsFile(v4File([5124607, null, 2434970]))
    expect(gbifKeyByName.has('Boana faber')).toBe(false)
    expect(gbifKeyByName.size).toBe(2)
  })

  it('yields an empty map for a file without keys', () => {
    expect(normalizeHexbinsFile(v4File()).gbifKeyByName.size).toBe(0)
    expect(normalizeHexbinsFile(v1File()).gbifKeyByName.size).toBe(0)
  })

  it('ignores keys past the end of the species index', () => {
    // A truncated or over-long array must not pair a key with the wrong name.
    const { gbifKeyByName } = normalizeHexbinsFile(v4File([5124607]))
    expect(gbifKeyByName.size).toBe(1)
    expect(gbifKeyByName.get('Rothschildia speculifer')).toBe(5124607)
  })
})

describe('resolveAvailableFilters', () => {
  const hex = (taxa: Record<string, TaxonRecord>) => ({
    hexId: 'a', taxa, habitatQuality: 0.5,
  })

  it('lists filters with records, in display order', () => {
    const filters = resolveAvailableFilters([
      hex({ all: taxonRecord(['x']), birds: taxonRecord(['x']) }),
      hex({ all: taxonRecord(['y']), invertebrates: taxonRecord(['y']) }),
    ])
    expect(filters).toEqual(['all', 'birds', 'invertebrates'])
  })

  it('hides the group filters for a pre-v3 dataset', () => {
    // A v2 file upgrades to a two-key taxa map, so the selector must fall back
    // to the two filters that file can actually answer for.
    const file = normalizeHexbinsFile({
      schemaVersion: 2,
      generatedAt: '2026-08-23T00:00:00.000Z',
      hexbinCount: 1,
      speciesIndex: ['Panthera onca'],
      hexbins: [{
        hexId: '86a91b477ffffff',
        all: taxonRecord(['Panthera onca'], { speciesIds: [0] }),
        vertebrates: taxonRecord(['Panthera onca'], { speciesIds: [0] }),
        habitatQuality: 0.8,
      }],
    })
    expect(file.availableFilters).toEqual(['all', 'vertebrates'])
  })

  it('drops a filter present but empty in every hexbin', () => {
    const filters = resolveAvailableFilters([
      hex({ all: taxonRecord(['x']), mammals: taxonRecord([], { occurrenceCount: 0 }) }),
    ])
    expect(filters).toEqual(['all'])
  })

  it('always offers `all`, even for an empty dataset', () => {
    // `all` is the default selection; a selector with no options at all reads
    // as a broken build rather than as an empty dataset.
    expect(resolveAvailableFilters([])).toEqual(['all'])
  })
})

describe('habitatDataIsPlaceholder', () => {
  const hex = (hexId: string, habitatQuality: number) => ({
    hexId,
    taxa: { all: taxonRecord([]) },
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
