'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { ScoredHexbin, TaxonFilter } from '@/lib/types'
import type { ActiveComponents } from '@/lib/scoring'
import { buildFrontierCsv, frontierCsvFilename } from '@/lib/csv'
import { downloadTextFile } from './download'

interface Props {
  rankedHexIds: string[]
  hexbins: Record<string, ScoredHexbin>
  taxonFilter: TaxonFilter
  /** How many hexbins the ranking panel is currently showing. */
  visibleCount: number
  /** Which components entered the score — recorded in the export header. */
  activeComponents: ActiveComponents
  /** Dataset timestamp, recorded in the export header. */
  generatedAt: string | null
  /** Source ids behind the dataset, recorded in the export header. */
  sources: string[]
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
export default function ExportButton({
  rankedHexIds, hexbins, taxonFilter, visibleCount,
  activeComponents, generatedAt, sources,
}: Props) {
  const t = useTranslations('Export')
  const [open, setOpen] = useState(false)

  const totalCount = rankedHexIds.length
  const disabled = totalCount === 0

  const exportCsv = (scope: Scope) => {
    const csv = buildFrontierCsv(rankedHexIds, hexbins, {
      taxonFilter,
      activeComponents,
      generatedAt,
      sources,
      limit: scope === 'visible' ? visibleCount : undefined,
    })
    downloadTextFile(frontierCsvFilename(taxonFilter), csv)
    setOpen(false)
  }

  return (
    <div className="relative border-t border-edge shrink-0">
      {open && !disabled && (
        <>
          {/* Click-away layer. Sits below the menu but above the panel. */}
          <div
            className="fixed inset-0 z-[1600]"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          {/* Flush to the trigger and outlined rather than shadowed: a drop
              shadow is invisible against true black, while a hairline plus a
              tight bloom reads as a panel that has been lit. */}
          <div
            className="absolute bottom-full left-0 right-0 z-[1601] overflow-hidden bg-raised border border-edge emit-soft"
            role="menu"
          >
            <button
              onClick={() => exportCsv('visible')}
              className="w-full text-left px-3 py-2.5 text-xs text-secondary hover:text-system transition-colors"
              role="menuitem"
              type="button"
            >
              <div className="font-medium">{t('scopeVisible', { count: Math.min(visibleCount, totalCount) })}</div>
              <div className="hud-label mt-1">{t('scopeVisibleHint')}</div>
            </button>
            <button
              onClick={() => exportCsv('all')}
              className="w-full text-left px-3 py-2.5 text-xs text-secondary hover:text-system transition-colors border-t border-edge"
              role="menuitem"
              type="button"
            >
              <div className="font-medium">{t('scopeAll', { count: totalCount })}</div>
              <div className="hud-label mt-1">{t('scopeAllHint')}</div>
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
          // The one primary action in the sidebar, so it is the one thing here
          // that spends a cut corner and the cyan. `.hud-label` is unlayered and
          // beats Tailwind's colour utilities, hence the `!`.
          'notch w-full flex items-center justify-center gap-2 px-4 py-3 hud-label transition-colors',
          disabled
            ? 'text-muted cursor-not-allowed'
            : 'bg-raised text-system hover:text-highlight',
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
