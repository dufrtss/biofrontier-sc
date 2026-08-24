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
  /** Atlantic Forest remnant coverage. Ignored unless `habitat` is active. */
  habitatQuality: number
  /**
   * Fraction of the expected neighbourhood species pool never recorded here,
   * or `null` where not computable. Ignored unless `incompleteness` is active.
   */
  taxonomicIncompleteness: number | null
}

/**
 * Which optional components participate in scoring.
 *
 * **This is a dataset-wide decision, never a per-hexbin one.** See
 * `resolveActiveComponents` for why that distinction is load-bearing.
 */
export interface ActiveComponents {
  habitat: boolean
  incompleteness: boolean
}

export interface ComponentAvailability {
  /** False when every hexbin carries the same habitat value (the placeholder). */
  habitatVaries: boolean
  /** Ranked hexbins with a computable incompleteness value. */
  incompletenessComputable: number
  /** Total ranked hexbins. */
  rankedCount: number
}

/**
 * Decides which optional components may enter the composite score, for the
 * dataset as a whole.
 *
 * A component is admitted only when it is available for *every* ranked hexbin.
 *
 * This rule exists because of a subtle scoring bug. An earlier version dropped
 * unavailable components per hexbin and renormalised the remainder — which is
 * defensible for one hexbin in isolation, but invalid once the results are
 * merged into a single ranking: hexbins end up scored by different formulas and
 * placed on one list. Measured on real data, only 18 of 369 ranked hexbins had
 * a computable incompleteness value, and because that value saturates near 1.0
 * those 18 took ranks 1–5 — displacing hexbins that would otherwise sit at #19,
 * #37, #93, #179 and #223. The ranking was being driven by which hexbins
 * happened to clear the neighbour threshold, not by biology.
 *
 * All-or-nothing keeps every hexbin on one comparable scale. It is deliberately
 * strict: a component that cannot be computed everywhere is reported in the
 * detail panel as a diagnostic, but kept out of the number used to rank.
 */
export function resolveActiveComponents(
  { habitatVaries, incompletenessComputable, rankedCount }: ComponentAvailability,
): ActiveComponents {
  return {
    habitat: habitatVaries,
    incompleteness: rankedCount > 0 && incompletenessComputable === rankedCount,
  }
}

/**
 * Composite frontier score in [0, 1]. Higher = more promising as a discovery
 * frontier.
 *
 * `active` must be identical for every hexbin in a ranking — pass the single
 * result of `resolveActiveComponents`, never a per-hexbin decision.
 *
 * The survey gap is never optional: it derives from the occurrence data that
 * must exist for the hexbin to be scored at all.
 */
export function computeFrontierScore(
  { effortScore, habitatQuality, taxonomicIncompleteness }: FrontierInputs,
  active: ActiveComponents,
  weights: FrontierWeights = FRONTIER_WEIGHTS,
): number {
  let weightedSum  = (1 - effortScore) * weights.gap
  let activeWeight = weights.gap

  if (active.habitat) {
    weightedSum  += habitatQuality * weights.habitat
    activeWeight += weights.habitat
  }

  if (active.incompleteness) {
    // Guaranteed non-null by resolveActiveComponents, which only activates the
    // component when every ranked hexbin has a value. Coerced defensively so an
    // unranked hexbin cannot produce NaN and poison the ordering.
    weightedSum  += (taxonomicIncompleteness ?? 0) * weights.incompleteness
    activeWeight += weights.incompleteness
  }

  // Defensive: a caller could pass a weight set where every active weight is 0.
  if (activeWeight === 0) return 0

  return weightedSum / activeWeight
}
