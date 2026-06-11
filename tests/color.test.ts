import { describe, it, expect } from 'vitest'
import { scoreToColor, scoreToOpacity } from '@/lib/color'

describe('scoreToColor', () => {
  it('returns electric cyan for score 0 (well-surveyed)', () => {
    expect(scoreToColor(0)).toBe('rgb(34, 211, 238)')
  })
  it('returns bioluminescent green for score 1 (frontier)', () => {
    expect(scoreToColor(1)).toBe('rgb(0, 255, 136)')
  })
  it('clamps below 0', () => {
    expect(scoreToColor(-1)).toBe('rgb(34, 211, 238)')
  })
  it('clamps above 1', () => {
    expect(scoreToColor(2)).toBe('rgb(0, 255, 136)')
  })
  it('returns a midpoint teal at score 0.5', () => {
    // r: 34 + (0-34)*0.5 = 17, g: 211 + (255-211)*0.5 = 233, b: 238 + (136-238)*0.5 = 187
    expect(scoreToColor(0.5)).toBe('rgb(17, 233, 187)')
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
