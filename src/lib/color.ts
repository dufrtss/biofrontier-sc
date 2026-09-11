// Frontier score → fill colour.
//
// The score is a magnitude (0 = well surveyed, 1 = frontier), so the ramp is
// sequential: ONE hue, monotone lightness, dim → bright. The previous ramp
// interpolated blue → red in RGB, which is two hues and passes through a muddy
// grey at the midpoint — it read as a category change rather than as more-of-
// the-same-thing, and its low end collided with the brand colour.
//
// Steps are generated in OKLCH for even perceptual spacing and validated as an
// ordinal ramp (monotone L, ΔL ≥ 0.06 between steps, low end 2.49:1 against the
// basemap, hue spread 29°). Re-run that validation before editing a step.
const FRONTIER_RAMP = [
  '#29596b', '#267488', '#1e8fa3', '#28abba', '#4ac5ce', '#7cdde1', '#b6f2f2',
] as const

export function scoreToColor(score: number): string {
  const s = Math.max(0, Math.min(1, score))
  const i = Math.min(FRONTIER_RAMP.length - 1, Math.floor(s * FRONTIER_RAMP.length))
  return FRONTIER_RAMP[i]
}

// Opacity used to ramp 0.25 → 0.80, which double-encoded the score: a
// low-frontier hexbin was both the dimmest colour AND the most transparent, so
// it disappeared into the basemap entirely and "no data" and "well surveyed"
// looked identical. Lightness carries the magnitude now; opacity only has to
// keep every hexbin legible over the tiles.
export function scoreToOpacity(score: number): number {
  return 0.55 + Math.max(0, Math.min(1, score)) * 0.25  // 0.55 → 0.80
}

export const frontierRamp = FRONTIER_RAMP
