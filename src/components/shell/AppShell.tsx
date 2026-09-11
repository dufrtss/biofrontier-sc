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
import DonateModal from '@/features/donate/DonateModal'
import { useCommunitySubmissions } from '@/hooks/useCommunitySubmissions'

/** Hexbins shown in the ranking sidebar, and the default CSV export scope. */
const RANKING_LIMIT = 20

export default function AppShell() {
  const t = useTranslations('AppShell')
  const [taxonFilter, setTaxonFilter] = useState<TaxonFilter>('all')
  const {
    hexbins, rankedHexIds, selectedHexId, loading, error,
    lastUpdated, speciesCount, speciesDataIsPartial, habitatIsPlaceholder, sources,
    activeComponents, availableFilters, gbifKeyByName, selectHex,
  } = useBiofrontierData(taxonFilter)

  // Approved community records. Held here rather than inside GapMap so that a
  // submission or vote made in HexDetail can refresh the map layer.
  const { submissions: communitySubmissions, refresh: refreshCommunity } = useCommunitySubmissions()

  const [rankingOpen, setRankingOpen]               = useState(false)
  const [methodologyOpen, setMethodologyOpen]       = useState(false)
  const [methodologySection, setMethodologySection] = useState<string | undefined>()
  const [donateOpen, setDonateOpen]                 = useState(false)

  const openMethodology = useCallback((sectionId?: string) => {
    setMethodologySection(sectionId)
    setMethodologyOpen(true)
  }, [])

  const selectedHex = selectedHexId ? hexbins[selectedHexId] ?? null : null

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 bg-background">
        {/* Genuinely a circle, so `rounded-full` stays. The leading arc was a
            raw emerald that belongs to no family here; the live-state cyan is
            what the rest of the app uses to say "working". */}
        <div className="w-6 h-6 rounded-full border-2 border-line border-t-system animate-spin" />
        <p className="hud-label">
          {t('loadingData')}
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 bg-background">
        <p className="hud-label text-danger">{t('errorLoading')}</p>
        <p className="text-muted text-xs">{error}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      {/* Chrome is drawn with lines, not with slabs: on an OLED panel a
          near-black grey bar across the top is a visible grey bar, while true
          black plus one hairline is an edge between lit and unlit. */}
      <header className="relative flex items-center justify-between px-3 py-2 sm:px-5 sm:py-3 bg-background border-b border-edge shrink-0 z-10">
        <div>
          {/* The identity reads as a designation rather than a brand: tight
              tracking, and the suffix carried in the cyan the app speaks in. */}
          <h1 className="text-base font-bold text-primary tracking-[-0.02em] uppercase leading-none">
            BioFrontier{' '}
            <span className="text-brand">SC</span>
          </h1>
          <p className="text-xs text-muted mt-0.5 hidden sm:block">
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
            className="hud-label hover:text-system transition-colors hidden md:block"
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
            'bg-background border-r border-edge overflow-hidden',
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
            communitySubmissions={communitySubmissions}
          />
          {/* A machined tab, not a button: no fill to speak of, a hairline that
              brightens under the cursor, and the arrow carrying the cyan. Taller
              and narrower than before so it reads as a latch on the panel edge
              rather than a control floating over the map. */}
          <button
            onClick={() => setRankingOpen(o => !o)}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-[1000] h-12 w-4 flex items-center justify-center bg-background/90 border border-edge hover:border-line-loud text-muted hover:text-system transition-colors"
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
            'bg-background border-l border-edge overflow-hidden',
            selectedHex
              ? 'fixed inset-0 z-[1500] sm:relative sm:flex sm:shrink-0 sm:w-80 sm:opacity-100'
              : 'hidden sm:block sm:w-0 sm:opacity-0 sm:pointer-events-none sm:overflow-hidden',
          ].join(' ')}
        >
          <HexDetail
            hex={selectedHex}
            taxonFilter={taxonFilter}
            gbifKeyByName={gbifKeyByName}
            habitatIsPlaceholder={habitatIsPlaceholder}
            onClose={() => selectHex(null)}
            onOpenMethodology={openMethodology}
            onCommunityChange={refreshCommunity}
          />
        </aside>
      </div>

      {/* Footer — locale switcher + donate */}
      <footer className="shrink-0 flex items-center justify-between px-4 py-2 bg-background border-t border-edge">
        <LocaleSwitcher />
        <button
          onClick={() => setDonateOpen(true)}
          className="hud-label hover:text-system transition-colors"
        >
          {t('donate')}
        </button>
      </footer>

      <DonateModal open={donateOpen} onClose={() => setDonateOpen(false)} />

      {/* Methodology panel */}
      <MethodologyPanel
        open={methodologyOpen}
        initialSection={methodologySection}
        onClose={() => setMethodologyOpen(false)}
      />
    </div>
  )
}
