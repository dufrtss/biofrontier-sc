import { describe, it, expect } from 'vitest'
import { normalizeValues, computeEffortScores, computeFrontierScore } from '@/lib/scoring'
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

describe('computeFrontierScore', () => {
  it('scores 1.0 for unsurveyed hexbin with full habitat', () => {
    expect(computeFrontierScore(0, 1)).toBeCloseTo(1.0, 5)
  })

  it('scores 0.0 for fully-surveyed degraded hexbin', () => {
    expect(computeFrontierScore(1, 0)).toBeCloseTo(0.0, 5)
  })

  it('returns a value in [0, 1] for typical inputs', () => {
    const s = computeFrontierScore(0.4, 0.7)
    expect(s).toBeGreaterThanOrEqual(0)
    expect(s).toBeLessThanOrEqual(1)
  })

  it('gap weight (0.53) outweighs habitat weight (0.47)', () => {
    expect(computeFrontierScore(0, 0)).toBeCloseTo(0.53, 2)
    expect(computeFrontierScore(1, 1)).toBeCloseTo(0.47, 2)
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
