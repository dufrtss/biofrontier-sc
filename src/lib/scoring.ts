import {
  EFFORT_WEIGHTS,
  FRONTIER_WEIGHTS,
  type EffortWeights,
  type FrontierWeights,
} from './scoring-config'

export interface EffortInputs {
  uniqueObserverCount: number
  uniqueDateCount: number
  recordDensity: number       // occurrenceCount / hexbin area in km²
  temporalSpanYears: number
}

export function normalizeValues(values: number[]): number[] {
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (max === min) return values.map(() => 0)
  return values.map(v => (v - min) / (max - min))
}

export function computeEffortScores(
  hexbins: EffortInputs[],
  weights: EffortWeights = EFFORT_WEIGHTS,
): number[] {
  if (hexbins.length === 0) return []

  const observerNorm = normalizeValues(hexbins.map(h => h.uniqueObserverCount))
  const datesNorm    = normalizeValues(hexbins.map(h => h.uniqueDateCount))
  const densityNorm  = normalizeValues(hexbins.map(h => h.recordDensity))
  const spanNorm     = normalizeValues(hexbins.map(h => h.temporalSpanYears))

  return hexbins.map((_, i) =>
    observerNorm[i] * weights.observers +
    datesNorm[i]    * weights.dates +
    densityNorm[i]  * weights.density +
    spanNorm[i]     * weights.span
  )
}

export interface FrontierInputs {
  /** Always available — normalised across all hexbins. */
  effortScore: number
  /**
   * Atlantic Forest remnant coverage, or `null` when the dataset carries only
   * the uniform placeholder produced by `data:habitat-fallback`. A constant
   * cannot discriminate between hexbins, so scoring on it would inflate every
   * score by a fixed amount while contributing nothing to the ranking.
   */
  habitatQuality: number | null
  /**
   * Fraction of the expected neighbourhood species pool never recorded here.
   * `null` when the hexbin has too few ecologically similar neighbours with
   * data to compute a trustworthy value — see `computeIncompleteness`.
   */
  taxonomicIncompleteness: number | null
}

/**
 * Composite frontier score in [0, 1]. Higher = more promising as a discovery
 * frontier.
 *
 * Components that are unavailable for a given hexbin are dropped, and the
 * weights of the remaining components are renormalised to sum to 1.
 *
 * The alternative — treating a missing component as zero — would systematically
 * push data-poor hexbins down the ranking. But data-poor hexbins are precisely
 * what this tool exists to surface, so that failure mode would invert the
 * tool's purpose. Renormalising instead says "score this hexbin on what we
 * actually know about it", which is both the honest reading and the useful one.
 *
 * The survey gap is never optional: it is derived from the occurrence data that
 * must exist for the hexbin to be scored at all.
 */
export function computeFrontierScore(
  { effortScore, habitatQuality, taxonomicIncompleteness }: FrontierInputs,
  weights: FrontierWeights = FRONTIER_WEIGHTS,
): number {
  let weightedSum   = (1 - effortScore) * weights.gap
  let activeWeight  = weights.gap

  if (habitatQuality !== null) {
    weightedSum  += habitatQuality * weights.habitat
    activeWeight += weights.habitat
  }

  if (taxonomicIncompleteness !== null) {
    weightedSum  += taxonomicIncompleteness * weights.incompleteness
    activeWeight += weights.incompleteness
  }

  // Defensive: a caller could pass a weight set where every active weight is 0.
  if (activeWeight === 0) return 0

  return weightedSum / activeWeight
}
