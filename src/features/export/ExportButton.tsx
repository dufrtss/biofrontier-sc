'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { ScoredHexbin, TaxonFilter } from '@/lib/types'
import { buildFrontierCsv, frontierCsvFilename } from '@/lib/csv'
import { downloadTextFile } from './download'

interface Props {
  rankedHexIds: string[]
  hexbins: Record<string, ScoredHexbin>
  taxonFilter: TaxonFilter
  /** How many hexbins the ranking panel is currently showing. */
  visibleCount: number
}

type Scope = 'visible' | 'all'

/**
 * Exports the current frontier ranking as CSV.
 *
 * Two scopes because they serve different needs: the visible top-N is what
 * someone screenshots into a fieldwork plan, while the full ranking is the
 * dataset you load into R or QGIS. Both honour the active taxon filter, so the
 * export always matches what is on screen.
 */
export default function ExportButton({ rankedHexIds, hexbins, taxonFilter, visibleCount }: Props) {
  const t = useTranslations('Export')
  const [open, setOpen] = useState(false)

  const totalCount = rankedHexIds.length
  const disabled = totalCount === 0

  const exportCsv = (scope: Scope) => {
    const csv = buildFrontierCsv(rankedHexIds, hexbins, {
      taxonFilter,
      limit: scope === 'visible' ? visibleCount : undefined,
    })
    downloadTextFile(frontierCsvFilename(taxonFilter), csv)
    setOpen(false)
  }

  return (
    <div className="relative border-t border-slate-700/60 shrink-0">
      {open && !disabled && (
        <>
          {/* Click-away layer. Sits below the menu but above the panel. */}
          <div
            className="fixed inset-0 z-[1600]"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            className="absolute bottom-full left-3 right-3 mb-1 z-[1601] rounded-lg overflow-hidden bg-slate-800 border border-slate-700 shadow-xl"
            role="menu"
          >
            <button
              onClick={() => exportCsv('visible')}
              className="w-full text-left px-3 py-2.5 text-xs text-slate-300 hover:bg-slate-700 transition-colors"
              role="menuitem"
              type="button"
            >
              <div className="font-medium">{t('scopeVisible', { count: Math.min(visibleCount, totalCount) })}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">{t('scopeVisibleHint')}</div>
            </button>
            <button
              onClick={() => exportCsv('all')}
              className="w-full text-left px-3 py-2.5 text-xs text-slate-300 hover:bg-slate-700 transition-colors border-t border-slate-700/60"
              role="menuitem"
              type="button"
            >
              <div className="font-medium">{t('scopeAll', { count: totalCount })}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">{t('scopeAllHint')}</div>
            </button>
          </div>
        </>
      )}

      <button
        onClick={() => setOpen(o => !o)}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="menu"
        type="button"
        className={[
          'w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium tracking-wide uppercase transition-colors',
          disabled
            ? 'text-slate-600 cursor-not-allowed'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800',
        ].join(' ')}
      >
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none"
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden
        >
          <path d="M6 1v7M3.5 5.5L6 8l2.5-2.5M1.5 9.5v1h9v-1" />
        </svg>
        {t('button')}
      </button>
    </div>
  )
}
