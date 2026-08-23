import type { SourceId } from '../../src/lib/types'
import type { OccurrenceSource } from './types'
import { gbifSource } from './gbif'
import { inaturalistSource } from './inaturalist'
import { specieslinkSource } from './specieslink'

/**
 * Registry of every occurrence source.
 *
 * Order matters for deduplication: when the same observation reaches us from
 * two providers, the first one listed wins and keeps its provenance. GBIF leads
 * because it carries the richest metadata and the most stable identifiers;
 * iNaturalist follows, and many of its research-grade records will already have
 * arrived via GBIF.
 */
export const ALL_SOURCES: OccurrenceSource[] = [
  gbifSource,
  inaturalistSource,
  specieslinkSource,
]

export const SOURCE_IDS = ALL_SOURCES.map(s => s.id)

export function getSource(id: string): OccurrenceSource | undefined {
  return ALL_SOURCES.find(s => s.id === id)
}

export function isSourceId(id: string): id is SourceId {
  return SOURCE_IDS.includes(id as SourceId)
}

export type { OccurrenceSource, Occurrence, FetchContext } from './types'
