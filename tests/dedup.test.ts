import { describe, it, expect } from 'vitest'
import { dedupeOccurrences, occurrenceKey } from '../scripts/sources/dedup'
import type { Occurrence } from '../scripts/sources/types'

function occ(overrides: Partial<Occurrence> = {}): Occurrence {
  return {
    lat: -27.5954,
    lng: -48.5480,
    species: 'Panthera onca',
    isVertebrate: true,
    observer: 'someone',
    date: '2024-03-15',
    source: 'gbif',
    ...overrides,
  }
}

describe('occurrenceKey', () => {
  it('is stable for identical records', () => {
    expect(occurrenceKey(occ())).toBe(occurrenceKey(occ()))
  })

  it('ignores the source, so the same observation from two providers collides', () => {
    expect(occurrenceKey(occ({ source: 'gbif' })))
      .toBe(occurrenceKey(occ({ source: 'inaturalist' })))
  })

  it('ignores the observer, whose formatting differs between providers', () => {
    // GBIF carries "Silva, J." where iNaturalist carries a username.
    expect(occurrenceKey(occ({ observer: 'Silva, J.' })))
      .toBe(occurrenceKey(occ({ observer: 'jsilva' })))
  })

  it('tolerates sub-metre coordinate drift between providers', () => {
    expect(occurrenceKey(occ({ lat: -27.59540001 })))
      .toBe(occurrenceKey(occ({ lat: -27.5954 })))
  })

  it('distinguishes genuinely different locations', () => {
    expect(occurrenceKey(occ({ lat: -27.5954 })))
      .not.toBe(occurrenceKey(occ({ lat: -27.6954 })))
  })

  it('distinguishes different species at the same place and time', () => {
    expect(occurrenceKey(occ({ species: 'Panthera onca' })))
      .not.toBe(occurrenceKey(occ({ species: 'Tapirus terrestris' })))
  })

  it('distinguishes different dates', () => {
    expect(occurrenceKey(occ({ date: '2024-03-15' })))
      .not.toBe(occurrenceKey(occ({ date: '2024-03-16' })))
  })
})

describe('dedupeOccurrences', () => {
  it('keeps a single copy when the same observation arrives from two sources', () => {
    const { records } = dedupeOccurrences([
      occ({ source: 'gbif' }),
      occ({ source: 'inaturalist' }),
    ])
    expect(records).toHaveLength(1)
  })

  it('keeps the first source listed, preserving its provenance', () => {
    const { records } = dedupeOccurrences([
      occ({ source: 'gbif' }),
      occ({ source: 'inaturalist' }),
    ])
    expect(records[0].source).toBe('gbif')
  })

  it('attributes the drop to the source whose record was discarded', () => {
    const { droppedBySource } = dedupeOccurrences([
      occ({ source: 'gbif' }),
      occ({ source: 'inaturalist' }),
      occ({ source: 'inaturalist' }),
    ])
    expect(droppedBySource).toEqual({ inaturalist: 2 })
  })

  it('leaves genuinely distinct records untouched', () => {
    const { records, droppedBySource } = dedupeOccurrences([
      occ({ species: 'Panthera onca' }),
      occ({ species: 'Tapirus terrestris' }),
      occ({ date: '2020-01-01' }),
    ])
    expect(records).toHaveLength(3)
    expect(droppedBySource).toEqual({})
  })

  it('keeps records that have neither species nor date rather than collapsing them', () => {
    // Their key would be little more than a coordinate, so deduplicating on it
    // would discard distinct observations that merely share a location.
    const { records } = dedupeOccurrences([
      occ({ species: null, date: null }),
      occ({ species: null, date: null }),
    ])
    expect(records).toHaveLength(2)
  })

  it('still deduplicates when only the date is missing', () => {
    const { records } = dedupeOccurrences([
      occ({ date: null, source: 'gbif' }),
      occ({ date: null, source: 'inaturalist' }),
    ])
    expect(records).toHaveLength(1)
  })

  it('handles an empty input', () => {
    expect(dedupeOccurrences([]).records).toEqual([])
  })

  it('preserves input order among the kept records', () => {
    const { records } = dedupeOccurrences([
      occ({ species: 'C' }),
      occ({ species: 'A' }),
      occ({ species: 'B' }),
    ])
    expect(records.map(r => r.species)).toEqual(['C', 'A', 'B'])
  })
})
