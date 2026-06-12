'use client'

import { useTranslations } from 'next-intl'
import type { ScoredHexbin } from '@/lib/types'
import { scoreToColor } from '@/lib/color'
import { hexCenter } from '@/lib/h3-utils'
import InfoTooltip from './InfoTooltip'

interface Props {
  rankedHexIds: string[]
  hexbins: Record<string, ScoredHexbin>
  selectedHexId: string | null
  onSelect: (hexId: string) => void
  onOpenMethodology: (sectionId: string) => void
  limit?: number
}

function formatCoords(hexId: string): string {
  const [lat, lng] = hexCenter(hexId)
  return `${Math.abs(lat).toFixed(2)}°S, ${Math.abs(lng).toFixed(2)}°W`
}

export default function FrontierRanking({ rankedHexIds, hexbins, selectedHexId, onSelect, onOpenMethodology, limit = 20 }: Props) {
  const t = useTranslations('FrontierRanking')
  const topIds = rankedHexIds.slice(0, limit)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-[--border]/60">
        <div className="flex items-center">
          <h2 className="text-sm font-semibold text-[--text-primary] uppercase tracking-wider">
            {t('title', { limit })}
          </h2>
          <InfoTooltip
            content={t('tooltipRanking')}
            learnMore={{ sectionId: 'frontier-score' }}
            onLearnMore={onOpenMethodology}
          />
        </div>
        <p className="text-xs text-[--text-muted] mt-0.5">{t('subtitle')}</p>
      </div>

      <ul className="flex-1 overflow-y-auto divide-y divide-[--border]/40">
        {topIds.map(hexId => {
          const hex = hexbins[hexId]
          if (!hex) return null
          const isSelected = hexId === selectedHexId
          const color = scoreToColor(hex.frontierScore)
          const pct = (hex.frontierScore * 100).toFixed(0)
          const td  = hex.all

          return (
            <li key={hexId}>
              <button
                onClick={() => onSelect(hexId)}
                className={[
                  'w-full text-left px-4 py-3 transition-colors hover:bg-[--hover-bg]',
                  isSelected ? 'bg-[--hover-bg-strong] border-l-2 border-[--accent-blue]' : '',
                ].join(' ')}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-2xl font-bold leading-none" style={{ color }}>
                    {hex.rank}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-[--text-secondary] truncate">{formatCoords(hexId)}</div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-[--track] overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                    </div>
                    <div className="flex justify-between mt-1 text-xs text-[--text-muted]">
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
