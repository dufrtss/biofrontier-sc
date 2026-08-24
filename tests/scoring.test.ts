import { describe, it, expect } from 'vitest'
import {
  normalizeValues,
  computeEffortScores,
  computeFrontierScore,
  resolveActiveComponents,
} from '@/lib/scoring'
import { EFFORT_WEIGHTS, FRONTIER_WEIGHTS } from '@/lib/scoring-config'
import { scoreToColor, scoreToOpacity } from '@/lib/color'

describe('normalizeValues', () => {
  it('maps [0, 5, 10] to [0, 0.5, 1]', () => {
    expect(normalizeValues([0, 5, 10])).toEqual([0, 0.5, 1])
  })

  it('returns all zeros when every value is identical', () => {
    expect(normalizeValues([5, 5, 5])).toEqual([0, 0, 0])
  })

  it('handles a single value', () => {
    expect(normalizeValues([42])).toEqual([0])
  })
})

describe('computeEffortScores', () => {
  const low  = { uniqueObserverCount: 1,   uniqueDateCount: 1,  recordDensity: 0.01, temporalSpanYears: 0.5 }
  const high = { uniqueObserverCount: 100, uniqueDateCount: 60, recordDensity: 10,   temporalSpanYears: 25  }

  it('returns a higher score for the well-surveyed hexbin', () => {
    const [lowScore, highScore] = computeEffortScores([low, high])
    expect(highScore).toBeGreaterThan(lowScore)
  })

  it('all values are in [0, 1]', () => {
    computeEffortScores([low, high]).forEach(s => {
      expect(s).toBeGreaterThanOrEqual(0)
      expect(s).toBeLessThanOrEqual(1)
    })
  })

  it('returns [] for empty input', () => {
    expect(computeEffortScores([])).toEqual([])
  })

  it('returns [0] for a single hexbin (no variance to normalise)', () => {
    expect(computeEffortScores([high])).toEqual([0])
  })
})

describe('scoring weight configuration', () => {
  it('effort weights sum to 1', () => {
    const sum = Object.values(EFFORT_WEIGHTS).reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(1, 9)
  })

  it('frontier weights sum to 1', () => {
    const sum = Object.values(FRONTIER_WEIGHTS).reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(1, 9)
  })
})

describe('computeFrontierScore', () => {
  const ALL_ACTIVE = { habitat: true, incompleteness: true }
  const GAP_ONLY   = { habitat: false, incompleteness: false }
  const NO_HABITAT = { habitat: false, incompleteness: true }

  const score = (
    effortScore: number,
    habitatQuality: number,
    taxonomicIncompleteness: number | null = null,
    active = ALL_ACTIVE,
  ) => computeFrontierScore(
    { effortScore, habitatQuality, taxonomicIncompleteness }, active,
  )

  it('scores 1.0 for an unsurveyed hexbin with full habitat and full incompleteness', () => {
    expect(score(0, 1, 1)).toBeCloseTo(1.0, 5)
  })

  it('scores 0.0 for a fully-surveyed degraded hexbin with nothing missing', () => {
    expect(score(1, 0, 0)).toBeCloseTo(0.0, 5)
  })

  it('returns a value in [0, 1] for typical inputs', () => {
    for (const inc of [null, 0, 0.5, 1]) {
      const s = score(0.4, 0.7, inc)
      expect(s).toBeGreaterThanOrEqual(0)
      expect(s).toBeLessThanOrEqual(1)
    }
  })

  it('weights each component per FRONTIER_WEIGHTS', () => {
    expect(score(0, 0, 0)).toBeCloseTo(FRONTIER_WEIGHTS.gap, 6)
    expect(score(1, 1, 0)).toBeCloseTo(FRONTIER_WEIGHTS.habitat, 6)
    expect(score(1, 0, 1)).toBeCloseTo(FRONTIER_WEIGHTS.incompleteness, 6)
  })

  it('increases monotonically with incompleteness, all else equal', () => {
    expect(score(0.5, 0.5, 1)).toBeGreaterThan(score(0.5, 0.5, 0.5))
    expect(score(0.5, 0.5, 0.5)).toBeGreaterThan(score(0.5, 0.5, 0))
  })

  describe('with only the survey gap active', () => {
    it('spans [0, 1] on the gap alone', () => {
      expect(score(0, 0.5, 0.9, GAP_ONLY)).toBeCloseTo(1.0, 6)
      expect(score(1, 0.5, 0.9, GAP_ONLY)).toBeCloseTo(0.0, 6)
      expect(score(0.3, 0.5, 0.9, GAP_ONLY)).toBeCloseTo(0.7, 6)
    })

    it('ignores the values of inactive components entirely', () => {
      // A uniform habitat placeholder must not shift the score at all.
      expect(score(0.4, 0.0, null, GAP_ONLY))
        .toBeCloseTo(score(0.4, 1.0, 1, GAP_ONLY), 6)
    })
  })

  describe('with habitat inactive but incompleteness active', () => {
    it('still spans [0, 1] across the two active components', () => {
      expect(score(0, 0.5, 1, NO_HABITAT)).toBeCloseTo(1.0, 6)
      expect(score(1, 0.5, 0, NO_HABITAT)).toBeCloseTo(0.0, 6)
    })

    it('preserves the gap:incompleteness ratio after renormalising', () => {
      const ratio = FRONTIER_WEIGHTS.gap / FRONTIER_WEIGHTS.incompleteness
      expect(score(0, 0, 0, NO_HABITAT) / score(1, 0, 1, NO_HABITAT))
        .toBeCloseTo(ratio, 6)
    })
  })

  it('treats a null incompleteness as 0 rather than producing NaN', () => {
    // resolveActiveComponents prevents this combination for ranked hexbins, but
    // an unranked one must not poison the ordering with NaN.
    expect(Number.isNaN(score(0.5, 0.5, null, ALL_ACTIVE))).toBe(false)
  })

  it('accepts injected weights for calibration experiments', () => {
    const gapOnly = { gap: 1, habitat: 0, incompleteness: 0 }
    expect(
      computeFrontierScore(
        { effortScore: 0.25, habitatQuality: 1, taxonomicIncompleteness: 1 },
        ALL_ACTIVE,
        gapOnly,
      ),
    ).toBeCloseTo(0.75, 6)
  })
})

describe('resolveActiveComponents', () => {
  it('activates habitat only when it varies between hexbins', () => {
    expect(resolveActiveComponents({
      habitatVaries: true, incompletenessComputable: 0, rankedCount: 10,
    }).habitat).toBe(true)

    expect(resolveActiveComponents({
      habitatVaries: false, incompletenessComputable: 0, rankedCount: 10,
    }).habitat).toBe(false)
  })

  it('activates incompleteness only with full coverage of the ranked set', () => {
    expect(resolveActiveComponents({
      habitatVaries: false, incompletenessComputable: 10, rankedCount: 10,
    }).incompleteness).toBe(true)
  })

  it('refuses partial coverage, which would mix incompatible scales', () => {
    // The regression this guards: with 18 of 369 ranked hexbins scored on a
    // renormalised three-component formula and the rest on the gap alone, those
    // 18 took ranks 1–5 purely because their value was computable and saturated,
    // displacing hexbins that belonged at #19, #37, #93, #179 and #223.
    for (const computable of [0, 1, 18, 368]) {
      expect(resolveActiveComponents({
        habitatVaries: false, incompletenessComputable: computable, rankedCount: 369,
      }).incompleteness).toBe(false)
    }
  })

  it('does not activate incompleteness when nothing is ranked', () => {
    expect(resolveActiveComponents({
      habitatVaries: false, incompletenessComputable: 0, rankedCount: 0,
    }).incompleteness).toBe(false)
  })
})

describe('scoreToColor', () => {
  it('returns a CSS rgb() string', () => {
    expect(scoreToColor(0.5)).toMatch(/^rgb\(\d+, \d+, \d+\)$/)
  })

  it('clamps values outside [0, 1] without throwing', () => {
    expect(() => scoreToColor(-0.5)).not.toThrow()
    expect(() => scoreToColor(1.5)).not.toThrow()
  })
})

describe('scoreToOpacity', () => {
  it('returns 0.25 at score 0', () => {
    expect(scoreToOpacity(0)).toBeCloseTo(0.25, 2)
  })

  it('returns 0.80 at score 1', () => {
    expect(scoreToOpacity(1)).toBeCloseTo(0.80, 2)
  })
})
