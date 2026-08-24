/**
 * Taxonomic incompleteness scoring — the third component of the frontier score.
 *
 * ## The question this answers
 *
 * Survey effort tells you how hard people have looked. Habitat quality tells
 * you whether there is anywhere for species to hide. Neither tells you what is
 * *missing*. This model does, by comparison: of the species recorded in
 * ecologically similar nearby hexbins, what fraction has never been recorded
 * here?
 *
 * A high value has two possible readings — the species are genuinely absent, or
 * nobody has looked. On its own the model cannot distinguish them, which is
 * exactly why it is one weighted component of a composite score rather than a
 * standalone ranking: paired with a high survey gap, "nobody has looked"
 * becomes the more likely explanation.
 *
 * ## Departure from the original design spec
 *
 * The spec defined the expected pool as the plain union of neighbour species.
 * Measured against real Santa Catarina data that saturates: the union across
 * ~18 neighbours runs to hundreds of species, so essentially every hexbin is
 * missing nearly all of it and the median score comes out at 1.000 — a metric
 * with no discriminating power, which would have contributed noise to the
 * frontier score while looking authoritative.
 *
 * Instead a species must be recorded in at least `minNeighbourPrevalence` of
 * the qualifying neighbours before it is expected here. That asks the more
 * useful question: "what is consistently found around here but absent from
 * this cell?"
 *
 * ## This is not yet a solved problem
 *
 * The prevalence threshold reduces saturation but does not eliminate it at
 * current data density: on the datasets measured so far the median remains at
 * or near 1.0, and the metric is computable for only a small minority of ranked
 * hexbins. Two structural reasons:
 *
 * - `requiredNeighbours` bottoms out at 2, so with the minimum of three
 *   qualifying neighbours the filter is only "2 of 3" — barely a filter.
 * - Occurrence data for SC is sparse enough that most neighbourhoods cannot
 *   clear the thresholds at all.
 *
 * This is why `resolveActiveComponents` admits the component into the composite
 * score only when it is computable for every ranked hexbin — which, today, it
 * is not. Until then it is displayed as a per-hexbin diagnostic and kept out of
 * the ranking. Denser data, or a genuinely effort-corrected estimator
 * (Chao1-style) rather than a raw ratio, are the paths to making it usable.
 *
 * ## Known limitations
 *
 * - Habitat quality is the only ecological similarity axis available per
 *   hexbin. The design spec also calls for elevation and distance-from-coast,
 *   which would substantially sharpen the neighbourhood definition.
 * - Species pools come from the same occurrence records the effort score is
 *   built on, so both inherit the same collection biases.
 * - The model is undefined near the edges of the data — hexbins without enough
 *   qualifying neighbours return null rather than a fabricated number.
 */

import { hexNeighbours } from './h3-utils'
import { INCOMPLETENESS_CONFIG } from './scoring-config'

export interface IncompletenessInput {
  hexId: string
  /** Indices into the global species index. Empty for unsurveyed hexbins. */
  speciesIds: number[]
  habitatQuality: number
  /** Whether this hexbin has any occurrence records for the active taxon filter. */
  hasData: boolean
}

export type IncompletenessConfig = typeof INCOMPLETENESS_CONFIG

export interface IncompletenessResult {
  /** Fraction of the expected species pool never recorded here, or null if not computable. */
  score: number | null
  /** Size of the expected-species pool drawn from qualifying neighbours. */
  expectedSpeciesCount: number
  /** How many expected species have no record in this hexbin. */
  missingSpeciesCount: number
  /** Qualifying neighbours that contributed to the pool. */
  neighboursUsed: number
}

const NOT_COMPUTABLE = (neighboursUsed: number, expectedSpeciesCount = 0): IncompletenessResult => ({
  score: null,
  expectedSpeciesCount,
  missingSpeciesCount: 0,
  neighboursUsed,
})

/**
 * Computes incompleteness for every hexbin in `hexes`.
 *
 * Returned as a Map keyed by hexId so callers can join it back onto their own
 * records without depending on array ordering.
 *
 * Note that unsurveyed hexbins *do* receive a score: a hexbin with no records
 * surrounded by well-sampled ecologically similar neighbours is maximally
 * incomplete (1.0), which is both correct and the single most interesting
 * signal this tool produces.
 */
export function computeIncompleteness(
  hexes: IncompletenessInput[],
  config: IncompletenessConfig = INCOMPLETENESS_CONFIG,
): Map<string, IncompletenessResult> {
  const byId = new Map(hexes.map(h => [h.hexId, h]))
  const speciesSets = new Map<string, Set<number>>(
    hexes.map(h => [h.hexId, new Set(h.speciesIds)]),
  )

  const results = new Map<string, IncompletenessResult>()

  for (const hex of hexes) {
    const neighbourIds = hexNeighbours(hex.hexId, config.neighbourRadius)

    // A neighbour qualifies if it is inside our grid, contributes at least one
    // species-level identification, and is ecologically comparable on the one
    // axis we can measure.
    //
    // The species requirement is stricter than `hasData` on purpose. A hexbin
    // can hold occurrence records while identifying none of them to species —
    // common for iNaturalist, where anything coarser than species rank is
    // recorded with no species name. Such a neighbour contributes nothing to
    // the expected pool, but counting it would still raise the prevalence
    // denominator and make real species harder to qualify.
    const qualifying = neighbourIds
      .map(id => byId.get(id))
      .filter((n): n is IncompletenessInput =>
        n !== undefined &&
        n.hasData &&
        n.speciesIds.length > 0 &&
        Math.abs(n.habitatQuality - hex.habitatQuality) <= config.habitatSimilarityTolerance,
      )

    if (qualifying.length < config.minNeighboursWithData) {
      results.set(hex.hexId, NOT_COMPUTABLE(qualifying.length))
      continue
    }

    // A species is "expected" only if a meaningful share of the comparable
    // neighbours record it — see the prevalence note in the module header.
    const neighbourCounts = new Map<number, number>()
    for (const neighbour of qualifying) {
      const set = speciesSets.get(neighbour.hexId)
      if (!set) continue
      for (const id of set) {
        neighbourCounts.set(id, (neighbourCounts.get(id) ?? 0) + 1)
      }
    }

    const requiredNeighbours = Math.max(
      2,
      Math.ceil(qualifying.length * config.minNeighbourPrevalence),
    )

    const expected = new Set<number>()
    for (const [id, count] of neighbourCounts) {
      if (count >= requiredNeighbours) expected.add(id)
    }

    if (expected.size < config.minExpectedSpecies) {
      results.set(hex.hexId, NOT_COMPUTABLE(qualifying.length, expected.size))
      continue
    }

    const observed = speciesSets.get(hex.hexId) ?? new Set<number>()
    let missing = 0
    for (const id of expected) if (!observed.has(id)) missing++

    results.set(hex.hexId, {
      score: missing / expected.size,
      expectedSpeciesCount: expected.size,
      missingSpeciesCount: missing,
      neighboursUsed: qualifying.length,
    })
  }

  return results
}
