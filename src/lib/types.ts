export type TaxonFilter = 'all' | 'vertebrates'

/** Occurrence data sources the pipeline can draw from. */
export type SourceId = 'gbif' | 'inaturalist' | 'specieslink'

export interface TaxonRecord {
  occurrenceCount: number
  uniqueSpeciesCount: number
  uniqueObserverCount: number
  uniqueDateCount: number
  temporalSpanYears: number
  firstDate: string | null
  lastDate: string | null
  topSpecies: Array<{ name: string; count: number }>
  /**
   * Indices into `HexbinsFile.speciesIndex` for every species recorded here —
   * not just the top 10 in `topSpecies`.
   *
   * Schema v2 and later. Absent in v1 files, where `normalizeHexbinsFile`
   * reconstructs a partial set from `topSpecies` so the app still runs; see
   * that function for what degrades.
   */
  speciesIds?: number[]
  /** Records contributed per source. Schema v2+; absent in v1 files. */
  countsBySource?: Partial<Record<SourceId, number>>
}

// Shape stored in public/data/hexbins.json
export interface HexbinRecord {
  hexId: string
  all: TaxonRecord
  vertebrates: TaxonRecord
  habitatQuality: number  // 0–1, fraction of hexbin covered by Atlantic Forest
}

/** Per-source provenance for a generated dataset. */
export interface SourceMeta {
  id: SourceId
  /** Records kept after coordinate/bounds filtering. */
  recordCount: number
  /** Records dropped as duplicates of a record already seen from another source. */
  duplicatesDropped: number
  fetchedAt: string
}

export interface HexbinsFile {
  /** Absent in v1 files. `normalizeHexbinsFile` stamps 1 when missing. */
  schemaVersion?: number
  generatedAt: string   // ISO 8601
  hexbinCount: number
  hexbins: HexbinRecord[]
  /** Global deduplicated species names. Schema v2+. */
  speciesIndex?: string[]
  /** Which sources produced this dataset. Schema v2+. */
  sources?: SourceMeta[]
}

/** A `HexbinsFile` after normalization, with v2 fields guaranteed present. */
export interface NormalizedHexbinsFile extends HexbinsFile {
  schemaVersion: number
  speciesIndex: string[]
  sources: SourceMeta[]
  /**
   * True when species sets were reconstructed from `topSpecies` because the
   * source file predates the species index. Incompleteness scoring still runs
   * but sees at most 10 species per hexbin, so it understates the expected
   * pool. Surfaced in the UI rather than hidden.
   */
  speciesDataIsPartial: boolean
  /**
   * True when every hexbin shares one habitat value — the uniform placeholder
   * from `data:habitat-fallback`. The habitat component is then dropped from
   * the frontier score rather than added as a constant.
   */
  habitatIsPlaceholder: boolean
}

// Derived at runtime after normalised scoring
export interface ScoredHexbin extends HexbinRecord {
  effortScore: number    // 0–1, normalised across all hexbins for active filter
  frontierScore: number  // 0–1, higher = more frontier
  rank: number           // 1-based, sorted by frontierScore desc
  /** Null when there were too few comparable neighbours to compute one. */
  taxonomicIncompleteness: number | null
  /** Expected-species pool size behind `taxonomicIncompleteness`. */
  expectedSpeciesCount: number
  /** Expected species with no record in this hexbin. */
  missingSpeciesCount: number
}

export interface AppState {
  hexbins: Record<string, ScoredHexbin>  // keyed by hexId
  rankedHexIds: string[]                 // hexIds sorted by frontierScore desc
  selectedHexId: string | null
  taxonFilter: TaxonFilter
  loading: boolean
  error: string | null
  lastUpdated: string | null
  speciesCount: number                   // unique species across all hexbins
  sources: SourceMeta[]
  speciesDataIsPartial: boolean
  habitatIsPlaceholder: boolean
}
