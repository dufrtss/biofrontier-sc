/**
 * Shared HTTP helper for source adapters: timeout, retry with backoff, and a
 * polite user agent.
 *
 * Every provider here is a free public API run by a non-profit or research
 * institution. Being a well-behaved client — identifying ourselves, backing off
 * on failure, pausing between pages — is the cost of using them.
 */

export const USER_AGENT =
  'BioFrontier-SC/1.0 (biodiversity gap analysis; https://github.com/dufrtss/omega)'

export interface FetchJsonOptions {
  timeoutMs?: number
  maxAttempts?: number
  /** Called before each retry, with the 1-based attempt that just failed. */
  onRetry?: (attempt: number, error: unknown) => void
}

export async function fetchJson<T>(
  url: string,
  { timeoutMs = 60_000, maxAttempts = 3, onRetry }: FetchJsonOptions = {},
): Promise<T> {
  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      })
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
      }
      return await res.json() as T
    } catch (err) {
      lastError = err
      if (attempt < maxAttempts) {
        onRetry?.(attempt, err)
        await sleep(2000 * attempt)
      }
    } finally {
      clearTimeout(timer)
    }
  }

  throw lastError
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/** Normalises a free-text date to `YYYY-MM-DD`, or null if unusable. */
export function toIsoDate(value: string | null | undefined): string | null {
  if (!value) return null
  const candidate = value.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : null
}
