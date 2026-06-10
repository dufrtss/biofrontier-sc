'use client'

import type { TaxonFilter } from '@/lib/types'
import InfoTooltip from './InfoTooltip'

interface Props {
  value: TaxonFilter
  onChange: (v: TaxonFilter) => void
  onOpenMethodology: (sectionId: string) => void
}

const TOOLTIPS: Record<TaxonFilter, string> = {
  all: 'Every organism recorded in GBIF for SC — plants, fungi, animals (vertebrates & invertebrates), bacteria, protozoa, and more. A plant appearing in the species list is expected behaviour.',
  vertebrates: 'Animals with a backbone only: Mammals, Birds, Reptiles, Amphibians, and Fish (Actinopterygii). Invertebrates and all non-animal kingdoms excluded.',
}

const OPTIONS: { value: TaxonFilter; label: string }[] = [
  { value: 'all',         label: 'All Taxa'    },
  { value: 'vertebrates', label: 'Vertebrates' },
]

export default function TaxonSelector({ value, onChange, onOpenMethodology }: Props) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1 bg-slate-800 rounded-full p-1">
        {OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={[
              'px-4 py-1.5 rounded-full text-sm font-medium transition-colors',
              value === opt.value
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200',
            ].join(' ')}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <InfoTooltip
        content={TOOLTIPS[value]}
        learnMore={{ sectionId: 'taxa-coverage' }}
        onLearnMore={onOpenMethodology}
        align="right"
      />
    </div>
  )
}
