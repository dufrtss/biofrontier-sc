'use client'

import { useTranslations } from 'next-intl'
import type { ScoredHexbin, TaxonFilter } from '@/lib/types'
import { scoreToColor, scoreToInk } from '@/lib/color'
import { useTheme } from '@/hooks/useTheme'
import { hexCenter } from '@/lib/h3-utils'
import { taxonDataFor } from '@/lib/hexbins-file'
import InfoTooltip from '@/components/ui/InfoTooltip'
import EvidenceBadge from '@/components/ui/EvidenceBadge'
import { evidenceLevel } from '@/lib/evidence'
import { EVIDENCE_CONFIG } from '@/lib/scoring-config'

interface Props {
  /** Ranked ids already filtered to `minRecords`, in ranking order. */
  rankedHexIds: string[]
  /** Ranked hexbins before the minimum-records filter, for the count line. */
  totalRankedCount: number
  hexbins: Record<string, ScoredHexbin>
  /**
   * The ranking itself is computed per filter, so the record count shown
   * alongside each rank has to come from the same filter, quoting the
   * all-taxa total next to a birds-only ranking invites the reader to
   * attribute one to the other.
   */
  taxonFilter: TaxonFilter
  selectedHexId: string | null
  onSelect: (hexId: string) => void
  onOpenMethodology: (sectionId: string) => void
  onClose?: () => void
  limit?: number
  /** Records a hexbin needs to be listed. 1 lists every ranked hexbin. */
  minRecords: number
  onMinRecordsChange: (min: number) => void
}

function formatCoords(hexId: string): string {
  const [lat, lng] = hexCenter(hexId)
  return `${Math.abs(lat).toFixed(2)}°S, ${Math.abs(lng).toFixed(2)}°W`
}

export default function FrontierRanking({
  rankedHexIds, totalRankedCount, hexbins, taxonFilter, selectedHexId,
  onSelect, onOpenMethodology, onClose, limit = 20, minRecords, onMinRecordsChange,
}: Props) {
  const { theme } = useTheme()
  const t = useTranslations('FrontierRanking')
  const topIds = rankedHexIds.slice(0, limit)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200">
        <div className="flex items-center">
          {onClose && (
            <button
              onClick={onClose}
              className="sm:hidden mr-3 text-slate-500 hover:text-slate-800 transition-colors text-base leading-none"
              aria-label="Close ranking panel"
              type="button"
            >
              ←
            </button>
          )}
          <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">
            {t('title', { limit })}
          </h2>
          <InfoTooltip
            content={t('tooltipRanking')}
            learnMore={{ sectionId: 'frontier-score' }}
            onLearnMore={onOpenMethodology}
          />
        </div>
        <p className="text-xs text-slate-500 mt-0.5">{t('subtitle')}</p>

        {/* The minimum sits above the list it filters, with the count it leaves
            in view, so the threshold is never applied silently. */}
        <div className="mt-2.5 flex items-center gap-2">
          <span className="text-xs text-slate-600 whitespace-nowrap">{t('minRecordsLabel')}</span>
          <div
            role="radiogroup"
            aria-label={t('minRecordsLabel')}
            className="flex gap-1 bg-slate-100 rounded-full p-0.5"
          >
            {EVIDENCE_CONFIG.minRecordOptions.map(min => (
              <button
                key={min}
                type="button"
                role="radio"
                aria-checked={minRecords === min}
                onClick={() => onMinRecordsChange(min)}
                className={[
                  'px-2.5 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap',
                  minRecords === min
                    ? 'bg-brand-solid text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900',
                ].join(' ')}
              >
                {min === 1 ? t('minRecordsAll') : t('minRecordsOption', { min })}
              </button>
            ))}
          </div>
          <InfoTooltip
            content={t('tooltipMinRecords')}
            learnMore={{ sectionId: 'evidence' }}
            onLearnMore={onOpenMethodology}
            align="right"
          />
        </div>
        <p className="text-[11px] text-slate-500 mt-1.5">
          {minRecords > 1
            ? t('shownOfTotal', { shown: rankedHexIds.length, total: totalRankedCount, min: minRecords })
            : t('shownAll', { total: totalRankedCount })}
        </p>
      </div>

      {topIds.length === 0 && (
        <p className="px-4 py-6 text-xs text-slate-500 leading-relaxed">
          {t('emptyFiltered', { min: minRecords })}
        </p>
      )}

      <ul className="flex-1 overflow-y-auto divide-y divide-slate-200 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
        {topIds.map(hexId => {
          const hex = hexbins[hexId]
          if (!hex) return null
          const isSelected = hexId === selectedHexId
          // Two colours for one score: the bar is an area and takes the fill
          // ramp, the rank number is type and takes the ink ramp. They were one
          // value here, which put a fill colour on a letterform, #105e00 on a
          // dark panel measures 2.13:1.
          const barColor  = scoreToColor(hex.frontierScore, theme)
          const rankColor = scoreToInk(hex.frontierScore, theme)
          const pct = (hex.frontierScore * 100).toFixed(0)
          const td  = taxonDataFor(hex, taxonFilter)
          const level = evidenceLevel(td.occurrenceCount)

          return (
            <li key={hexId}>
              <button
                onClick={() => onSelect(hexId)}
                className={[
                  'w-full text-left px-4 py-3 transition-colors hover:bg-slate-100/50',
                  isSelected ? 'bg-slate-100 border-l-2 border-brand' : '',
                ].join(' ')}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-2xl font-bold leading-none" style={{ color: rankColor }}>
                    {hex.rank}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-600 truncate">{formatCoords(hexId)}</span>
                      <EvidenceBadge level={level} className="shrink-0" />
                    </div>
                    {/* A weak-evidence bar is drawn faded: the length is the
                        score, the fade is how little stands behind it. */}
                    <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: barColor, opacity: level === 'weak' ? 0.45 : 1 }}
                      />
                    </div>
                    <div className="flex justify-between mt-1 text-xs text-slate-600">
                      <span>{t('frontierPct', { pct })}</span>
                      <span>{t('recordsCount', { count: td.occurrenceCount })}</span>
                    </div>
                  </div>
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
