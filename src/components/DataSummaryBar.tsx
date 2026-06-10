'use client'

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
  const date = lastUpdated
    ? new Date(lastUpdated).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : null

  return (
    <div className="flex items-center gap-x-4 px-5 py-1.5 bg-slate-950 border-b border-slate-800 text-xs text-slate-500 tabular-nums shrink-0 flex-wrap gap-y-1">
      {/* Species count */}
      <span className="flex items-center">
        <span className="text-slate-400 font-medium">≥ {speciesCount.toLocaleString()}</span>
        &nbsp;species recorded
        <InfoTooltip
          content="Lower-bound count of unique species names across all hexbins. The topSpecies list is capped at 10 per hexbin, so the true number is higher."
          learnMore={{ sectionId: 'taxa-coverage' }}
          onLearnMore={onOpenMethodology}
        />
      </span>

      <span className="text-slate-700">·</span>

      {/* Data source */}
      <span className="flex items-center">
        Source:&nbsp;<span className="text-slate-400 font-medium">GBIF</span>
        <InfoTooltip
          content="All occurrence records come from GBIF (Global Biodiversity Information Facility), aggregating data from museums, herbaria, iNaturalist, and research institutions worldwide."
          learnMore={{ sectionId: 'data-source' }}
          onLearnMore={onOpenMethodology}
        />
        {date && <span className="ml-1 hidden sm:inline">· fetched {date}</span>}
      </span>

      <span className="text-slate-700">·</span>

      {/* Frontier count */}
      <span className="flex items-center">
        <span className="text-slate-400 font-medium">{frontierCount.toLocaleString()}</span>
        &nbsp;frontier locations ranked
        <InfoTooltip
          content="Surveyed hexbins with at least one GBIF occurrence record, ranked by Frontier Score. The remaining hexbins are shown as unmapped territory on the map."
          learnMore={{ sectionId: 'geographic-scope' }}
          onLearnMore={onOpenMethodology}
        />
      </span>
    </div>
  )
}
