export type TaxonFilter = 'all' | 'vertebrates'

export interface TaxonRecord {
  occurrenceCount: number
  uniqueSpeciesCount: number
  uniqueObserverCount: number
  uniqueDateCount: number
  temporalSpanYears: number
  firstDate: string | null
  lastDate: string | null
  topSpecies: Array<{ name: string; count: number }>
}

// Shape stored in public/data/hexbins.json
export interface HexbinRecord {
  hexId: string
  all: TaxonRecord
  vertebrates: TaxonRecord
  habitatQuality: number  // 0–1, fraction of hexbin covered by Atlantic Forest
}

// Derived at runtime after normalised scoring
export interface ScoredHexbin extends HexbinRecord {
  effortScore: number    // 0–1, normalised across all hexbins for active filter
  frontierScore: number  // 0–1, higher = more frontier
  rank: number           // 1-based, sorted by frontierScore desc
}

export interface HexbinsFile {
  generatedAt: string   // ISO 8601
  hexbinCount: number
  hexbins: HexbinRecord[]
}

export interface AppState {
  hexbins: Record<string, ScoredHexbin>  // keyed by hexId
  rankedHexIds: string[]                 // hexIds sorted by frontierScore desc
  selectedHexId: string | null
  taxonFilter: TaxonFilter
  loading: boolean
  error: string | null
  lastUpdated: string | null
}
