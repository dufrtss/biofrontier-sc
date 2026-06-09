// Maps a frontier score (0 = well-surveyed, 1 = frontier) to a CSS rgb() colour
// Gradient: blue (#3b82f6) → orange-red (#ef4444)
export function scoreToColor(score: number): string {
  const s = Math.max(0, Math.min(1, score))
  const r = Math.round(59  + (239 - 59)  * s)
  const g = Math.round(130 + (68  - 130) * s)
  const b = Math.round(246 + (68  - 246) * s)
  return `rgb(${r}, ${g}, ${b})`
}

export function scoreToOpacity(score: number): number {
  return 0.25 + score * 0.55  // 0.25 → 0.80
}
