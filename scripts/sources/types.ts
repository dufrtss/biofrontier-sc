import type { SourceId } from '../../src/lib/types'

/**
 * One occurrence record, normalised across every upstream provider.
 *
 * Adapters are responsible for mapping their own payload into this shape —
 * nothing downstream of a source should ever need to know which API a record
 * came from, except for provenance reporting and deduplication.
 */
export interface Occurrence {
  lat: number
  lng: number
  /** Binomial name. Null when the record is identified only to genus or above. */
  species: string | null
  isVertebrate: boolean
  /** Collector or observer, truncated by the adapter. Null when not supplied. */
  observer: string | null
  /** ISO date, `YYYY-MM-DD`. Null when the record carries no usable date. */
  date: string | null
  source: SourceId
}

export interface FetchContext {
  /** Upper bound on records to collect from this source. */
  maxRecords: number
  /** Progress reporting. Adapters should call this rather than writing to stdout. */
  log: (message: string) => void
}

export type Availability =
  | { ok: true }
  | { ok: false; reason: string }

/**
 * A biodiversity occurrence provider.
 *
 * Adding a source means implementing this interface and registering it in
 * `sources/index.ts` — no changes to the orchestrator required.
 */
export interface OccurrenceSource {
  id: SourceId
  label: string
  /**
   * Whether this source can run right now. Sources needing credentials report
   * `ok: false` with an actionable reason instead of failing mid-fetch, so a
   * missing optional API key degrades the dataset rather than breaking the run.
   */
  isAvailable(): Availability
  fetchAll(ctx: FetchContext): Promise<Occurrence[]>
}
