'use client'

import { useTranslations } from 'next-intl'
import type { SourceMeta } from '@/lib/types'
import InfoTooltip from '@/components/ui/InfoTooltip'

interface DataSummaryBarProps {
  speciesCount: number
  frontierCount: number
  lastUpdated: string | null
  /** True when the dataset predates the species index — see `hexbins-file.ts`. */
  speciesDataIsPartial: boolean
  /** Sources that produced the dataset. Empty for pre-provenance (v1) files. */
  sources: SourceMeta[]
  onOpenMethodology: (sectionId: string) => void
}

/** Display names for source ids. */
const SOURCE_LABELS: Record<string, string> = {
  gbif: 'GBIF',
  inaturalist: 'iNaturalist',
  specieslink: 'speciesLink',
}

export default function DataSummaryBar({
  speciesCount,
  frontierCount,
  lastUpdated,
  speciesDataIsPartial,
  sources,
  onOpenMethodology,
}: DataSummaryBarProps) {
  const t = useTranslations('DataSummaryBar')

  const date = lastUpdated
    ? new Date(lastUpdated).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' })
    : null

  // Pre-provenance datasets carry no source list; they were always GBIF-only.
  const sourceLabel = sources.length > 0
    ? sources.map(s => SOURCE_LABELS[s.id] ?? s.id).join(' + ')
    : 'GBIF'

  return (
    /* A telemetry strip, not a sentence: everything is mono and tracked, the
       measured figures sit at full brightness and the words around them stay
       down in the label register. The strip is true black against the map
       below it, so the only thing separating the two is a hairline. */
    <div
      className="flex items-center gap-x-4 px-5 py-1.5 bg-background border-b border-edge text-xs shrink-0 overflow-x-auto [&::-webkit-scrollbar]:hidden"
      style={{ scrollbarWidth: 'none' }}
    >
      <span className="flex items-center shrink-0">
        <span className="technical text-primary">
          {speciesDataIsPartial
            ? t('speciesRecordedPartial', { count: speciesCount.toLocaleString() })
            : t('speciesRecorded', { count: speciesCount.toLocaleString() })}
        </span>
        <InfoTooltip
          content={speciesDataIsPartial ? t('tooltipSpeciesPartial') : t('tooltipSpecies')}
          learnMore={{ sectionId: 'taxa-coverage' }}
          onLearnMore={onOpenMethodology}
        />
      </span>

      {/* A rule rather than a middot: the separators are structure, and a
          punctuation mark in a row of readings reads as another reading. */}
      <span aria-hidden="true" className="h-3 w-px bg-line shrink-0" />

      <span className="flex items-center shrink-0">
        <span className="hud-label">{sources.length > 1 ? t('sources') : t('source')}</span>
        <span className="technical text-primary ml-1.5">{sourceLabel}</span>
        <InfoTooltip
          content={t('tooltipSource')}
          learnMore={{ sectionId: 'data-source' }}
          onLearnMore={onOpenMethodology}
        />
        {date && <span className="hud-label ml-1.5 hidden sm:inline">{t('fetched', { date })}</span>}
      </span>

      <span aria-hidden="true" className="h-3 w-px bg-line shrink-0" />

      <span className="flex items-center shrink-0">
        <span className="technical text-primary">
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
