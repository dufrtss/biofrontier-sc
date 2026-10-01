'use client'

import { useTranslations } from 'next-intl'
import type { TaxonFilter } from '@/lib/types'
import InfoTooltip from '@/components/ui/InfoTooltip'

interface Props {
  value: TaxonFilter
  /**
   * Filters to offer, already ordered and restricted to those the loaded
   * dataset has records for, see `resolveAvailableFilters`. An old data file
   * therefore shows a shorter list rather than filters that rank nothing.
   */
  options: TaxonFilter[]
  onChange: (v: TaxonFilter) => void
  onOpenMethodology: (sectionId: string) => void
}

export default function TaxonSelector({ value, options, onChange, onOpenMethodology }: Props) {
  const t = useTranslations('TaxonSelector')

  return (
    // Below lg the whole row scrolls from screen edge to screen edge, like the
    // data summary bar under it: the negative margin cancels the header's
    // padding so pills slide off the edge of the screen rather than being cut
    // inside the track. From lg up the row shares the header with the name, so
    // only the track scrolls and the tooltip stays in view.
    <div
      className="flex items-center gap-2 min-w-0 flex-1 -mx-3 px-3 sm:-mx-5 sm:px-5 overflow-x-auto [&::-webkit-scrollbar]:hidden lg:mx-0 lg:px-0 lg:flex-initial lg:overflow-visible"
      style={{ scrollbarWidth: 'none' }}
    >
      {/*
        Radiogroup rather than a row of buttons: exactly one filter is active at
        a time, and without `aria-checked` which one is active is carried by
        background colour alone: invisible to a screen reader, and marginal for
        anyone who does not perceive the contrast.
      */}
      <div
        role="radiogroup"
        aria-label={t('groupLabel')}
        className="flex gap-1 shrink-0 bg-slate-100 rounded-full p-1 lg:shrink lg:min-w-0 lg:overflow-x-auto [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: 'none' }}
      >
        {options.map(filter => (
          <button
            key={filter}
            role="radio"
            aria-checked={value === filter}
            onClick={() => onChange(filter)}
            className={[
              'px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap',
              value === filter
                ? 'bg-brand-solid text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900',
            ].join(' ')}
          >
            {t(`labels.${filter}`)}
          </button>
        ))}
      </div>
      <InfoTooltip
        content={t(`tooltips.${value}`)}
        learnMore={{ sectionId: 'taxa-coverage' }}
        onLearnMore={onOpenMethodology}
        align="right"
      />
    </div>
  )
}
