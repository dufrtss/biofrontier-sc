/**
 * iNaturalist API v1.
 *
 * Restricted to research-grade observations: those with a community-verified
 * identification, a date, and coordinates. Casual-grade records are excluded —
 * their identifications are unverified, and feeding them into a tool whose
 * output is meant to guide fieldwork would undermine the point.
 *
 * Docs: https://api.inaturalist.org/v1/docs/
 */

import { SC_BBOX, isInSCBounds } from '../../src/lib/h3-utils'
import { fetchJson, sleep, toIsoDate } from './http'
import type { FetchContext, Occurrence, OccurrenceSource } from './types'

const BASE = 'https://api.inaturalist.org/v1'

/** iNaturalist caps `per_page` at 200. */
const PAGE_SIZE = 200

interface RawObservation {
  id: number
  observed_on: string | null
  location: string | null
  taxon: {
    name?: string
    rank?: string
    iconic_taxon_name?: string
  } | null
  user: { login?: string } | null
}

interface ObservationsResponse {
  total_results: number
  results: RawObservation[]
}

/** Parses iNaturalist's `"lat,lng"` location string. */
function parseLocation(location: string | null): { lat: number; lng: number } | null {
  if (!location) return null
  const [latStr, lngStr] = location.split(',')
  const lat = Number(latStr)
  const lng = Number(lngStr)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}

export const inaturalistSource: OccurrenceSource = {
  id: 'inaturalist',
  label: 'iNaturalist',

  isAvailable: () => ({ ok: true }),

  async fetchAll({ maxRecords, log }: FetchContext): Promise<Occurrence[]> {
    const collected: Occurrence[] = []

    // Paginating with `id_above` rather than `page`: iNaturalist refuses to
    // serve results past the 10,000th via page offsets, and the SC bounding box
    // holds well over 100k research-grade observations.
    let idAbove = 0
    let failedPages = 0

    while (collected.length < maxRecords) {
      const params = new URLSearchParams({
        nelat: String(SC_BBOX.north),
        nelng: String(SC_BBOX.east),
        swlat: String(SC_BBOX.south),
        swlng: String(SC_BBOX.west),
        quality_grade: 'research',
        per_page: String(PAGE_SIZE),
        order_by: 'id',
        order: 'asc',
        id_above: String(idAbove),
      })

      let page: ObservationsResponse
      try {
        page = await fetchJson<ObservationsResponse>(`${BASE}/observations?${params}`)
      } catch {
        failedPages++
        if (failedPages > 5) {
          log('too many failed pages, stopping early')
          break
        }
        log(`${collected.length} records (page after id ${idAbove} failed, retrying window)`)
        await sleep(3000)
        continue
      }

      if (page.results.length === 0) break

      for (const obs of page.results) {
        idAbove = Math.max(idAbove, obs.id)

        const coords = parseLocation(obs.location)
        if (!coords || !isInSCBounds(coords.lat, coords.lng)) continue

        // Genus-level and coarser identifications carry no species signal, and
        // counting them would inflate the "unique species" figures.
        const isSpeciesLevel = obs.taxon?.rank === 'species'

        collected.push({
          lat: coords.lat,
          lng: coords.lng,
          species: isSpeciesLevel ? obs.taxon?.name ?? null : null,
          // `iconic_taxon_name` is iNaturalist's coarse grouping and is almost
          // always a class name (`Aves`, `Insecta`); `Mollusca` is a phylum and
          // `Animalia` too coarse to group, both handled in `taxonomy.ts`.
          className: obs.taxon?.iconic_taxon_name ?? null,
          observer: obs.user?.login?.slice(0, 60) ?? null,
          date: toIsoDate(obs.observed_on),
          source: 'inaturalist',
        })
      }

      log(`${collected.length} records`)
      await sleep(1000)  // iNaturalist asks for =< 1 request/second sustained.
    }

    if (failedPages > 0) log(`warning: ${failedPages} pages skipped after retries`)
    return collected.slice(0, maxRecords)
  },
}
