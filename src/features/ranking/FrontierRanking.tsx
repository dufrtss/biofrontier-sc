'use client'

import { useTranslations } from 'next-intl'
import type { ScoredHexbin, TaxonFilter } from '@/lib/types'
import { scoreToColor } from '@/lib/color'
import { hexCenter } from '@/lib/h3-utils'
import { taxonDataFor } from '@/lib/hexbins-file'
import InfoTooltip from '@/components/ui/InfoTooltip'

interface Props {
  rankedHexIds: string[]
  hexbins: Record<string, ScoredHexbin>
  /**
   * The ranking itself is computed per filter, so the record count shown
   * alongside each rank has to come from the same filter — quoting the
   * all-taxa total next to a birds-only ranking invites the reader to
   * attribute one to the other.
   */
  taxonFilter: TaxonFilter
  selectedHexId: string | null
  onSelect: (hexId: string) => void
  onOpenMethodology: (sectionId: string) => void
  onClose?: () => void
  limit?: number
}

function formatCoords(hexId: string): string {
  const [lat, lng] = hexCenter(hexId)
  return `${Math.abs(lat).toFixed(2)}°S, ${Math.abs(lng).toFixed(2)}°W`
}

export default function FrontierRanking({ rankedHexIds, hexbins, taxonFilter, selectedHexId, onSelect, onOpenMethodology, onClose, limit = 20 }: Props) {
  const t = useTranslations('FrontierRanking')
  const topIds = rankedHexIds.slice(0, limit)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-line/60">
        <div className="flex items-center">
          {onClose && (
            <button
              onClick={onClose}
              className="sm:hidden mr-3 text-secondary hover:text-primary transition-colors text-base leading-none"
              aria-label="Close ranking panel"
              type="button"
            >
              ←
            </button>
          )}
          <h2 className="text-sm font-semibold text-primary uppercase tracking-wider">
            {t('title', { limit })}
          </h2>
          <InfoTooltip
            content={t('tooltipRanking')}
            learnMore={{ sectionId: 'frontier-score' }}
            onLearnMore={onOpenMethodology}
          />
        </div>
        <p className="text-xs text-muted mt-0.5">{t('subtitle')}</p>
      </div>

      <ul className="flex-1 overflow-y-auto divide-y divide-slate-700/40 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
        {topIds.map(hexId => {
          const hex = hexbins[hexId]
          if (!hex) return null
          const isSelected = hexId === selectedHexId
          const color = scoreToColor(hex.frontierScore)
          const pct = (hex.frontierScore * 100).toFixed(0)
          const td  = taxonDataFor(hex, taxonFilter)

          return (
            <li key={hexId}>
              <button
                onClick={() => onSelect(hexId)}
                className={[
                  'w-full text-left px-4 py-3 transition-colors hover:bg-line/50',
                  isSelected ? 'bg-line/80 border-l-2 border-brand' : '',
                ].join(' ')}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="technical text-2xl font-bold leading-none" style={{ color }}>
                    {hex.rank}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="technical text-xs text-secondary truncate">{formatCoords(hexId)}</div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-line overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                    </div>
                    <div className="technical flex justify-between mt-1 text-xs text-muted">
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
