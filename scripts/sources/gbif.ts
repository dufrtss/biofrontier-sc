/**
 * GBIF Occurrence API v1.
 *
 * The broadest single source: GBIF aggregates museum collections, herbaria,
 * research datasets and iNaturalist research-grade observations. Records
 * sourced from iNaturalist therefore appear here too, which the orchestrator's
 * deduplication handles.
 *
 * Docs: https://techdocs.gbif.org/en/openapi/v1/occurrence
 */

import { isInSCBounds } from '../../src/lib/h3-utils'
import { fetchJson, sleep, toIsoDate } from './http'
import type { FetchContext, Occurrence, OccurrenceSource } from './types'

const BASE = 'https://api.gbif.org/v1'
const PAGE_SIZE = 300

/**
 * Backstop for records that carry a backbone `classKey` but no `class` string.
 *
 * GBIF normally interprets both, so this rarely fires — it covers the five
 * classes the tool has always relied on, so a missing name cannot silently
 * drop a vertebrate out of every group filter.
 */
const CLASS_NAME_BY_KEY: Record<number, string> = {
  359: 'Mammalia',
  212: 'Aves',
  358: 'Reptilia',
  131: 'Amphibia',
  204: 'Actinopterygii',
}

interface RawOccurrence {
  decimalLatitude?: number
  decimalLongitude?: number
  species?: string
  class?: string
  classKey?: number
  recordedBy?: string
  eventDate?: string
}

interface SearchResponse {
  results: RawOccurrence[]
  endOfRecords: boolean
}

export const gbifSource: OccurrenceSource = {
  id: 'gbif',
  label: 'GBIF',

  isAvailable: () => ({ ok: true }),

  async fetchAll({ maxRecords, log }: FetchContext): Promise<Occurrence[]> {
    const collected: Occurrence[] = []
    let offset = 0
    let failedPages = 0

    while (collected.length < maxRecords) {
      const params = new URLSearchParams({
        country: 'BR',
        stateProvince: 'Santa Catarina',
        hasCoordinate: 'true',
        limit: String(PAGE_SIZE),
        offset: String(offset),
      })

      let page: SearchResponse
      try {
        page = await fetchJson<SearchResponse>(`${BASE}/occurrence/search?${params}`)
      } catch {
        failedPages++
        log(`${collected.length} records (page @${offset} skipped)`)
        offset += PAGE_SIZE
        if (failedPages > 10) {
          log('too many failed pages, stopping early')
          break
        }
        continue
      }

      for (const r of page.results) {
        if (r.decimalLatitude == null || r.decimalLongitude == null) continue
        if (!isInSCBounds(r.decimalLatitude, r.decimalLongitude)) continue

        collected.push({
          lat: r.decimalLatitude,
          lng: r.decimalLongitude,
          species: r.species ?? null,
          className: r.class ?? (r.classKey != null ? CLASS_NAME_BY_KEY[r.classKey] ?? null : null),
          observer: r.recordedBy?.slice(0, 60) ?? null,
          date: toIsoDate(r.eventDate),
          source: 'gbif',
        })
      }

      log(`${collected.length} records`)
      if (page.endOfRecords) break
      offset += PAGE_SIZE
      await sleep(200)
    }

    if (failedPages > 0) log(`warning: ${failedPages} pages skipped after retries`)
    return collected.slice(0, maxRecords)
  },
}
