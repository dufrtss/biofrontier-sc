import { describe, it, expect } from 'vitest'
import { normalizeValues, computeEffortScores, computeFrontierScore } from '@/lib/scoring'
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
  const score = (
    effortScore: number,
    habitatQuality: number | null,
    taxonomicIncompleteness: number | null = null,
  ) => computeFrontierScore({ effortScore, habitatQuality, taxonomicIncompleteness })

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

  describe('when incompleteness is unavailable', () => {
    it('renormalises the remaining components to still span [0, 1]', () => {
      expect(score(0, 1, null)).toBeCloseTo(1.0, 6)
      expect(score(1, 0, null)).toBeCloseTo(0.0, 6)
    })

    it('does not penalise the hexbin the way treating it as zero would', () => {
      // The failure mode this guards against: data-poor hexbins are exactly what
      // the tool exists to surface, so a missing third component must not push
      // them down the ranking.
      const renormalised = score(0.2, 0.8, null)
      const asIfZero =
        (1 - 0.2) * FRONTIER_WEIGHTS.gap + 0.8 * FRONTIER_WEIGHTS.habitat
      expect(renormalised).toBeGreaterThan(asIfZero)
    })

    it('preserves the gap:habitat ratio after renormalising', () => {
      const ratio = FRONTIER_WEIGHTS.gap / FRONTIER_WEIGHTS.habitat
      expect(score(0, 0, null) / score(1, 1, null)).toBeCloseTo(ratio, 6)
    })
  })

  describe('when habitat data is a uniform placeholder', () => {
    it('still spans [0, 1] using the remaining components', () => {
      expect(score(0, null, 1)).toBeCloseTo(1.0, 6)
      expect(score(1, null, 0)).toBeCloseTo(0.0, 6)
    })

    it('scores purely on the survey gap when both optional components are absent', () => {
      expect(score(0, null, null)).toBeCloseTo(1.0, 6)
      expect(score(1, null, null)).toBeCloseTo(0.0, 6)
      expect(score(0.3, null, null)).toBeCloseTo(0.7, 6)
    })

    it('does not add a constant offset the way a fixed 0.5 habitat value would', () => {
      // The bug this guards against: with every hexbin at habitat 0.5, including
      // the component adds the same 0.175 to all of them — inflating scores and
      // compressing the visible range while changing no ordering.
      const dropped = score(0.5, null, 0.5)
      const withConstant = score(0.5, 0.5, 0.5)
      expect(dropped).toBeCloseTo(0.5, 6)
      expect(withConstant).toBeCloseTo(0.5, 6)
      // Equal at the midpoint, but the placeholder compresses the extremes:
      expect(score(0, null, 1)).toBeGreaterThan(score(0, 0.5, 1))
      expect(score(1, null, 0)).toBeLessThan(score(1, 0.5, 0))
    })
  })

  it('accepts injected weights for calibration experiments', () => {
    const gapOnly = { gap: 1, habitat: 0, incompleteness: 0 }
    expect(
      computeFrontierScore(
        { effortScore: 0.25, habitatQuality: 1, taxonomicIncompleteness: 1 },
        gapOnly,
      ),
    ).toBeCloseTo(0.75, 6)
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
