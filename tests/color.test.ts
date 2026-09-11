import { describe, it, expect } from 'vitest'
import { scoreToColor, scoreToOpacity, frontierRamp } from '@/lib/color'

// The ramp is sequential, so the properties worth pinning are the ones that
// make it readable as a magnitude — not the individual hexes, which are
// generated in OKLCH and expected to be re-tuned.
describe('scoreToColor', () => {
  it('anchors the ends of the ramp', () => {
    expect(scoreToColor(0)).toBe(frontierRamp[0])
    expect(scoreToColor(1)).toBe(frontierRamp[frontierRamp.length - 1])
  })

  it('clamps outside [0, 1] to the ends', () => {
    expect(scoreToColor(-1)).toBe(frontierRamp[0])
    expect(scoreToColor(2)).toBe(frontierRamp[frontierRamp.length - 1])
  })

  it('only ever returns a step from the documented ramp', () => {
    for (let s = 0; s <= 1.0001; s += 0.01) {
      expect(frontierRamp).toContain(scoreToColor(s))
    }
  })

  it('never steps backwards as the score rises', () => {
    let prev = -1
    for (let s = 0; s <= 1.0001; s += 0.01) {
      const i = frontierRamp.indexOf(scoreToColor(s) as typeof frontierRamp[number])
      expect(i).toBeGreaterThanOrEqual(prev)
      prev = i
    }
  })

  // A sequential ramp encodes magnitude as lightness. If it were not monotone,
  // a darker patch could mean "more", which is the failure the blue→red ramp
  // this replaced actually had at its midpoint.
  it('rises monotonically in luminance', () => {
    const lum = (hex: string) => {
      const h = hex.replace('#', '')
      const ch = [0, 2, 4].map(i => {
        const c = parseInt(h.slice(i, i + 2), 16) / 255
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
      })
      return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
    }
    const lums = frontierRamp.map(lum)
    for (let i = 1; i < lums.length; i++) {
      expect(lums[i]).toBeGreaterThan(lums[i - 1])
    }
  })

  it('keeps the dimmest step visible against the basemap', () => {
    // 2:1 is the ordinal-ramp light-end floor; the low step measures 2.49:1.
    const lum = (hex: string) => {
      const h = hex.replace('#', '')
      const ch = [0, 2, 4].map(i => {
        const c = parseInt(h.slice(i, i + 2), 16) / 255
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
      })
      return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
    }
    const surface = lum('#0B1012')
    const ratio = (lum(frontierRamp[0]) + 0.05) / (surface + 0.05)
    expect(ratio).toBeGreaterThanOrEqual(2)
  })
})

describe('scoreToOpacity', () => {
  // Opacity deliberately no longer ramps from near-transparent: lightness
  // carries the magnitude, and a 0.25-opacity hexbin was indistinguishable
  // from no data at all.
  it('keeps every hexbin legible at score 0', () => {
    expect(scoreToOpacity(0)).toBeCloseTo(0.55)
  })
  it('returns 0.80 at score 1', () => {
    expect(scoreToOpacity(1)).toBeCloseTo(0.80)
  })
  it('never goes below the legibility floor', () => {
    for (let s = -1; s <= 2; s += 0.1) {
      expect(scoreToOpacity(s)).toBeGreaterThanOrEqual(0.55)
    }
  })
})
