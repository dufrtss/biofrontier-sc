/**
 * speciesLink (CRIA) — Brazilian biological collections network.
 *
 * The reason this source matters: speciesLink aggregates Brazilian museum and
 * herbarium specimen records, many of which are historical, taxonomically
 * authoritative, and never propagated to GBIF. For a tool about Brazilian
 * biodiversity gaps, records that exist only here are exactly the ones that
 * change the picture.
 *
 * Requires a free API key. Register at https://specieslink.net/ and export it:
 *
 *   export SPECIESLINK_API_KEY=your_key_here
 *
 * Without the key this source reports itself unavailable and the pipeline runs
 * without it rather than failing.
 *
 * Docs: https://specieslink.net/ws/1.0/
 */

import { isInSCBounds } from '../../src/lib/h3-utils'
import { fetchJson, sleep, toIsoDate } from './http'
import type { FetchContext, Occurrence, OccurrenceSource } from './types'

const BASE = 'https://specieslink.net/ws/1.0/search'
const PAGE_SIZE = 500

/** Vertebrate class names as they appear in speciesLink's Darwin Core `class` field. */
const VERTEBRATE_CLASSES = new Set([
  'mammalia', 'aves', 'reptilia', 'amphibia', 'actinopterygii',
  'chondrichthyes', 'osteichthyes',
])

interface RawRecord {
  decimallatitude?: string | number
  decimallongitude?: string | number
  scientificname?: string
  genus?: string
  specificepithet?: string
  class?: string
  recordedby?: string
  yearcollected?: string | number
  monthcollected?: string | number
  daycollected?: string | number
  eventdate?: string
}

interface SearchResponse {
  result?: RawRecord[]
}

function toNumber(value: string | number | undefined): number | null {
  if (value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

/**
 * speciesLink records often carry split date parts rather than an `eventdate`.
 * Reassembling them recovers a temporal span for specimens that would otherwise
 * look undated — and the temporal span feeds the survey effort score.
 */
function extractDate(r: RawRecord): string | null {
  const direct = toIsoDate(r.eventdate)
  if (direct) return direct

  const year = toNumber(r.yearcollected)
  if (!year || year < 1500 || year > 2100) return null
  const month = toNumber(r.monthcollected) ?? 1
  const day = toNumber(r.daycollected) ?? 1
  if (month < 1 || month > 12 || day < 1 || day > 31) return null

  const pad = (n: number) => String(n).padStart(2, '0')
  return `${year}-${pad(month)}-${pad(day)}`
}

/** Prefers an explicit binomial; falls back to genus + epithet. */
function extractSpecies(r: RawRecord): string | null {
  if (r.genus && r.specificepithet) return `${r.genus} ${r.specificepithet}`
  if (!r.scientificname) return null
  const parts = r.scientificname.trim().split(/\s+/)
  return parts.length >= 2 ? `${parts[0]} ${parts[1]}` : null
}

export const specieslinkSource: OccurrenceSource = {
  id: 'specieslink',
  label: 'speciesLink',

  isAvailable() {
    return process.env.SPECIESLINK_API_KEY
      ? { ok: true }
      : {
        ok: false,
        reason:
            'SPECIESLINK_API_KEY not set. Register free at https://specieslink.net/ ' +
            'and export the key to include Brazilian collection records.',
      }
  },

  async fetchAll({ maxRecords, log }: FetchContext): Promise<Occurrence[]> {
    const apiKey = process.env.SPECIESLINK_API_KEY
    if (!apiKey) return []

    const collected: Occurrence[] = []
    let offset = 0
    let failedPages = 0

    while (collected.length < maxRecords) {
      const params = new URLSearchParams({
        apikey: apiKey,
        stateprovince: 'Santa Catarina',
        country: 'Brasil',
        coordinates: 'yes',
        limit: String(PAGE_SIZE),
        offset: String(offset),
      })

      let page: SearchResponse
      try {
        page = await fetchJson<SearchResponse>(`${BASE}?${params}`)
      } catch (err) {
        failedPages++
        if (failedPages > 5) {
          log(`too many failed pages, stopping early (${(err as Error).message})`)
          break
        }
        offset += PAGE_SIZE
        continue
      }

      const records = page.result ?? []
      if (records.length === 0) break

      for (const r of records) {
        const lat = toNumber(r.decimallatitude)
        const lng = toNumber(r.decimallongitude)
        if (lat === null || lng === null || !isInSCBounds(lat, lng)) continue

        collected.push({
          lat,
          lng,
          species: extractSpecies(r),
          isVertebrate: VERTEBRATE_CLASSES.has((r.class ?? '').toLowerCase()),
          observer: r.recordedby?.slice(0, 60) ?? null,
          date: extractDate(r),
          source: 'specieslink',
        })
      }

      log(`${collected.length} records`)
      if (records.length < PAGE_SIZE) break
      offset += PAGE_SIZE
      await sleep(500)
    }

    if (failedPages > 0) log(`warning: ${failedPages} pages skipped after retries`)
    return collected.slice(0, maxRecords)
  },
}
