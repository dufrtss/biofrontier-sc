import { describe, it, expect } from 'vitest'
import {
  occurrenceToHex,
  hexCenter,
  hexBoundary,
  isInSCBounds,
  generateSCHexgrid,
} from '@/lib/h3-utils'

describe('occurrenceToHex', () => {
  it('returns a valid 15-char H3 cell ID for Florianópolis', () => {
    const hexId = occurrenceToHex(-27.5969, -48.5480)
    expect(hexId).toMatch(/^[0-9a-f]{15}$/)
  })

  it('assigns two nearby points (~200 m apart) to the same hexbin', () => {
    // Use hex-center coordinates to guarantee both points are interior to the same res-6 hexbin
    expect(occurrenceToHex(-27.5966, -48.5158)).toBe(occurrenceToHex(-27.5866, -48.5158))
  })

  it('assigns Florianópolis and Joinville to different hexbins', () => {
    const flp = occurrenceToHex(-27.5969, -48.5480)
    const jvl = occurrenceToHex(-26.3044, -48.8487)
    expect(flp).not.toBe(jvl)
  })
})

describe('hexCenter', () => {
  it('returns coordinates within SC bounding box', () => {
    const hexId = occurrenceToHex(-27.5969, -48.5480)
    const [lat, lng] = hexCenter(hexId)
    expect(lat).toBeGreaterThan(-30)
    expect(lat).toBeLessThan(-25)
    expect(lng).toBeGreaterThan(-55)
    expect(lng).toBeLessThan(-48)
  })
})

describe('hexBoundary', () => {
  it('returns exactly 6 vertices for a hexagon', () => {
    const hexId = occurrenceToHex(-27.5969, -48.5480)
    expect(hexBoundary(hexId)).toHaveLength(6)
  })

  it('each vertex is a [lat, lng] number pair', () => {
    const hexId = occurrenceToHex(-27.5969, -48.5480)
    hexBoundary(hexId).forEach(([lat, lng]) => {
      expect(typeof lat).toBe('number')
      expect(typeof lng).toBe('number')
    })
  })
})

describe('isInSCBounds', () => {
  it('returns true for Florianópolis', () => {
    expect(isInSCBounds(-27.5969, -48.5480)).toBe(true)
  })

  it('returns false for São Paulo', () => {
    expect(isInSCBounds(-23.5505, -46.6333)).toBe(false)
  })

  it('returns false for Porto Alegre (RS, south of SC)', () => {
    expect(isInSCBounds(-30.0346, -51.2177)).toBe(false)
  })
})

describe('generateSCHexgrid', () => {
  it('generates a non-empty list of valid H3 cell IDs', () => {
    const grid = generateSCHexgrid()
    expect(grid.length).toBeGreaterThan(0)
    grid.forEach(id => expect(id).toMatch(/^[0-9a-f]{15}$/))
  })

  it('generates roughly 1 000–8 000 hexbins for SC bounding box at resolution 6', () => {
    const grid = generateSCHexgrid()
    expect(grid.length).toBeGreaterThan(1000)
    expect(grid.length).toBeLessThan(8000)
  })
})
