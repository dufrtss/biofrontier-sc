import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import HexDetail from '@/features/detail/HexDetail'
import type { ScoredHexbin, TaxonRecord } from '@/lib/types'
import messages from '@/messages/en.json'

function taxonRecord(): TaxonRecord {
  return {
    occurrenceCount: 12,
    uniqueSpeciesCount: 2,
    uniqueObserverCount: 3,
    uniqueDateCount: 4,
    temporalSpanYears: 7,
    firstDate: '2001-03-04',
    lastDate: '2008-09-12',
    topSpecies: [
      { name: 'Rothschildia speculifer', count: 4 },
      { name: 'Boana faber', count: 2 },
    ],
    speciesIds: [0, 1],
  }
}

const hex: ScoredHexbin = {
  hexId: '86a91b477ffffff',
  taxa: { all: taxonRecord() },
  habitatQuality: 0.75,
  effortScore: 0.25,
  frontierScore: 0.8,
  rank: 1,
  taxonomicIncompleteness: 0.6,
  expectedSpeciesCount: 20,
  missingSpeciesCount: 12,
}

function renderDetail(gbifKeyByName: Map<string, number>) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <HexDetail
        hex={hex}
        taxonFilter="all"
        gbifKeyByName={gbifKeyByName}
        habitatIsPlaceholder={false}
        onClose={() => {}}
        onOpenMethodology={() => {}}
      />
    </NextIntlClientProvider>,
  )
}

afterEach(cleanup)

describe('HexDetail species links', () => {
  it('links a species with a known key to its GBIF taxon page', () => {
    renderDetail(new Map([['Rothschildia speculifer', 5124607]]))
    expect(screen.getByRole('link', { name: 'Rothschildia speculifer' }))
      .toHaveAttribute('href', 'https://www.gbif.org/species/5124607')
  })

  it('falls back to a pre-filled search for a species with no key', () => {
    renderDetail(new Map([['Rothschildia speculifer', 5124607]]))
    expect(screen.getByRole('link', { name: 'Boana faber' }))
      .toHaveAttribute('href', 'https://www.gbif.org/taxon/search?q=Boana%20faber')
  })
})
