// Frontier score → fill colour.
//
// The score is a magnitude (0 = well surveyed, 1 = frontier), so the ramp is
// sequential: ONE hue, monotone lightness, pale → deep. The ramp this replaced
// interpolated blue → red in RGB, which is two hues and passes through a muddy
// grey at the midpoint — it reads as a category change rather than as more of
// the same thing.
//
// Green, anchored on GBIF's #4C9C2E, and running DARKER as the score rises
// because the basemap underneath is light: on a pale ground the eye reads the
// darkest patch as the most, and a ramp that brightened toward the frontier
// would make the most important hexbins the faintest.
//
// Generated in OKLCH and validated as an ordinal ramp — monotone L, ΔL ≥ 0.067
// between steps, hue spread 6.4°, low end 1.42:1 against the basemap so "well
// surveyed" stays visible rather than dissolving into it. Re-run that
// validation before editing a step by hand.
const FRONTIER_RAMP = [
  '#b2d6b4', '#97c197', '#7cad7a', '#62995e', '#498640', '#2f721f', '#105e00',
] as const

// The same ramp for a dark basemap, and it runs the OTHER WAY.
//
// Direction is not a style choice, it follows the ground: on a pale map the eye
// reads the darkest patch as the most, and on a dark one it reads the brightest.
// Keeping the light ramp and simply dimming it would invert the meaning of the
// map — well-surveyed cells would shout and frontier cells would recede — so
// dark mode gets its own ramp, generated the same way and validated the same
// way, rising in lightness instead of falling.
//
// Monotone L, ΔL ≥ 0.082 per step, hue spread 6.2°.
const FRONTIER_RAMP_DARK = [
  '#163c19', '#275428', '#3a6e38', '#4e8848', '#63a358', '#79bf69', '#90db7a',
] as const

export type Theme = 'light' | 'dark'

/** Which step of a seven-step ramp a score falls in. One definition, so the
 *  fill and the ink can never disagree about which cell a score belongs to. */
function step(score: number): number {
  const s = Math.max(0, Math.min(1, score))
  return Math.min(6, Math.floor(s * 7))
}

export function scoreToColor(score: number, theme: Theme = 'light'): string {
  return (theme === 'dark' ? FRONTIER_RAMP_DARK : FRONTIER_RAMP)[step(score)]
}

// Opacity used to ramp 0.25 → 0.80, which double-encoded the score: a
// low-frontier hexbin was both the palest colour AND the most transparent, so
// it disappeared into the basemap entirely and "no data" and "well surveyed"
// looked identical. Lightness carries the magnitude now; opacity only has to
// keep every hexbin legible over the tiles.
//
// The band is narrow and deliberately not opaque. Over a grey canvas 0.60-0.85
// was right; over cartography that anyone is meant to read THROUGH, it buried
// the rivers and the coastline that are the reason for using those tiles. The
// hexbins keep their definition from a stroke in their own ink colour instead
// — see GapMap.client.tsx.
export function scoreToOpacity(score: number): number {
  return 0.38 + Math.max(0, Math.min(1, score)) * 0.28  // 0.38 → 0.66
}

// The same score, in a colour that can be a letterform.
//
// Inverting the ramp for a light basemap has a consequence that is easy to miss
// until the panel renders: a low-frontier hexbin is now PALE, and the detail
// panel paints its rank, its score and its section rules in the hexbin's own
// colour. Pale green on white is not text. Only the last two steps of the fill
// ramp clear 4.5:1 on white, so text cannot borrow from it.
//
// This is that ramp taken down into a range where every step is readable —
// same hue, same ordering, 5.02:1 at the palest end on white and 4.58:1 on the
// slate-100 page ground. It carries the score as a hint; the FILL is what
// encodes it quantitatively, and that division is deliberate. Do not use this
// for an area and do not use the fill ramp for type.
const FRONTIER_INK = [
  '#427c3f', '#377432', '#2b6c24', '#1f6513', '#115d00', '#005500', '#004d00',
] as const

// The dark theme's ink. Light greens, because it has to be readable as type on
// a near-black panel AND as a hairline over inverted map tiles: every step
// clears 4.5:1 on both dark grounds and 3:1 over dark land, water and woodland.
const FRONTIER_INK_DARK = [
  '#6fa170', '#76ae75', '#7ebb7b', '#87c880', '#90d584', '#99e289', '#a3ef8d',
] as const

export function scoreToInk(score: number, theme: Theme = 'light'): string {
  return (theme === 'dark' ? FRONTIER_INK_DARK : FRONTIER_INK)[step(score)]
}

export const frontierRamp     = FRONTIER_RAMP
export const frontierRampDark = FRONTIER_RAMP_DARK
export const frontierInk      = FRONTIER_INK
export const frontierInkDark  = FRONTIER_INK_DARK
