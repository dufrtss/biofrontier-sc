export interface EffortInputs {
  uniqueObserverCount: number
  uniqueDateCount: number
  recordDensity: number       // occurrenceCount / hexbin area in km²
  temporalSpanYears: number
}

export function normalizeValues(values: number[]): number[] {
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (max === min) return values.map(() => 0)
  return values.map(v => (v - min) / (max - min))
}

export function computeEffortScores(hexbins: EffortInputs[]): number[] {
  if (hexbins.length === 0) return []

  const observerNorm = normalizeValues(hexbins.map(h => h.uniqueObserverCount))
  const datesNorm    = normalizeValues(hexbins.map(h => h.uniqueDateCount))
  const densityNorm  = normalizeValues(hexbins.map(h => h.recordDensity))
  const spanNorm     = normalizeValues(hexbins.map(h => h.temporalSpanYears))

  return hexbins.map((_, i) =>
    observerNorm[i] * 0.30 +
    datesNorm[i]    * 0.30 +
    densityNorm[i]  * 0.25 +
    spanNorm[i]     * 0.15
  )
}

export function computeFrontierScore(effortScore: number, habitatQuality: number): number {
  return (1 - effortScore) * 0.53 + habitatQuality * 0.47
}
