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

        One outline around the group and a shared hairline between segments,
        rather than a pill per option: a segmented control should read as a
        single machined part that has been divided, not as a row of separate
        consumer buttons floating in a tray.
      */}
      <div
        role="radiogroup"
        aria-label={t('groupLabel')}
        className="flex border border-edge overflow-x-auto [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: 'none' }}
      >
        {options.map(filter => (
          <button
            key={filter}
            role="radio"
            aria-checked={value === filter}
            onClick={() => onChange(filter)}
            className={[
              // `.hud-label` is unlayered CSS and therefore outranks Tailwind's
              // colour utilities; the `!` is what lets a segment be anything
              // other than muted.
              'hud-label px-3 py-2 whitespace-nowrap transition-colors',
              'border-l border-edge first:border-l-0',
              value === filter
                // `.emit` draws its ring outside the box, so the active segment
                // is lifted above its neighbours to keep the bloom unclipped.
                ? 'emit relative z-10 bg-raised text-highlight'
                : 'text-muted hover:text-system',
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
