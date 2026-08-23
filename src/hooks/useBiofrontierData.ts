'use client'

import { useState, useEffect, useMemo } from 'react'
import type {
  HexbinsFile,
  NormalizedHexbinsFile,
  ScoredHexbin,
  AppState,
  TaxonFilter,
} from '@/lib/types'
import { computeEffortScores, computeFrontierScore } from '@/lib/scoring'
import { computeIncompleteness } from '@/lib/incompleteness'
import { normalizeHexbinsFile } from '@/lib/hexbins-file'
import { H3_RES6_AREA_KM2 } from '@/lib/h3-utils'

export function useBiofrontierData(taxonFilter: TaxonFilter): AppState & {
  selectHex: (hexId: string | null) => void
} {
  const [raw, setRaw]                = useState<NormalizedHexbinsFile | null>(null)
  const [loading, setLoading]        = useState(true)
  const [error, setError]            = useState<string | null>(null)
  const [selectedHexId, setSelected] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/data/hexbins.json', { signal: controller.signal })
      .then(r => {
        if (!r.ok) throw new Error(`hexbins.json returned ${r.status}`)
        return r.json() as Promise<HexbinsFile>
      })
      .then(data => { setRaw(normalizeHexbinsFile(data)); setLoading(false) })
      .catch(err  => {
        if (err.name === 'AbortError') return
        setError(err.message); setLoading(false)
      })
    return () => controller.abort()
  }, [])

  const { hexbins, rankedHexIds } = useMemo(() => {
    if (!raw) return { hexbins: {} as Record<string, ScoredHexbin>, rankedHexIds: [] }

    const taxonDataFor = (hex: (typeof raw.hexbins)[number]) =>
      taxonFilter === 'vertebrates' ? hex.vertebrates : hex.all

    const effortInputs = raw.hexbins.map(h => {
      const td = taxonDataFor(h)
      return {
        uniqueObserverCount: td.uniqueObserverCount,
        uniqueDateCount:     td.uniqueDateCount,
        recordDensity:       td.occurrenceCount / H3_RES6_AREA_KM2,
        temporalSpanYears:   td.temporalSpanYears,
      }
    })

    const effortScores = computeEffortScores(effortInputs)

    // Incompleteness depends on the active taxon filter: the expected-species
    // pool for "vertebrates" must be built from vertebrate records only.
    //
    // Skipped entirely on a partial (v1) dataset. There each hexbin knows only
    // its top 10 species while the neighbourhood pool is the union of many such
    // lists, so the ratio saturates near 1.0 for every hexbin — including the
    // best-surveyed ones — and carries no discriminating signal. Scoring on a
    // saturated metric would be worse than not scoring on it at all, so the
    // component is dropped and the remaining weights renormalise.
    const incompleteness = raw.speciesDataIsPartial
      ? new Map<string, never>()
      : computeIncompleteness(
        raw.hexbins.map(h => {
          const td = taxonDataFor(h)
          return {
            hexId:          h.hexId,
            speciesIds:     td.speciesIds ?? [],
            habitatQuality: h.habitatQuality,
            hasData:        td.occurrenceCount > 0,
          }
        }),
      )

    const scored: ScoredHexbin[] = raw.hexbins.map((hex, i) => {
      const inc = incompleteness.get(hex.hexId)
      return {
        ...hex,
        effortScore:             effortScores[i],
        taxonomicIncompleteness: inc?.score ?? null,
        expectedSpeciesCount:    inc?.expectedSpeciesCount ?? 0,
        missingSpeciesCount:     inc?.missingSpeciesCount ?? 0,
        frontierScore:           computeFrontierScore({
          effortScore:             effortScores[i],
          // A uniform placeholder cannot discriminate between hexbins, so it is
          // dropped from the score rather than added as a constant offset.
          habitatQuality:          raw.habitatIsPlaceholder ? null : hex.habitatQuality,
          taxonomicIncompleteness: inc?.score ?? null,
        }),
        rank: 0,  // assigned below
      }
    })

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

  // With a v2 file this is the true count; with a v1 file the species index was
  // rebuilt from top-10 lists, so it is a lower bound.
  const speciesCount = raw?.speciesIndex.length ?? 0

  return {
    hexbins,
    rankedHexIds,
    selectedHexId,
    taxonFilter,
    loading,
    error,
    lastUpdated: raw?.generatedAt ?? null,
    speciesCount,
    sources: raw?.sources ?? [],
    speciesDataIsPartial: raw?.speciesDataIsPartial ?? false,
    habitatIsPlaceholder: raw?.habitatIsPlaceholder ?? false,
    selectHex: setSelected,
  }
}
