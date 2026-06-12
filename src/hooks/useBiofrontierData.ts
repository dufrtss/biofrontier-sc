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
    const controller = new AbortController()
    fetch('/data/hexbins.json', { signal: controller.signal })
      .then(r => {
        if (!r.ok) throw new Error(`hexbins.json returned ${r.status}`)
        return r.json() as Promise<HexbinsFile>
      })
      .then(data => { setRaw(data); setLoading(false) })
      .catch(err  => {
        if (err.name === 'AbortError') return
        setError(err.message); setLoading(false)
      })
    return () => controller.abort()
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

    // Only rank hexbins that have actual occurrence data for the active filter.
    // Zero-record hexbins all score identically with fallback habitat data, making
    // the ranking meaningless if they're included.
    const surveyed = scored
      .filter(h => (taxonFilter === 'vertebrates' ? h.vertebrates : h.all).occurrenceCount > 0)
      .sort((a, b) => b.frontierScore - a.frontierScore)
    surveyed.forEach((h, idx) => { h.rank = idx + 1 })

    return {
      hexbins:      Object.fromEntries(scored.map(h => [h.hexId, h])),
      rankedHexIds: surveyed.map(h => h.hexId),
    }
  }, [raw, taxonFilter])

  const speciesCount = useMemo(() => {
    if (!raw) return 0
    const names = new Set<string>()
    raw.hexbins.forEach(h => h.all.topSpecies.forEach(s => names.add(s.name)))
    return names.size
  }, [raw])

  return {
    hexbins,
    rankedHexIds,
    selectedHexId,
    taxonFilter,
    loading,
    error,
    lastUpdated: raw?.generatedAt ?? null,
    speciesCount,
    selectHex: setSelected,
  }
}
