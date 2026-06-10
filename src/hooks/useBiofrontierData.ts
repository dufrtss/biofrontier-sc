// src/hooks/useBiofrontierData.ts
'use client'

import { useState, useEffect, useMemo } from 'react'
import type { HexbinsFile, ScoredHexbin, AppState, TaxonFilter } from '@/lib/types'
import { computeEffortScores, computeFrontierScore } from '@/lib/scoring'
import { H3_RES6_AREA_KM2 } from '@/lib/h3-utils'

export function useBiofrontierData(taxonFilter: TaxonFilter): AppState & {
  selectHex: (hexId: string | null) => void
} {
  const [raw, setRaw]               = useState<HexbinsFile | null>(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [selectedHexId, setSelected] = useState<string | null>(null)

  useEffect(() => {
    fetch('/data/hexbins.json')
      .then(r => {
        if (!r.ok) throw new Error(`hexbins.json returned ${r.status}`)
        return r.json() as Promise<HexbinsFile>
      })
      .then(data => { setRaw(data); setLoading(false) })
      .catch(err  => { setError(err.message); setLoading(false) })
  }, [])

  const { hexbins, rankedHexIds } = useMemo(() => {
    if (!raw) return { hexbins: {} as Record<string, ScoredHexbin>, rankedHexIds: [] }

    const effortInputs = raw.hexbins.map(h => {
      const td = taxonFilter === 'vertebrates' ? h.vertebrates : h.all
      return {
        uniqueObserverCount: td.uniqueObserverCount,
        uniqueDateCount:     td.uniqueDateCount,
        recordDensity:       td.occurrenceCount / H3_RES6_AREA_KM2,
        temporalSpanYears:   td.temporalSpanYears,
      }
    })

    const effortScores = computeEffortScores(effortInputs)

    const scored: ScoredHexbin[] = raw.hexbins.map((hex, i) => ({
      ...hex,
      effortScore:    effortScores[i],
      frontierScore:  computeFrontierScore(effortScores[i], hex.habitatQuality),
      rank:           0,  // assigned below
    }))

    const sorted = [...scored].sort((a, b) => b.frontierScore - a.frontierScore)
    sorted.forEach((h, idx) => { h.rank = idx + 1 })

    return {
      hexbins:      Object.fromEntries(scored.map(h => [h.hexId, h])),
      rankedHexIds: sorted.map(h => h.hexId),
    }
  }, [raw, taxonFilter])

  return {
    hexbins,
    rankedHexIds,
    selectedHexId,
    taxonFilter,
    loading,
    error,
    lastUpdated: raw?.generatedAt ?? null,
    selectHex: setSelected,
  }
}
