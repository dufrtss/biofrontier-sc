// Maps a frontier score (0 = well-surveyed, 1 = frontier) to a CSS rgb() colour
// Gradient: electric cyan (#22d3ee) → bioluminescent green (#00ff88)
export function scoreToColor(score: number): string {
  const s = Math.max(0, Math.min(1, score))
  const r = Math.round(34  + (0   - 34)  * s)
  const g = Math.round(211 + (255 - 211) * s)
  const b = Math.round(238 + (136 - 238) * s)
  return `rgb(${r}, ${g}, ${b})`
}

export function scoreToOpacity(score: number): number {
  return 0.25 + score * 0.55  // 0.25 → 0.80
}
