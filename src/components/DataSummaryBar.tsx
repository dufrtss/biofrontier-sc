'use client'

import { useTranslations } from 'next-intl'
import InfoTooltip from './InfoTooltip'

interface DataSummaryBarProps {
  speciesCount: number
  frontierCount: number
  lastUpdated: string | null
  onOpenMethodology: (sectionId: string) => void
}

export default function DataSummaryBar({
  speciesCount,
  frontierCount,
  lastUpdated,
  onOpenMethodology,
}: DataSummaryBarProps) {
  const t = useTranslations('DataSummaryBar')

  const date = lastUpdated
    ? new Date(lastUpdated).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' })
    : null

  return (
    <div className="flex items-center gap-x-4 px-5 py-1.5 bg-[--bg] border-b border-[--border]/60 text-xs text-[--text-muted] tabular-nums shrink-0 flex-wrap gap-y-1">
      <span className="flex items-center">
        <span className="text-[--text-secondary] font-medium">
          {t('speciesRecorded', { count: speciesCount.toLocaleString() })}
        </span>
        <InfoTooltip
          content={t('tooltipSpecies')}
          learnMore={{ sectionId: 'taxa-coverage' }}
          onLearnMore={onOpenMethodology}
        />
      </span>

      <span className="text-[--border-bright]">·</span>

      <span className="flex items-center">
        {t('source')}&nbsp;<span className="text-[--text-secondary] font-medium">GBIF</span>
        <InfoTooltip
          content={t('tooltipSource')}
          learnMore={{ sectionId: 'data-source' }}
          onLearnMore={onOpenMethodology}
        />
        {date && <span className="ml-1 hidden sm:inline">{t('fetched', { date })}</span>}
      </span>

      <span className="text-[--border-bright]">·</span>

      <span className="flex items-center">
        <span className="text-[--text-secondary] font-medium">
          {t('frontierLocationsRanked', { count: frontierCount.toLocaleString() })}
        </span>
        <InfoTooltip
          content={t('tooltipFrontier')}
          learnMore={{ sectionId: 'geographic-scope' }}
          onLearnMore={onOpenMethodology}
        />
      </span>
    </div>
  )
}
