import { describe, it, expect } from 'vitest'
import {
  scoreToColor, scoreToOpacity, scoreToInk,
  frontierRamp, frontierRampDark, frontierInk, frontierInkDark,
} from '@/lib/color'

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
})

// A sequential ramp encodes magnitude as lightness, and the direction depends
// on the ground it is drawn over. The basemap here is light, so the ramp runs
// DARKER as the score rises: on a pale ground the eye reads the darkest patch
// as the most. If this were not monotone, a lighter patch could mean "more",
// which is the failure the blue→red ramp this replaced actually had at its
// midpoint.
describe('the frontier ramp', () => {
  const contrast = (a: string, b: string) => {
    const la = luminance(a), lb = luminance(b)
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
  }

  const luminance = (hex: string) => {
    const h = hex.replace('#', '')
    const ch = [0, 2, 4].map(i => {
      const c = parseInt(h.slice(i, i + 2), 16) / 255
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
  }

  it('falls monotonically in luminance', () => {
    for (let i = 1; i < frontierRamp.length; i++) {
      expect(luminance(frontierRamp[i])).toBeLessThan(luminance(frontierRamp[i - 1]))
    }
  })

  it('keeps its palest step visible against open land', () => {
    // OSM's land fill is about #f2efe9. A ramp whose low end matched it would
    // make "well surveyed" and "no data" look identical, which is the
    // distinction the map exists to draw.
    expect(contrast(frontierRamp[0], '#f2efe9')).toBeGreaterThan(1.3)
  })

  // The fill cannot carry the low end on its own any more, and it is worth
  // being explicit about why rather than discovering it again. The basemap is
  // OSM, whose forest and water fills sit in the same part of the spectrum as
  // a green ramp: the palest step measures 1.16 against woodland and 1.01
  // against water — that is invisible. What keeps a low-frontier hexbin
  // readable there is its STROKE, drawn in the ink colour, so the stroke is
  // load-bearing rather than decorative and has to clear 3:1 everywhere the
  // basemap can go.
  it('draws every cell edge clearly against any OSM ground', () => {
    for (const ground of ['#f2efe9', '#c8e6a0', '#aad3df', '#e8e0d8']) {
      for (const step of frontierInk) {
        expect(contrast(step, ground)).toBeGreaterThanOrEqual(3)
      }
    }
  })
})

// The fill ramp and the ink ramp are the same quantity in two media, and the
// thing that must never drift is that they agree on direction and on which step
// a score lands in. The reason they are separate at all is contrast: only two
// steps of the fill ramp are legible as type on white.
describe('scoreToInk', () => {
  it('lands on the same step index as the fill ramp', () => {
    for (let s = 0; s <= 1.0001; s += 0.01) {
      expect(frontierInk.indexOf(scoreToInk(s) as typeof frontierInk[number]))
        .toBe(frontierRamp.indexOf(scoreToColor(s) as typeof frontierRamp[number]))
    }
  })

  it('is readable as text at every step', () => {
    const rel = (hex: string) => {
      const h = hex.replace('#', '')
      const ch = [0, 2, 4].map(i => {
        const c = parseInt(h.slice(i, i + 2), 16) / 255
        return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
      })
      return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
    }
    // Against white panels and against the slate-100 page ground, which is the
    // darker of the two backgrounds this type ever sits on.
    for (const ground of ['#ffffff', '#f1f5f9']) {
      for (const step of frontierInk) {
        const contrast = (rel(ground) + 0.05) / (rel(step) + 0.05)
        expect(contrast).toBeGreaterThanOrEqual(4.5)
      }
    }
  })
})

// Dark mode is not the light ramp dimmed. Direction follows the ground: on a
// pale map the eye reads the darkest patch as the most, on a dark one the
// brightest — so a ramp that kept falling would make well-surveyed cells shout
// and frontier cells recede, which is the map saying the opposite of what it
// means.
describe('the dark ramps', () => {
  const rel = (hex: string) => {
    const h = hex.replace('#', '')
    const ch = [0, 2, 4].map(i => {
      const c = parseInt(h.slice(i, i + 2), 16) / 255
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
  }
  const ratio = (a: string, b: string) =>
    (Math.max(rel(a), rel(b)) + 0.05) / (Math.min(rel(a), rel(b)) + 0.05)

  it('runs the opposite way to the light ramp', () => {
    for (let i = 1; i < frontierRampDark.length; i++) {
      expect(rel(frontierRampDark[i])).toBeGreaterThan(rel(frontierRampDark[i - 1]))
      expect(rel(frontierRamp[i])).toBeLessThan(rel(frontierRamp[i - 1]))
    }
  })

  it('picks the same step as the light ramp for the same score', () => {
    for (let s = 0; s <= 1.0001; s += 0.01) {
      expect(frontierRampDark.indexOf(scoreToColor(s, 'dark') as typeof frontierRampDark[number]))
        .toBe(frontierRamp.indexOf(scoreToColor(s, 'light') as typeof frontierRamp[number]))
      expect(frontierInkDark.indexOf(scoreToInk(s, 'dark') as typeof frontierInkDark[number]))
        .toBe(frontierInk.indexOf(scoreToInk(s, 'light') as typeof frontierInk[number]))
    }
  })

  it('defaults to the light ramp, so an un-themed caller is not silently dark', () => {
    expect(scoreToColor(0.5)).toBe(scoreToColor(0.5, 'light'))
    expect(scoreToInk(0.5)).toBe(scoreToInk(0.5, 'light'))
  })

  // The dark ink does double duty: type in the detail panel, and the hairline
  // that keeps a hexbin's shape over inverted map tiles.
  it('keeps dark ink readable as type and as a hairline', () => {
    for (const ground of ['#131c2b', '#0b1220']) {        // panel, page
      for (const step of frontierInkDark) {
        expect(ratio(step, ground)).toBeGreaterThanOrEqual(4.5)
      }
    }
    for (const ground of ['#2b2f33', '#243447', '#2f3a24']) {  // inverted land, water, woodland
      for (const step of frontierInkDark) {
        expect(ratio(step, ground)).toBeGreaterThanOrEqual(3)
      }
    }
  })
})

describe('scoreToOpacity', () => {
  it('is high enough at the low end to stay legible over tiles', () => {
    expect(scoreToOpacity(0)).toBeCloseTo(0.38)
  })

  // Never opaque: the basemap under these hexbins is cartography the reader is
  // meant to see through, not a backdrop.
  it('rises with the score while still letting the basemap through', () => {
    expect(scoreToOpacity(1)).toBeCloseTo(0.66)
    expect(scoreToOpacity(1)).toBeLessThan(0.8)
  })
})
