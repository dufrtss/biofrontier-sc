import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import FrontierRanking from '@/features/ranking/FrontierRanking'
import type { ScoredHexbin } from '@/lib/types'
import messages from '@/messages/en.json'
import ptMessages from '@/messages/pt-BR.json'

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
    frontierScore: 0.85,
    rank,
    taxonomicIncompleteness: null,
    expectedSpeciesCount: 0,
    missingSpeciesCount: 0,
  }
}

const hexbins = {
  '86a91b477ffffff': hex('86a91b477ffffff', 3, 1),
  '86a91b47bffffff': hex('86a91b47bffffff', 7, 25),
}

function renderRanking(props: Partial<Parameters<typeof FrontierRanking>[0]> = {}, locale = 'en') {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'en' ? messages : ptMessages}>
      <FrontierRanking
        rankedHexIds={Object.keys(hexbins)}
        totalRankedCount={2396}
        hexbins={hexbins}
        taxonFilter="all"
        selectedHexId={null}
        onSelect={() => {}}
        onOpenMethodology={() => {}}
        minRecords={1}
        onMinRecordsChange={() => {}}
        {...props}
      />
    </NextIntlClientProvider>,
  )
}

afterEach(cleanup)

describe('FrontierRanking evidence', () => {
  it('shows an evidence level next to each score', () => {
    renderRanking()
    expect(screen.getByText('Weak evidence')).toBeInTheDocument()
    expect(screen.getByText('Strong evidence')).toBeInTheDocument()
  })

  it('keeps each hexbin on its own rank rather than renumbering the list', () => {
    renderRanking()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('marks the active minimum and reports a new one', async () => {
    const onMinRecordsChange = vi.fn()
    renderRanking({ minRecords: 5, onMinRecordsChange })

    expect(screen.getByRole('radio', { name: '≥ 5' })).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(screen.getByRole('radio', { name: '≥ 20' }))
    expect(onMinRecordsChange).toHaveBeenCalledWith(20)
  })

  it('says how many locations clear the minimum, with plurals', () => {
    renderRanking({ minRecords: 5, rankedHexIds: ['86a91b47bffffff'] })
    expect(screen.getByText('1 location of 2,396 with at least 5 records')).toBeInTheDocument()
  })

  it('formats counts in the page locale, not the browser one', () => {
    renderRanking({ minRecords: 5, rankedHexIds: ['86a91b47bffffff'] }, 'pt-BR')
    expect(screen.getByText('1 localidade de 2.396 com pelo menos 5 registros')).toBeInTheDocument()
  })

  it('explains an empty list instead of showing nothing', () => {
    renderRanking({ minRecords: 20, rankedHexIds: [] })
    expect(screen.getByText(/No location has 20 records or more/)).toBeInTheDocument()
  })
})
