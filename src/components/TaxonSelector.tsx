'use client'

import { useTranslations } from 'next-intl'
import type { TaxonFilter } from '@/lib/types'
import InfoTooltip from './InfoTooltip'

interface Props {
  value: TaxonFilter
  onChange: (v: TaxonFilter) => void
  onOpenMethodology: (sectionId: string) => void
}

export default function TaxonSelector({ value, onChange, onOpenMethodology }: Props) {
  const t = useTranslations('TaxonSelector')

  const OPTIONS: { value: TaxonFilter; label: string }[] = [
    { value: 'all',         label: t('allTaxa')      },
    { value: 'vertebrates', label: t('vertebrates')  },
  ]

  const tooltips: Record<TaxonFilter, string> = {
    all:         t('tooltipAll'),
    vertebrates: t('tooltipVertebrates'),
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1 bg-[--surface-raised] rounded-full p-1">
        {OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={[
              'px-4 py-1.5 rounded-full text-sm font-medium transition-colors',
              value === opt.value
                ? 'bg-[--accent-blue] text-[--bg] shadow'
                : 'text-[--text-muted] hover:text-[--text-primary]',
            ].join(' ')}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <InfoTooltip
        content={tooltips[value]}
        learnMore={{ sectionId: 'taxa-coverage' }}
        onLearnMore={onOpenMethodology}
        align="right"
      />
    </div>
  )
}
