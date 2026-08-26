import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import TaxonSelector from '@/features/controls/TaxonSelector'
import { TAXON_FILTERS } from '@/lib/taxonomy'
import type { TaxonFilter } from '@/lib/types'
import messages from '@/messages/en.json'

afterEach(cleanup)

function renderSelector(options: TaxonFilter[], value: TaxonFilter = 'all') {
  const onChange = vi.fn()
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <TaxonSelector
        value={value}
        options={options}
        onChange={onChange}
        onOpenMethodology={vi.fn()}
      />
    </NextIntlClientProvider>,
  )
  return { onChange }
}

describe('TaxonSelector', () => {
  it('renders one button per offered filter, in the given order', () => {
    renderSelector([...TAXON_FILTERS])
    const labels = screen.getAllByRole('radio').map(b => b.textContent)
    expect(labels).toEqual([
      'All Taxa', 'Vertebrates', 'Birds', 'Mammals', 'Herpetofauna', 'Invertebrates',
    ])
  })

  it('has a label for every filter, so no button renders as a raw key', () => {
    // The labels are looked up by dynamic key; a missing translation would
    // otherwise reach production as a button reading `labels.mammals`.
    renderSelector([...TAXON_FILTERS])
    for (const option of screen.getAllByRole('radio')) {
      expect(option.textContent).not.toMatch(/^labels\./)
    }
  })

  it('offers only the filters the dataset supports', () => {
    // What a pre-v3 data file yields from `resolveAvailableFilters`.
    renderSelector(['all', 'vertebrates'])
    expect(screen.getAllByRole('radio').map(b => b.textContent))
      .toEqual(['All Taxa', 'Vertebrates'])
  })

  it('reports the chosen filter', async () => {
    const { onChange } = renderSelector([...TAXON_FILTERS])
    await userEvent.click(screen.getByText('Herpetofauna'))
    expect(onChange).toHaveBeenCalledWith('herpetofauna')
  })

  it('marks exactly the active filter as checked', () => {
    // Selection is otherwise conveyed by background colour alone.
    renderSelector([...TAXON_FILTERS], 'birds')
    const checked = screen.getAllByRole('radio').filter(o => o.getAttribute('aria-checked') === 'true')
    expect(checked.map(o => o.textContent)).toEqual(['Birds'])
  })

  it('shows the active filter\'s tooltip rather than a raw key', async () => {
    renderSelector([...TAXON_FILTERS], 'invertebrates')
    await userEvent.click(screen.getByRole('button', { name: 'More information' }))
    expect(document.body.textContent).toContain('Animals without a backbone')
  })
})
