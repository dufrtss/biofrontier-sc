'use client'

import { useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import type { TaxonFilter } from '@/lib/types'
import { useBiofrontierData } from '@/hooks/useBiofrontierData'
import GapMap from '@/features/map/GapMap'
import FrontierRanking from '@/features/ranking/FrontierRanking'
import TaxonSelector from '@/features/controls/TaxonSelector'
import HexDetail from '@/features/detail/HexDetail'
import DataSummaryBar from '@/features/controls/DataSummaryBar'
import MethodologyPanel from '@/features/methodology/MethodologyPanel'
import LocaleSwitcher from '@/features/controls/LocaleSwitcher'
import ExportButton from '@/features/export/ExportButton'

/** Hexbins shown in the ranking sidebar, and the default CSV export scope. */
const RANKING_LIMIT = 20

export default function AppShell() {
  const t = useTranslations('AppShell')
  const [taxonFilter, setTaxonFilter] = useState<TaxonFilter>('all')
  const {
    hexbins, rankedHexIds, selectedHexId, loading, error,
    lastUpdated, speciesCount, speciesDataIsPartial, habitatIsPlaceholder, sources,
    activeComponents, availableFilters, selectHex,
  } = useBiofrontierData(taxonFilter)

  const [rankingOpen, setRankingOpen]               = useState(false)
  const [methodologyOpen, setMethodologyOpen]       = useState(false)
  const [methodologySection, setMethodologySection] = useState<string | undefined>()

  const openMethodology = useCallback((sectionId?: string) => {
    setMethodologySection(sectionId)
    setMethodologyOpen(true)
  }, [])

  const selectedHex = selectedHexId ? hexbins[selectedHexId] ?? null : null

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 bg-slate-950">
        <div className="w-6 h-6 rounded-full border-2 border-slate-700 border-t-emerald-500 animate-spin" />
        <p className="text-slate-500 text-sm tracking-widest uppercase font-condensed">
          {t('loadingData')}
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 bg-slate-950">
        <p className="text-red-400 text-sm font-condensed tracking-wide uppercase">{t('errorLoading')}</p>
        <p className="text-slate-500 text-xs">{error}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <header className="relative flex items-center justify-between px-3 py-2 sm:px-5 sm:py-3 bg-slate-900 border-b border-slate-700/60 shrink-0 z-10">
        <div>
          <h1 className="text-base font-bold text-white tracking-tight font-condensed uppercase leading-none">
            BioFrontier SC
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 hidden sm:block">
            {t('tagline')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <TaxonSelector
            value={taxonFilter}
            options={availableFilters}
            onChange={setTaxonFilter}
            onOpenMethodology={openMethodology}
          />
          <button
            onClick={() => openMethodology()}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors hidden md:block"
          >
            {t('howItWorks')}
          </button>
        </div>
      </header>

      {/* Data summary bar */}
      <DataSummaryBar
        speciesCount={speciesCount}
        frontierCount={rankedHexIds.length}
        lastUpdated={lastUpdated}
        speciesDataIsPartial={speciesDataIsPartial}
        sources={sources}
        onOpenMethodology={openMethodology}
      />

      {/* Body: sidebar + map + detail */}
      <div className="flex flex-1 overflow-hidden">
        <aside
          className={[
            'bg-slate-900 border-r border-slate-700/60 overflow-hidden',
            rankingOpen
              ? 'fixed inset-0 z-[1500] flex flex-col sm:relative sm:flex sm:shrink-0 sm:w-80 sm:opacity-100'
              : 'hidden sm:flex sm:flex-col sm:w-0 sm:opacity-0 sm:pointer-events-none sm:overflow-hidden',
          ].join(' ')}
        >
          <div className="flex-1 min-h-0">
            <FrontierRanking
              rankedHexIds={rankedHexIds}
              hexbins={hexbins}
              taxonFilter={taxonFilter}
              selectedHexId={selectedHexId}
              onSelect={(hexId) => { selectHex(hexId); setRankingOpen(false) }}
              onOpenMethodology={openMethodology}
              onClose={() => setRankingOpen(false)}
              limit={RANKING_LIMIT}
            />
          </div>
          <ExportButton
            rankedHexIds={rankedHexIds}
            hexbins={hexbins}
            taxonFilter={taxonFilter}
            visibleCount={RANKING_LIMIT}
            activeComponents={activeComponents}
            generatedAt={lastUpdated}
            sources={sources.map(s => s.id)}
          />
        </aside>

        <main className="flex-1 relative overflow-hidden">
          <GapMap
            hexbins={hexbins}
            selectedHexId={selectedHexId}
            onHexSelect={selectHex}
            onOpenMethodology={openMethodology}
          />
          <button
            onClick={() => setRankingOpen(o => !o)}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-[1000] h-10 w-5 flex items-center justify-center bg-slate-800/90 hover:bg-slate-700 border border-slate-700 rounded text-slate-400 hover:text-slate-200 transition-colors"
            aria-label={rankingOpen ? 'Hide ranking panel' : 'Show ranking panel'}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              {rankingOpen
                ? <><polyline points="7,2 3,5 7,8" /></>
                : <><polyline points="3,2 7,5 3,8" /></>
              }
            </svg>
          </button>
        </main>

        <aside
          className={[
            'bg-slate-900 border-l border-slate-700 overflow-hidden',
            selectedHex
              ? 'fixed inset-0 z-[1500] sm:relative sm:flex sm:shrink-0 sm:w-80 sm:opacity-100'
              : 'hidden sm:block sm:w-0 sm:opacity-0 sm:pointer-events-none sm:overflow-hidden',
          ].join(' ')}
        >
          <HexDetail
            hex={selectedHex}
            taxonFilter={taxonFilter}
            habitatIsPlaceholder={habitatIsPlaceholder}
            onClose={() => selectHex(null)}
            onOpenMethodology={openMethodology}
          />
        </aside>
      </div>

      {/* Footer — locale switcher + donate */}
      <footer className="shrink-0 flex items-center justify-between px-4 py-2 bg-slate-900 border-t border-slate-700/60">
        <LocaleSwitcher />
        <a
          href="https://www.paypal.com/donate/?cmd=_donations&business=eduardofragadefreitas@gmail.com&item_name=BioFrontier%20SC&currency_code=BRL"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          ♥ Donate
        </a>
      </footer>

      {/* Methodology panel */}
      <MethodologyPanel
        open={methodologyOpen}
        initialSection={methodologySection}
        onClose={() => setMethodologyOpen(false)}
      />
    </div>
  )
}
