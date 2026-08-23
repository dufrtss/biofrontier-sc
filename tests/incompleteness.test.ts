import { describe, it, expect } from 'vitest'
import { gridDisk } from 'h3-js'
import { computeIncompleteness, type IncompletenessInput } from '@/lib/incompleteness'
import { INCOMPLETENESS_CONFIG } from '@/lib/scoring-config'

// A real H3 res-6 cell inside Santa Catarina, plus its actual grid neighbours.
// Using genuine H3 ids matters: the model calls gridDisk internally, so
// synthetic ids would find no neighbours at all and every test would trivially
// return null.
const CENTER = '86a91b477ffffff'
const NEIGHBOURS = gridDisk(CENTER, INCOMPLETENESS_CONFIG.neighbourRadius)
  .filter(id => id !== CENTER)

function hex(
  hexId: string,
  speciesIds: number[],
  overrides: Partial<IncompletenessInput> = {},
): IncompletenessInput {
  return {
    hexId,
    speciesIds,
    habitatQuality: 0.5,
    hasData: speciesIds.length > 0,
    ...overrides,
  }
}

/** Builds a centre hexbin surrounded by `count` neighbours sharing a species pool. */
function withNeighbours(
  centerSpecies: number[],
  neighbourSpecies: number[][],
  centerOverrides: Partial<IncompletenessInput> = {},
): IncompletenessInput[] {
  return [
    hex(CENTER, centerSpecies, centerOverrides),
    ...neighbourSpecies.map((species, i) => hex(NEIGHBOURS[i], species)),
  ]
}

/**
 * Most tests below use a shared pool of species recorded in every neighbour, so
 * the prevalence threshold passes them all and the assertions isolate whatever
 * the individual test is about. Prevalence itself is exercised separately.
 */
const SHARED = [1, 2, 3, 4, 5, 6]

describe('computeIncompleteness', () => {
  it('scores 1.0 for an unsurveyed hexbin surrounded by comparable neighbours', () => {
    const hexes = withNeighbours([], [SHARED, SHARED, SHARED], { hasData: false })
    const result = computeIncompleteness(hexes).get(CENTER)!
    expect(result.score).toBe(1)
    expect(result.expectedSpeciesCount).toBe(6)
    expect(result.missingSpeciesCount).toBe(6)
  })

  it('scores 0.0 when the hexbin already records every expected species', () => {
    const hexes = withNeighbours(SHARED, [SHARED, SHARED, SHARED])
    expect(computeIncompleteness(hexes).get(CENTER)!.score).toBe(0)
  })

  it('computes the missing fraction of the expected pool', () => {
    const hexes = withNeighbours([1, 2, 3], [SHARED, SHARED, SHARED])
    const result = computeIncompleteness(hexes).get(CENTER)!
    expect(result.expectedSpeciesCount).toBe(6)
    expect(result.missingSpeciesCount).toBe(3)
    expect(result.score).toBeCloseTo(0.5, 6)
  })

  it('ignores species the hexbin has that neighbours do not (they cannot be "missing")', () => {
    const hexes = withNeighbours([1, 2, 3, 90, 91, 92], [SHARED, SHARED, SHARED])
    const result = computeIncompleteness(hexes).get(CENTER)!
    expect(result.expectedSpeciesCount).toBe(6)
    expect(result.score).toBeCloseTo(0.5, 6)
  })

  it('returns null when too few neighbours have data', () => {
    const hexes = withNeighbours([1], [SHARED, SHARED])
    const result = computeIncompleteness(hexes).get(CENTER)!
    expect(result.score).toBeNull()
    expect(result.neighboursUsed).toBe(2)
  })

  it('returns null when the expected species pool is too small to trust', () => {
    const hexes = withNeighbours([], [[1, 2], [1, 2], [1, 2]], { hasData: false })
    const result = computeIncompleteness(hexes).get(CENTER)!
    expect(result.score).toBeNull()
    expect(result.expectedSpeciesCount).toBe(2)
  })

  it('excludes ecologically dissimilar neighbours from the expected pool', () => {
    const hexes: IncompletenessInput[] = [
      hex(CENTER, [], { habitatQuality: 0.9, hasData: false }),
      // Similar habitat — these count.
      hex(NEIGHBOURS[0], SHARED, { habitatQuality: 0.85 }),
      hex(NEIGHBOURS[1], SHARED, { habitatQuality: 0.8 }),
      hex(NEIGHBOURS[2], SHARED, { habitatQuality: 0.75 }),
      // Degraded habitat, well outside the tolerance — must not contribute.
      hex(NEIGHBOURS[3], [100, 101, 102], { habitatQuality: 0.05 }),
    ]
    const result = computeIncompleteness(hexes).get(CENTER)!
    expect(result.neighboursUsed).toBe(3)
    expect(result.expectedSpeciesCount).toBe(6)  // species 100–102 excluded
  })

  it('does not let a hexbin contribute to its own expected pool', () => {
    const hexes = withNeighbours(
      [50, 51, 52, 53, 54, 55],
      [SHARED, SHARED, SHARED],
    )
    const result = computeIncompleteness(hexes).get(CENTER)!
    expect(result.expectedSpeciesCount).toBe(6)
    expect(result.score).toBe(1)
  })

  it('returns a result for every input hexbin', () => {
    const hexes = withNeighbours([1], [SHARED, SHARED, SHARED])
    const results = computeIncompleteness(hexes)
    expect(results.size).toBe(hexes.length)
    for (const h of hexes) expect(results.has(h.hexId)).toBe(true)
  })

  it('handles an empty input without throwing', () => {
    expect(computeIncompleteness([]).size).toBe(0)
  })

  it('respects an injected config', () => {
    // Two neighbours would normally fall below minNeighboursWithData (3).
    const hexes = withNeighbours([], [SHARED, SHARED], { hasData: false })
    const relaxed = computeIncompleteness(hexes, {
      ...INCOMPLETENESS_CONFIG,
      minNeighboursWithData: 2,
    })
    expect(relaxed.get(CENTER)!.score).toBe(1)
  })
})

describe('computeIncompleteness — neighbour prevalence threshold', () => {
  it('excludes species recorded in only one of many neighbours', () => {
    // Each neighbour contributes one species nobody else has. Under the naive
    // union formulation all of them would be "expected", saturating the score.
    const hexes = withNeighbours(
      [],
      [
        [...SHARED, 100],
        [...SHARED, 101],
        [...SHARED, 102],
        [...SHARED, 103],
      ],
      { hasData: false },
    )
    const result = computeIncompleteness(hexes).get(CENTER)!
    expect(result.expectedSpeciesCount).toBe(6)  // the one-offs are excluded
  })

  it('includes a species once enough neighbours record it', () => {
    // 4 qualifying neighbours; at 0.3 prevalence a species needs ceil(1.2) = 2,
    // floored at a minimum of 2 neighbours.
    const hexes = withNeighbours(
      [],
      [
        [...SHARED, 100],
        [...SHARED, 100],
        [...SHARED],
        [...SHARED],
      ],
      { hasData: false },
    )
    expect(computeIncompleteness(hexes).get(CENTER)!.expectedSpeciesCount).toBe(7)
  })

  it('always requires at least two neighbours, even with a tiny threshold', () => {
    // Guards against a single stray record defining the expectation for a cell.
    const hexes = withNeighbours(
      [],
      [[...SHARED, 100], SHARED, SHARED],
      { hasData: false },
    )
    const result = computeIncompleteness(hexes, {
      ...INCOMPLETENESS_CONFIG,
      minNeighbourPrevalence: 0,
    }).get(CENTER)!
    expect(result.expectedSpeciesCount).toBe(6)
  })

  it('produces a discriminating spread rather than saturating at 1.0', () => {
    // The regression this guards: with the union formulation, every one of
    // these hexbins scored exactly 1.0 against real data.
    const build = (centerSpecies: number[]) =>
      computeIncompleteness(
        withNeighbours(centerSpecies, [SHARED, SHARED, SHARED]),
      ).get(CENTER)!.score

    const scores = [[], [1, 2], [1, 2, 3, 4], SHARED].map(s => build(s as number[]))
    expect(scores).toEqual([1, 2 / 3, 1 / 3, 0])
  })
})
