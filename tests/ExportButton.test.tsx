import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import ExportButton from '@/features/export/ExportButton'
import type { ScoredHexbin, TaxonRecord } from '@/lib/types'
import messages from '@/messages/en.json'

function taxonRecord(): TaxonRecord {
  return {
    occurrenceCount: 12,
    uniqueSpeciesCount: 5,
    uniqueObserverCount: 3,
    uniqueDateCount: 4,
    temporalSpanYears: 7,
    firstDate: '2001-03-04',
    lastDate: '2008-09-12',
    topSpecies: [{ name: 'Panthera onca', count: 4 }],
  }
}

function scoredHex(hexId: string, rank: number): ScoredHexbin {
  return {
    hexId,
    all: taxonRecord(),
    vertebrates: taxonRecord(),
    habitatQuality: 0.75,
    effortScore: 0.25,
    frontierScore: 0.8,
    rank,
    taxonomicIncompleteness: 0.6,
    expectedSpeciesCount: 20,
    missingSpeciesCount: 12,
  }
}

const HEX_IDS = ['86a91b477ffffff', '86a91b47bffffff']
const hexbins = Object.fromEntries(HEX_IDS.map((id, i) => [id, scoredHex(id, i + 1)]))

function renderButton(props: Partial<Parameters<typeof ExportButton>[0]> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ExportButton
        rankedHexIds={HEX_IDS}
        hexbins={hexbins}
        taxonFilter="all"
        visibleCount={20}
        {...props}
      />
    </NextIntlClientProvider>,
  )
}

/**
 * jsdom implements neither Blob URLs nor navigation, so the download itself
 * cannot happen. Stubbing the URL helpers lets the test assert what the
 * component actually controls: that a click produces a correctly-named file
 * with the right contents.
 */
let createdBlobs: Blob[] = []
let clickedLink: HTMLAnchorElement | null = null

beforeEach(() => {
  createdBlobs = []
  clickedLink = null

  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: Blob | MediaSource) => {
    createdBlobs.push(blob as Blob)
    return 'blob:mock'
  })
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

  // Anchors created by the download helper must not actually navigate.
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clickedLink = this
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  cleanup()
})

describe('ExportButton', () => {
  it('renders the export trigger', () => {
    renderButton()
    expect(screen.getByRole('button', { name: /export csv/i })).toBeInTheDocument()
  })

  it('is disabled when there is nothing ranked to export', () => {
    renderButton({ rankedHexIds: [], hexbins: {} })
    expect(screen.getByRole('button', { name: /export csv/i })).toBeDisabled()
  })

  it('opens a scope menu on click', async () => {
    const user = userEvent.setup()
    renderButton()
    await user.click(screen.getByRole('button', { name: /export csv/i }))
    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /top 2 shown/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /all 2 ranked/i })).toBeInTheDocument()
  })

  it('caps the visible-scope label at the number actually ranked', async () => {
    // visibleCount is 20 but only 2 hexbins exist — offering "top 20" would lie.
    const user = userEvent.setup()
    renderButton()
    await user.click(screen.getByRole('button', { name: /export csv/i }))
    expect(screen.getByRole('menuitem', { name: /top 2 shown/i })).toBeInTheDocument()
  })

  it('downloads a CSV with a header and one row per hexbin', async () => {
    const user = userEvent.setup()
    renderButton()
    await user.click(screen.getByRole('button', { name: /export csv/i }))
    await user.click(screen.getByRole('menuitem', { name: /all 2 ranked/i }))

    expect(createdBlobs).toHaveLength(1)
    const text = await createdBlobs[0].text()
    const lines = text.replace(/^\uFEFF/, '').trimEnd().split('\n')
    expect(lines[0]).toContain('frontier_score')
    expect(lines).toHaveLength(3)
  })

  it('names the file after the active taxon filter', async () => {
    const user = userEvent.setup()
    renderButton({ taxonFilter: 'vertebrates' })
    await user.click(screen.getByRole('button', { name: /export csv/i }))
    await user.click(screen.getByRole('menuitem', { name: /all 2 ranked/i }))

    expect(clickedLink!.download).toMatch(/^biofrontier-sc_vertebrates_\d{4}-\d{2}-\d{2}\.csv$/)
  })

  it('prefixes the download with a UTF-8 BOM so Excel decodes accents', async () => {
    const user = userEvent.setup()
    renderButton()
    await user.click(screen.getByRole('button', { name: /export csv/i }))
    await user.click(screen.getByRole('menuitem', { name: /all 2 ranked/i }))

    // Asserted on raw bytes, not Blob.text(): TextDecoder strips a leading BOM
    // during UTF-8 decode by default, so the string form never shows it even
    // when it is present in the file Excel will actually open.
    const bytes = new Uint8Array(await createdBlobs[0].arrayBuffer())
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf])
  })

  it('limits the export when the visible scope is chosen', async () => {
    const user = userEvent.setup()
    renderButton({ visibleCount: 1 })
    await user.click(screen.getByRole('button', { name: /export csv/i }))
    await user.click(screen.getByRole('menuitem', { name: /top 1 shown/i }))

    const text = (await createdBlobs[0].text()).replace(/^\uFEFF/, '')
    expect(text.trimEnd().split('\n')).toHaveLength(2)  // header + 1
  })

  it('closes the menu after exporting', async () => {
    const user = userEvent.setup()
    renderButton()
    await user.click(screen.getByRole('button', { name: /export csv/i }))
    await user.click(screen.getByRole('menuitem', { name: /all 2 ranked/i }))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
