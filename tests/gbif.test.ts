import { describe, it, expect } from 'vitest'
import { gbifSpeciesUrl } from '@/lib/gbif'

describe('gbifSpeciesUrl', () => {
  it('links straight to the taxon page when the usage key is known', () => {
    // gbif.org/species/5124607 serves the page canonicalised as /taxon/948G2.
    expect(gbifSpeciesUrl('Rothschildia speculifer', 5124607))
      .toBe('https://www.gbif.org/species/5124607')
  })

  it('falls back to a pre-filled taxon search when no key is known', () => {
    expect(gbifSpeciesUrl('Rothschildia speculifer'))
      .toBe('https://www.gbif.org/taxon/search?q=Rothschildia%20speculifer')
    expect(gbifSpeciesUrl('Boana faber', null))
      .toBe('https://www.gbif.org/taxon/search?q=Boana%20faber')
  })

  it('never emits /species/search, which GBIF redirects without the query', () => {
    for (const url of [gbifSpeciesUrl('Boana faber'), gbifSpeciesUrl('Boana faber', 2426857)]) {
      expect(url).not.toContain('/species/search')
    }
  })
})
