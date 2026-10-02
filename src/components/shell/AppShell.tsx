'use client'

import { useState, useCallback, useMemo } from 'react'
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
import SignedInModal from '@/features/community/SignedInModal'
import { shouldGreetOnArrival } from '@/features/community/greeting'
import { useCommunitySubmissions } from '@/hooks/useCommunitySubmissions'
import { useAuth } from '@/hooks/useAuth'
import ThemeToggle from '@/components/ui/ThemeToggle'
import Mark from '@/components/ui/Mark'
import { filterByEvidence } from '@/lib/evidence'
import { EVIDENCE_CONFIG } from '@/lib/scoring-config'

/** Hexbins shown in the ranking sidebar, and the default CSV export scope. */
const RANKING_LIMIT = 20

export default function AppShell() {
  const t = useTranslations('AppShell')
  const [taxonFilter, setTaxonFilter] = useState<TaxonFilter>('all')
  const {
    hexbins, rankedHexIds, selectedHexId, loading, error,
    lastUpdated, speciesCount, speciesDataIsPartial, habitatIsPlaceholder, sources,
    activeComponents, availableFilters, gbifKeyByName, selectHex, selectionRestored,
    arrivedWithHex,
  } = useBiofrontierData(taxonFilter)

  // Approved community records. Held here rather than inside GapMap so that a
  // submission or vote made in HexDetail can refresh the map layer.
  const { submissions: communitySubmissions, refresh: refreshCommunity } = useCommunitySubmissions()

  // Records a hexbin needs before the ranking lists it. The score puts the
  // thinnest evidence at the top by construction, so the default is not 1.
  // Applied to the list and the export only: the map, ranks and scores are the
  // same at every setting.
  const [minRecords, setMinRecords] = useState<number>(EVIDENCE_CONFIG.defaultMinRecords)
  const listedHexIds = useMemo(
    () => filterByEvidence(rankedHexIds, hexbins, taxonFilter, minRecords),
    [rankedHexIds, hexbins, taxonFilter, minRecords],
  )

  const [rankingOpen, setRankingOpen]               = useState(false)
  const [methodologyOpen, setMethodologyOpen]       = useState(false)
  const [methodologySection, setMethodologySection] = useState<string | undefined>()
  const [donateOpen, setDonateOpen]                 = useState(false)

  // Arriving from a magic link, with nothing to go back to.
  //
  // When the link carries a hexbin the reader is returned straight to it and
  // CommunityPanel scrolls the form into view: that is the good path, and a
  // dialog in front of it would cover the very thing it is pointing at. This is
  // the other case: a link requested with no hexbin selected, or opened on a
  // device that never had one. Then there is genuinely nowhere to land, and
  // saying what changed is better than a page that looks identical.
  //
  // The decision lives in `shouldGreetOnArrival` and turns on the URL as it
  // arrived, not on what is selected right now. It used to read live selection,
  // which meant any open detail panel suppressed the dialog and closing one
  // released it, so a dialog about having just signed in could arrive several
  // clicks into the session.
  //
  // `arrivedFromMagicLink` is read from the URL fragment at load rather than
  // from "is signed in", so it fires once on the return trip and never again on
  // an ordinary visit with a live session.
  const { user, arrivedFromMagicLink } = useAuth()
  const [signedInDismissed, setSignedInDismissed] = useState(false)

  const openMethodology = useCallback((sectionId?: string) => {
    setMethodologySection(sectionId)
    setMethodologyOpen(true)
  }, [])

  const selectedHex = selectedHexId ? hexbins[selectedHexId] ?? null : null

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 bg-slate-100">
        <div className="w-6 h-6 rounded-full border-2 border-slate-200 border-t-brand animate-spin" />
        <p className="text-slate-500 text-sm tracking-widest uppercase font-condensed">
          {t('loadingData')}
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 bg-slate-100">
        <p className="text-danger text-sm font-condensed tracking-wide uppercase">{t('errorLoading')}</p>
        <p className="text-slate-500 text-xs">{error}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      {/* Two rows below lg, one above. Six taxon filters do not fit beside the
          name on anything narrower, and sharing the row squeezed the name onto
          two lines and pushed the filters and their tooltip off the screen.
          The filters scroll sideways when even their own row is too short. */}
      <header className="relative flex flex-col gap-2 px-3 py-2 sm:px-5 sm:py-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6 bg-panel border-b border-slate-200 shrink-0 z-10">
        <div className="flex items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Decorative here: the <h1> beside it already says the name, and a
                second announcement would just make a screen reader read it
                twice. The mark carries its own label in the favicon, where there
                is no text next to it. */}
            <Mark size={26} className="shrink-0" />
            <div className="min-w-0">
              <h1 className="text-base font-bold text-slate-900 tracking-tight font-condensed uppercase leading-none whitespace-nowrap">
                BioFrontier SC
              </h1>
              <p className="text-xs text-slate-500 mt-0.5 hidden sm:block truncate">
                {t('tagline')}
              </p>
            </div>
          </div>
          <button
            onClick={() => openMethodology()}
            className="text-xs text-slate-500 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 lg:hidden"
          >
            {t('howItWorks')}
          </button>
        </div>
        <div className="flex items-center gap-3 min-w-0">
          <TaxonSelector
            value={taxonFilter}
            options={availableFilters}
            onChange={setTaxonFilter}
            onOpenMethodology={openMethodology}
          />
          <button
            onClick={() => openMethodology()}
            className="text-xs text-slate-500 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 hidden lg:block"
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
            'bg-panel border-r border-slate-200 overflow-hidden',
            rankingOpen
              ? 'fixed inset-0 z-[1500] flex flex-col sm:relative sm:flex sm:shrink-0 sm:w-80 sm:opacity-100'
              : 'hidden sm:flex sm:flex-col sm:w-0 sm:opacity-0 sm:pointer-events-none sm:overflow-hidden',
          ].join(' ')}
        >
          <div className="flex-1 min-h-0">
            <FrontierRanking
              rankedHexIds={listedHexIds}
              totalRankedCount={rankedHexIds.length}
              hexbins={hexbins}
              taxonFilter={taxonFilter}
              selectedHexId={selectedHexId}
              onSelect={(hexId) => { selectHex(hexId); setRankingOpen(false) }}
              onOpenMethodology={openMethodology}
              onClose={() => setRankingOpen(false)}
              limit={RANKING_LIMIT}
              minRecords={minRecords}
              onMinRecordsChange={setMinRecords}
            />
          </div>
          <ExportButton
            rankedHexIds={listedHexIds}
            hexbins={hexbins}
            taxonFilter={taxonFilter}
            visibleCount={RANKING_LIMIT}
            activeComponents={activeComponents}
            generatedAt={lastUpdated}
            sources={sources.map(s => s.id)}
            minRecords={minRecords}
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
          <button
            onClick={() => setRankingOpen(o => !o)}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-[1000] h-10 w-5 flex items-center justify-center bg-panel/95 hover:bg-slate-100 border border-slate-200 rounded text-slate-500 hover:text-slate-800 transition-colors"
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
            'bg-panel border-l border-slate-200 overflow-hidden',
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

      {/* Footer: locale switcher + theme + donate */}
      <footer className="shrink-0 flex items-center justify-between px-4 py-2 bg-panel border-t border-slate-200">
        <LocaleSwitcher />
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <button
            onClick={() => setDonateOpen(true)}
            className="text-xs text-slate-500 hover:text-slate-900 transition-colors"
          >
            {t('donate')}
          </button>
        </div>
      </footer>

      <DonateModal open={donateOpen} onClose={() => setDonateOpen(false)} />

      <SignedInModal
        open={shouldGreetOnArrival({
          arrivedFromMagicLink,
          hasUser: !!user,
          dismissed: signedInDismissed,
          selectionRestored,
          arrivedWithHex,
        })}
        onClose={() => setSignedInDismissed(true)}
        onShowRanking={() => setRankingOpen(true)}
      />

      {/* Methodology panel */}
      <MethodologyPanel
        open={methodologyOpen}
        initialSection={methodologySection}
        onClose={() => setMethodologyOpen(false)}
      />
    </div>
  )
}
