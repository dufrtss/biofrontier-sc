import { describe, it, expect } from 'vitest'
import { TAXON_FILTERS, groupsForClass, matchesFilter } from '@/lib/taxonomy'

describe('groupsForClass', () => {
  it('places a vertebrate class in both its group and vertebrates', () => {
    expect([...groupsForClass('Aves')].sort()).toEqual(['birds', 'vertebrates'])
    expect([...groupsForClass('Mammalia')].sort()).toEqual(['mammals', 'vertebrates'])
  })

  it('folds reptiles and amphibians into one herpetofauna group', () => {
    expect([...groupsForClass('Reptilia')].sort()).toEqual(['herpetofauna', 'vertebrates'])
    expect([...groupsForClass('Amphibia')].sort()).toEqual(['herpetofauna', 'vertebrates'])
  })

  it('counts fish as vertebrates without a group of their own', () => {
    expect(groupsForClass('Actinopterygii')).toEqual(['vertebrates'])
    // Museum collections in speciesLink still use the legacy grouping.
    expect(groupsForClass('Osteichthyes')).toEqual(['vertebrates'])
  })

  it('is case- and whitespace-insensitive, as providers are inconsistent', () => {
    expect(groupsForClass('  aVeS ')).toEqual(groupsForClass('Aves'))
  })

  it('groups iNaturalist molluscs, which arrive as a phylum', () => {
    // `iconic_taxon_name` resolves molluscs to Mollusca, not to a class.
    expect(groupsForClass('Mollusca')).toEqual(['invertebrates'])
  })

  it('leaves records it cannot place ungrouped rather than guessing', () => {
    // Plants and fungi are real occurrences and still count toward `all`;
    // `Animalia` is an animal of unknown kind, which is not enough to decide
    // vertebrate from invertebrate.
    expect(groupsForClass('Magnoliopsida')).toEqual([])
    expect(groupsForClass('Agaricomycetes')).toEqual([])
    expect(groupsForClass('Animalia')).toEqual([])
    expect(groupsForClass(null)).toEqual([])
    expect(groupsForClass('')).toEqual([])
  })

  it('never returns `all`, which membership is unconditional', () => {
    for (const className of ['Aves', 'Insecta', 'Magnoliopsida']) {
      expect(groupsForClass(className)).not.toContain('all')
    }
  })
})

describe('matchesFilter', () => {
  it('matches every record under `all`, including unclassified ones', () => {
    expect(matchesFilter('Aves', 'all')).toBe(true)
    expect(matchesFilter(null, 'all')).toBe(true)
  })

  it('treats the filters as overlapping views, not a partition', () => {
    // One toucan is simultaneously a bird, a vertebrate and a record.
    expect(matchesFilter('Aves', 'birds')).toBe(true)
    expect(matchesFilter('Aves', 'vertebrates')).toBe(true)
    expect(matchesFilter('Aves', 'all')).toBe(true)
  })

  it('keeps vertebrates and invertebrates disjoint', () => {
    expect(matchesFilter('Insecta', 'vertebrates')).toBe(false)
    expect(matchesFilter('Mammalia', 'invertebrates')).toBe(false)
  })
})

describe('TAXON_FILTERS', () => {
  it('leads with `all`, the default selection', () => {
    expect(TAXON_FILTERS[0]).toBe('all')
  })

  it('has a class mapped to every group filter', () => {
    // A filter no class maps to would render as a button that ranks nothing.
    const reachable = new Set(
      ['Mammalia', 'Aves', 'Reptilia', 'Amphibia', 'Actinopterygii', 'Insecta']
        .flatMap(c => [...groupsForClass(c)]),
    )
    for (const filter of TAXON_FILTERS) {
      if (filter === 'all') continue
      expect(reachable).toContain(filter)
    }
  })
})
