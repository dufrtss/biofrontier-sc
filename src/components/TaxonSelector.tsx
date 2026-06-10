'use client'

import type { TaxonFilter } from '@/lib/types'

interface Props {
  value: TaxonFilter
  onChange: (v: TaxonFilter) => void
}

const OPTIONS: { value: TaxonFilter; label: string }[] = [
  { value: 'all',         label: 'All Taxa'    },
  { value: 'vertebrates', label: 'Vertebrates' },
]

export default function TaxonSelector({ value, onChange }: Props) {
  return (
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
  )
}
