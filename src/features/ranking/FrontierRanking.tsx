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
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <div className="px-4 py-3 border-b border-edge">
        <div className="flex items-center">
          {onClose && (
            <button
              onClick={onClose}
              className="sm:hidden mr-3 text-secondary hover:text-system transition-colors text-base leading-none"
              aria-label="Close ranking panel"
              type="button"
            >
              ←
            </button>
          )}
          {/* Panel title in the label register rather than at heading size: on a
              readout the hierarchy is carried by brightness, not by point size,
              so the title is the bright line and the subtitle the dim one. */}
          <h2 className="hud-label text-primary">
            {t('title', { limit })}
          </h2>
          <InfoTooltip
            content={t('tooltipRanking')}
            learnMore={{ sectionId: 'frontier-score' }}
            onLearnMore={onOpenMethodology}
          />
        </div>
        <p className="text-[11px] text-muted mt-1">{t('subtitle')}</p>
      </div>

      <ul className="flex-1 overflow-y-auto divide-y divide-line [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
        {topIds.map(hexId => {
          const hex = hexbins[hexId]
          if (!hex) return null
          const isSelected = hexId === selectedHexId
          const color = scoreToColor(hex.frontierScore)
          const pct = (hex.frontierScore * 100).toFixed(0)
          const td  = taxonDataFor(hex, taxonFilter)

          return (
            <li key={hexId}>
              {/* Selection is a lit cyan edge with a bloom, not a lighter fill.
                  On a true-black ground a filled row reads as a grey slab; an
                  emitting edge reads as the row being switched on. The edge is
                  always present and merely transparent when unselected, so
                  selecting a row never shifts its text sideways. */}
              <button
                onClick={() => onSelect(hexId)}
                className={[
                  'group w-full text-left px-4 py-3 border-l-2 transition-colors',
                  isSelected
                    ? 'border-system emit-soft'
                    : 'border-transparent hover:border-edge',
                ].join(' ')}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="technical text-2xl font-bold leading-none" style={{ color }}>
                    {hex.rank}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className={[
                      'technical text-xs truncate transition-colors',
                      isSelected ? 'text-system' : 'text-secondary group-hover:text-system',
                    ].join(' ')}>
                      {formatCoords(hexId)}
                    </div>
                    {/* Square ends, hairline track: a capsule-shaped meter is
                        consumer chrome and this is a gauge. */}
                    <div className="mt-1.5 h-1.5 bg-background border border-line overflow-hidden">
                      <div className="h-full transition-all" style={{ width: `${pct}%`, background: color }} />
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
