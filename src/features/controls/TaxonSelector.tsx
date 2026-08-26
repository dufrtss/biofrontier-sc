'use client'

import { useTranslations } from 'next-intl'
import type { TaxonFilter } from '@/lib/types'
import InfoTooltip from '@/components/ui/InfoTooltip'

interface Props {
  value: TaxonFilter
  /**
   * Filters to offer, already ordered and restricted to those the loaded
   * dataset has records for — see `resolveAvailableFilters`. An old data file
   * therefore shows a shorter list rather than filters that rank nothing.
   */
  options: TaxonFilter[]
  onChange: (v: TaxonFilter) => void
  onOpenMethodology: (sectionId: string) => void
}

export default function TaxonSelector({ value, options, onChange, onOpenMethodology }: Props) {
  const t = useTranslations('TaxonSelector')

  return (
    <div className="flex items-center gap-2">
      {/*
        Radiogroup rather than a row of buttons: exactly one filter is active at
        a time, and without `aria-checked` which one is active is carried by
        background colour alone — invisible to a screen reader, and marginal for
        anyone who does not perceive the contrast.
      */}
      <div
        role="radiogroup"
        aria-label={t('groupLabel')}
        className="flex gap-1 bg-slate-800 rounded-full p-1 overflow-x-auto [&::-webkit-scrollbar]:hidden"
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
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200',
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
