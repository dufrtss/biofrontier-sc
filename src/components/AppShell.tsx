'use client'

import { useState } from 'react'
import type { TaxonFilter } from '@/lib/types'
import { useBiofrontierData } from '@/hooks/useBiofrontierData'
import GapMap from './GapMap/GapMap'
import FrontierRanking from './FrontierRanking'
import TaxonSelector from './TaxonSelector'
import HexDetail from './HexDetail'

export default function AppShell() {
  const [taxonFilter, setTaxonFilter] = useState<TaxonFilter>('all')
  const { hexbins, rankedHexIds, selectedHexId, loading, error, lastUpdated, selectHex } =
    useBiofrontierData(taxonFilter)

  const selectedHex = selectedHexId ? hexbins[selectedHexId] ?? null : null

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 bg-slate-950">
        <div className="w-6 h-6 rounded-full border-2 border-slate-700 border-t-emerald-500 animate-spin" />
        <p className="text-slate-500 text-sm tracking-widest uppercase font-condensed">
          Loading biodiversity data
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 bg-slate-950">
        <p className="text-red-400 text-sm font-condensed tracking-wide uppercase">
          Error loading data
        </p>
        <p className="text-slate-600 text-xs">{error}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar — thin emerald accent line signals the Atlantic Forest theme */}
      <header className="relative flex items-center justify-between px-5 py-3 bg-slate-900 border-b border-slate-700/60 shrink-0 z-10">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-emerald-600/60 via-emerald-500/40 to-transparent" />
        <div>
          <h1 className="text-base font-bold text-white tracking-tight font-condensed uppercase leading-none">
            BioFrontier SC
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Frontier intelligence · Santa Catarina · Atlantic Forest
          </p>
        </div>
        <div className="flex items-center gap-4">
          <TaxonSelector value={taxonFilter} onChange={setTaxonFilter} />
          {lastUpdated && (
            <span className="text-xs text-slate-600 hidden md:block tabular-nums">
              Data: {new Date(lastUpdated).toLocaleDateString('pt-BR')}
            </span>
          )}
        </div>
      </header>

      {/* Body: sidebar + map + detail */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <aside className="w-80 shrink-0 bg-slate-900 border-r border-slate-700/60 overflow-hidden">
          <FrontierRanking
            rankedHexIds={rankedHexIds}
            hexbins={hexbins}
            selectedHexId={selectedHexId}
            onSelect={selectHex}
          />
        </aside>

        {/* Map */}
        <main className="flex-1 relative overflow-hidden">
          <GapMap
            hexbins={hexbins}
            selectedHexId={selectedHexId}
            onHexSelect={selectHex}
          />
        </main>

        {/* Right detail drawer — slides in when a hex is selected */}
        <aside
          className={[
            'shrink-0 bg-slate-900 border-l border-slate-700/60 overflow-hidden transition-all duration-200',
            selectedHex ? 'w-80 opacity-100' : 'w-0 opacity-0 pointer-events-none',
          ].join(' ')}
        >
          <HexDetail
            hex={selectedHex}
            taxonFilter={taxonFilter}
            onClose={() => selectHex(null)}
          />
        </aside>
      </div>
    </div>
  )
}
