import { describe, it, expect } from 'vitest'
import { scoreToColor, scoreToOpacity } from '@/lib/color'

describe('scoreToColor', () => {
  it('returns blue for score 0 (well-surveyed)', () => {
    expect(scoreToColor(0)).toBe('rgb(59, 130, 246)')
  })
  it('returns orange-red for score 1 (frontier)', () => {
    expect(scoreToColor(1)).toBe('rgb(239, 68, 68)')
  })
  it('clamps below 0', () => {
    expect(scoreToColor(-1)).toBe('rgb(59, 130, 246)')
  })
  it('clamps above 1', () => {
    expect(scoreToColor(2)).toBe('rgb(239, 68, 68)')
  })
  it('returns a midpoint purple at score 0.5', () => {
    // r: 59 + (239-59)*0.5 = 149, g: 130 + (68-130)*0.5 = 99, b: 246 + (68-246)*0.5 = 157
    expect(scoreToColor(0.5)).toBe('rgb(149, 99, 157)')
  })
})

describe('scoreToOpacity', () => {
  it('returns 0.25 at score 0', () => {
    expect(scoreToOpacity(0)).toBeCloseTo(0.25)
  })
  it('returns 0.80 at score 1', () => {
    expect(scoreToOpacity(1)).toBeCloseTo(0.80)
  })
})
