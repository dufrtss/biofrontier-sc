/**
 * Single source of truth for every tunable weight in the scoring pipeline.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THESE WEIGHTS ARE A PROVISIONAL HYPOTHESIS, NOT A CALIBRATED MODEL.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * They were chosen from first principles during the original design and have
 * never been validated against expert biological intuition. The domain expert
 * originally attached to this project is no longer involved, so calibration is
 * currently an open question — see the "Orphaned Task" note in
 * `.claude/initiatives/active/biofrontier-sc.md`.
 *
 * Until then the honest position, surfaced to users in the methodology panel,
 * is: the *relative ranking* of hexbins is more trustworthy than any absolute
 * score, and both are a starting point for fieldwork planning rather than a
 * conclusion.
 *
 * To recalibrate: change the numbers here and nothing else. Every consumer
 * reads from this module, and `assertWeightsSumToOne` catches typos at import
 * time. `npm run test` covers the invariants.
 */

/** Weights for the survey-effort sub-score. Must sum to 1. */
export interface EffortWeights {
  /** Distinct collectors/observers — the strongest single signal of real survey attention. */
  observers: number
  /** Distinct survey dates — separates one big expedition from sustained coverage. */
  dates: number
  /** Records per km² — raw sampling intensity. */
  density: number
  /** Years between first and last record — detects historical-only or one-off sampling. */
  span: number
}

/** Weights for the composite frontier score. Must sum to 1. */
export interface FrontierWeights {
  /** Survey gap (1 − effort). How under-sampled the hexbin is. */
  gap: number
  /** Atlantic Forest remnant coverage. Habitat capable of holding undescribed species. */
  habitat: number
  /**
   * Taxonomic incompleteness. Species present in ecologically similar
   * neighbours but never recorded here.
   */
  incompleteness: number
}

export const EFFORT_WEIGHTS: EffortWeights = {
  observers: 0.30,
  dates:     0.30,
  density:   0.25,
  span:      0.15,
}

/**
 * Full three-component formula from the design spec.
 *
 * When a hexbin has no computable incompleteness value (too few ecologically
 * similar neighbours with data), `computeFrontierScore` renormalises `gap` and
 * `habitat` to sum to 1 rather than silently treating incompleteness as zero —
 * which would penalise data-poor hexbins for being data-poor, the exact
 * opposite of what this tool is meant to surface.
 */
export const FRONTIER_WEIGHTS: FrontierWeights = {
  gap:            0.40,
  habitat:        0.35,
  incompleteness: 0.25,
}

/**
 * Parameters for the taxonomic incompleteness model.
 *
 * The model asks: of the species recorded in ecologically similar nearby
 * hexbins, what fraction has never been recorded here? A high value means the
 * neighbourhood is known to hold species this hexbin has no record of — either
 * they are genuinely absent, or nobody has looked. Combined with a high survey
 * gap, the second explanation becomes the likely one.
 */
export const INCOMPLETENESS_CONFIG = {
  /**
   * H3 grid-disk radius used to collect neighbours. At resolution 6 (~36 km²
   * per cell, ~6.3 km edge) a radius of 2 reaches roughly 20–25 km — far enough
   * to gather a meaningful species pool, close enough that shared species are
   * biologically plausible.
   */
  neighbourRadius: 2,

  /**
   * Maximum absolute difference in habitat quality for a neighbour to count as
   * "ecologically similar". Habitat quality is the only ecological axis
   * currently available per hexbin; the design spec also calls for elevation
   * and distance-from-coast, which would sharpen this considerably.
   */
  habitatSimilarityTolerance: 0.35,

  /**
   * Minimum number of qualifying neighbours with recorded species before a
   * score is emitted. Below this the expected-species pool is too small to
   * distinguish a real gap from sampling noise, and the function returns null.
   */
  minNeighboursWithData: 3,

  /**
   * Minimum size of the expected-species pool before a score is emitted.
   * Guards against a handful of neighbour records producing a confident-looking
   * 0% or 100%.
   */
  minExpectedSpecies: 5,

  /**
   * Fraction of qualifying neighbours that must record a species before it
   * counts as "expected" here.
   *
   * This threshold is what keeps the metric from saturating. The original
   * design spec defined the expected pool as the plain union of neighbour
   * species, which in practice makes almost every hexbin score ~1.0: with ~18
   * neighbours holding tens to hundreds of species each, the union is enormous,
   * and any individual hexbin is missing nearly all of it. Measured against
   * real SC data that formulation produced a median of 1.000 — no discriminating
   * power at all.
   *
   * Requiring a species to appear in a meaningful share of comparable
   * neighbours before expecting it here is also the better biological question:
   * "what is consistently found around here but never recorded in this cell?"
   * rather than "what has ever been seen anywhere nearby?".
   */
  minNeighbourPrevalence: 0.3,
} as const

/**
 * Fails fast at import time if a weight set has been edited into an invalid
 * state. Cheap insurance: a typo here silently skews every ranking in the app
 * and would be very hard to spot from the UI.
 */
function assertWeightsSumToOne(name: string, weights: object): void {
  const sum = Object.values(weights).reduce((a: number, b: number) => a + b, 0)
  if (Math.abs(sum - 1) > 1e-9) {
    throw new Error(
      `${name} must sum to 1, got ${sum}. Check src/lib/scoring-config.ts.`,
    )
  }
}

assertWeightsSumToOne('EFFORT_WEIGHTS', EFFORT_WEIGHTS)
assertWeightsSumToOne('FRONTIER_WEIGHTS', FRONTIER_WEIGHTS)
