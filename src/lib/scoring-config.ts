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
 * Not every component is necessarily in play. `resolveActiveComponents` decides
 * — once per dataset, never per hexbin — which of `habitat` and
 * `incompleteness` are usable, and `computeFrontierScore` renormalises the
 * active weights to sum to 1. A component absent from the data therefore
 * neither contributes a constant offset nor drags scores toward zero.
 *
 * The per-dataset scope is essential: deciding per hexbin would rank hexbins
 * scored by different formulas against each other. See `scoring.ts`.
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
 *
 * ## Tuning: measured, don't guess
 *
 * A sweep over the production dataset (68,911 occurrences, 2,451 ranked
 * hexbins, GBIF + iNaturalist, 2026-08-23) found a strict monotonic trade-off
 * between coverage and discriminating power. Every relaxation that buys
 * coverage flattens the distribution:
 *
 *   radius  minSp  prevalence | coverage | median  IQR
 *   ------------------------------------------------------
 *      3      5       0.3     |    4.9%  |  0.842  0.500
 *      2      5       0.3     |    9.5%  |  0.875  0.400   ← current
 *      2      3       0.3     |   15.9%  |  0.878  0.368
 *      2      5       0.2     |   31.7%  |  0.968  0.200
 *      2      3       0.2     |   43.9%  |  1.000  0.167
 *
 * No setting reaches the full coverage `resolveActiveComponents` requires
 * before the component may enter the ranking, and the settings that come
 * closest are precisely the ones whose median saturates at 1.0 — i.e. that
 * measure nothing. The binding constraint is occurrence density in SC, not
 * parameter choice, so tuning cannot rescue this. Denser data or a genuinely
 * effort-corrected estimator (Chao1-style) are the real paths forward.
 *
 * The current values are the best discrimination available at non-trivial
 * coverage. Note that `minNeighboursWithData` at 2 vs 3 changes nothing:
 * `minExpectedSpecies` binds first.
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
   *
   * It reduces saturation rather than curing it — see the "not yet a solved
   * problem" note in `incompleteness.ts`. Raising this value tightens the
   * filter but shrinks coverage further; both matter, because
   * `resolveActiveComponents` requires full coverage of the ranked set before
   * the component may enter the score at all.
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
