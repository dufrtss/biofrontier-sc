'use client'

import { useState, useEffect, useMemo } from 'react'
import type {
  HexbinsFile,
  NormalizedHexbinsFile,
  ScoredHexbin,
  AppState,
  TaxonFilter,
} from '@/lib/types'
import { computeEffortScores, computeFrontierScore, resolveActiveComponents } from '@/lib/scoring'
import { computeIncompleteness } from '@/lib/incompleteness'
import { normalizeHexbinsFile, taxonDataFor } from '@/lib/hexbins-file'
import { H3_RES6_AREA_KM2 } from '@/lib/h3-utils'

/** Shared so a dataset without GBIF keys still returns a stable reference. */
const NO_GBIF_KEYS: Map<string, number> = new Map()

/** Query parameter carrying the selected hexbin across a sign-in round trip. */
const HEX_PARAM = 'hex'

export function useBiofrontierData(taxonFilter: TaxonFilter): AppState & {
  selectHex: (hexId: string | null) => void
  /** True once the `?hex=` in the URL has been read and acted on. */
  selectionRestored: boolean
} {
  const [raw, setRaw]                = useState<NormalizedHexbinsFile | null>(null)
  const [loading, setLoading]        = useState(true)
  const [error, setError]            = useState<string | null>(null)
  const [selectedHexId, setSelected] = useState<string | null>(null)
  const [selectionRestored, setSelectionRestored] = useState(false)

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

  const { hexbins, rankedHexIds, activeComponents, speciesCount } = useMemo(() => {
    if (!raw) return {
      hexbins: {} as Record<string, ScoredHexbin>,
      rankedHexIds: [] as string[],
      activeComponents: { habitat: false, incompleteness: false },
      speciesCount: 0,
    }

    const effortInputs = raw.hexbins.map(h => {
      const td = taxonDataFor(h, taxonFilter)
      return {
        uniqueObserverCount: td.uniqueObserverCount,
        uniqueDateCount:     td.uniqueDateCount,
        recordDensity:       td.occurrenceCount / H3_RES6_AREA_KM2,
        temporalSpanYears:   td.temporalSpanYears,
      }
    })

    const effortScores = computeEffortScores(effortInputs)

    // Incompleteness depends on the active taxon filter: the expected-species
    // pool for "birds" must be built from bird records only.
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
          const td = taxonDataFor(h, taxonFilter)
          return {
            hexId:          h.hexId,
            speciesIds:     td.speciesIds ?? [],
            habitatQuality: h.habitatQuality,
            hasData:        td.occurrenceCount > 0,
          }
        }),
      )

    // Which hexbins are eligible for the ranking. Zero-record hexbins all score
    // identically, so including them would make the ranking meaningless.
    const isRanked = (hex: (typeof raw.hexbins)[number]) =>
      taxonDataFor(hex, taxonFilter).occurrenceCount > 0

    // Component availability is resolved once, over the ranked set, and applied
    // uniformly. Deciding per hexbin would place hexbins scored by different
    // formulas on a single list — see resolveActiveComponents.
    const rankedHexbins = raw.hexbins.filter(isRanked)
    const active = resolveActiveComponents({
      habitatVaries: !raw.habitatIsPlaceholder,
      incompletenessComputable: rankedHexbins.filter(
        h => incompleteness.get(h.hexId)?.score != null,
      ).length,
      rankedCount: rankedHexbins.length,
    })

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
          habitatQuality:          hex.habitatQuality,
          taxonomicIncompleteness: inc?.score ?? null,
        }, active),
        rank: 0,  // assigned below
      }
    })

    const surveyed = scored
      .filter(isRanked)
      .sort((a, b) => b.frontierScore - a.frontierScore)
    surveyed.forEach((h, idx) => { h.rank = idx + 1 })

    // Counted per filter rather than taken from the global species index: with
    // "Birds" selected, quoting the all-taxa total beside a bird ranking invites
    // the reader to attribute one to the other. For `all` this is the same
    // number the index carries, since every interned species came from a record
    // that also entered `all`.
    //
    // With a v2+ file this is the true count; with a v1 file the species sets
    // were rebuilt from top-10 lists, so it is a lower bound — which is what
    // `speciesDataIsPartial` tells the UI to say.
    const speciesSeen = new Set<number>()
    for (const hex of raw.hexbins) {
      for (const id of taxonDataFor(hex, taxonFilter).speciesIds ?? []) speciesSeen.add(id)
    }

    return {
      hexbins:      Object.fromEntries(scored.map(h => [h.hexId, h])),
      rankedHexIds: surveyed.map(h => h.hexId),
      activeComponents: active,
      speciesCount: speciesSeen.size,
    }
  }, [raw, taxonFilter])

  // ── The selected hexbin lives in the URL ───────────────────────────────
  //
  // Not for deep-linking's sake, though that is a nice side effect. A magic
  // link's `redirect_to` is built from the current URL, so anything not in the
  // URL is lost across the sign-in round trip — and what someone loses is
  // precisely the hexbin they were about to contribute to. The comment on
  // `redirectTarget` in useAuth claimed the link came back to the same hexbin;
  // it could not, because the selection was React state and nothing else.
  //
  // `replaceState` rather than `push`: selecting a cell is not a navigation,
  // and filling the back button with every hexbin someone clicked would make
  // leaving the page take twenty presses.
  useEffect(() => {
    if (typeof window === 'undefined' || !selectionRestored) return
    const url = new URL(window.location.href)
    if (selectedHexId) url.searchParams.set(HEX_PARAM, selectedHexId)
    else url.searchParams.delete(HEX_PARAM)
    window.history.replaceState(null, '', url.toString())
  }, [selectedHexId, selectionRestored])

  // Restore it once the data is in, so an unknown id can be discarded rather
  // than selecting a hexbin that does not exist.
  useEffect(() => {
    if (selectionRestored || loading) return
    const fromUrl = new URLSearchParams(window.location.search).get(HEX_PARAM)
    // Read from the URL in an effect, not a lazy initialiser: the server render
    // has no URL to read, so initialising from it would mismatch on hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (fromUrl && hexbins[fromUrl]) setSelected(fromUrl)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectionRestored(true)
  }, [loading, hexbins, selectionRestored])

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
    activeComponents,
    availableFilters: raw?.availableFilters ?? ['all'],
    gbifKeyByName: raw?.gbifKeyByName ?? NO_GBIF_KEYS,
    selectHex: setSelected,
    selectionRestored,
  }
}
