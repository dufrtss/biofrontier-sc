// Fetches GBIF occurrence records for Santa Catarina, aggregates to H3 hexbins,
// and writes public/data/hexbins.json.
// Prerequisite: public/data/habitat-by-hex.json (run data:habitat-fallback first)
// Run: npm run data:fetch
// Duration: ~5–15 min depending on record count and network.
import { writeFileSync, readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { occurrenceToHex, isInSCBounds, generateSCHexgrid, H3_RES6_AREA_KM2 } from '../src/lib/h3-utils'
import type { HexbinRecord, TaxonRecord, HexbinsFile } from '../src/lib/types'

const OUTPUT      = resolve('public/data/hexbins.json')
const HABITAT     = resolve('public/data/habitat-by-hex.json')
const GBIF_BASE   = 'https://api.gbif.org/v1'
const MAX_RECORDS = 50_000
const PAGE_SIZE   = 300

// classKey values in GBIF backbone taxonomy
const VERTEBRATE_CLASS_KEYS = new Set([359, 212, 358, 131, 204])
// Mammalia=359, Aves=212, Reptilia=358, Amphibia=131, Actinopterygii=204

interface RawOccurrence {
  decimalLatitude?: number
  decimalLongitude?: number
  species?: string
  classKey?: number
  recordedBy?: string
  eventDate?: string
}

async function fetchPage(offset: number): Promise<{ results: RawOccurrence[]; endOfRecords: boolean }> {
  const params = new URLSearchParams({
    country: 'BR',
    stateProvince: 'Santa Catarina',
    hasCoordinate: 'true',
    limit: String(PAGE_SIZE),
    offset: String(offset),
  })
  const res = await fetch(`${GBIF_BASE}/occurrence/search?${params}`)
  if (!res.ok) throw new Error(`GBIF ${res.status}: ${await res.text()}`)
  const json = await res.json()
  return { results: json.results, endOfRecords: json.endOfRecords }
}

async function fetchAll(): Promise<RawOccurrence[]> {
  const collected: RawOccurrence[] = []
  let offset = 0
  process.stdout.write('Fetching GBIF records')
  while (collected.length < MAX_RECORDS) {
    const { results, endOfRecords } = await fetchPage(offset)
    const valid = results.filter(r =>
      r.decimalLatitude != null &&
      r.decimalLongitude != null &&
      isInSCBounds(r.decimalLatitude, r.decimalLongitude)
    )
    collected.push(...valid)
    process.stdout.write(`\r  ${collected.length} records fetched...`)
    if (endOfRecords) break
    offset += PAGE_SIZE
    await new Promise(r => setTimeout(r, 200))  // stay well within GBIF rate limit
  }
  console.log()
  return collected.slice(0, MAX_RECORDS)
}

type HexAccumulator = {
  occurrenceCount: number
  species: Map<string, number>
  observers: Set<string>
  dates: Set<string>
  firstDate: string | null
  lastDate: string | null
}

function newAcc(): HexAccumulator {
  return { occurrenceCount: 0, species: new Map(), observers: new Set(), dates: new Set(), firstDate: null, lastDate: null }
}

function accToRecord(acc: HexAccumulator | undefined): TaxonRecord {
  if (!acc) return { occurrenceCount: 0, uniqueSpeciesCount: 0, uniqueObserverCount: 0, uniqueDateCount: 0, temporalSpanYears: 0, firstDate: null, lastDate: null, topSpecies: [] }
  const span = acc.firstDate && acc.lastDate
    ? Math.max(0, new Date(acc.lastDate).getFullYear() - new Date(acc.firstDate).getFullYear())
    : 0
  const topSpecies = [...acc.species.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }))
  return {
    occurrenceCount: acc.occurrenceCount,
    uniqueSpeciesCount: acc.species.size,
    uniqueObserverCount: acc.observers.size,
    uniqueDateCount: acc.dates.size,
    temporalSpanYears: span,
    firstDate: acc.firstDate,
    lastDate: acc.lastDate,
    topSpecies,
  }
}

async function main() {
  if (!existsSync(HABITAT)) {
    console.error(`Missing ${HABITAT}. Run: npm run data:habitat-fallback`)
    process.exit(1)
  }

  const habitatByHex: Record<string, number> = JSON.parse(readFileSync(HABITAT, 'utf-8'))
  const allHexIds = generateSCHexgrid()
  const records = await fetchAll()

  console.log('Aggregating to hexbins...')
  const allAcc  = new Map<string, HexAccumulator>()
  const vertAcc = new Map<string, HexAccumulator>()

  for (const r of records) {
    const hexId = occurrenceToHex(r.decimalLatitude!, r.decimalLongitude!)
    const isVert = r.classKey != null && VERTEBRATE_CLASS_KEYS.has(r.classKey)

    for (const [map, include] of [[allAcc, true], [vertAcc, isVert]] as const) {
      if (!include) continue
      if (!map.has(hexId)) map.set(hexId, newAcc())
      const acc = map.get(hexId)!
      acc.occurrenceCount++
      if (r.species) acc.species.set(r.species, (acc.species.get(r.species) ?? 0) + 1)
      if (r.recordedBy) acc.observers.add(r.recordedBy.slice(0, 60))
      const dateStr = r.eventDate?.slice(0, 10) ?? null
      if (dateStr) {
        acc.dates.add(dateStr)
        if (!acc.firstDate || dateStr < acc.firstDate) acc.firstDate = dateStr
        if (!acc.lastDate  || dateStr > acc.lastDate)  acc.lastDate  = dateStr
      }
    }
  }

  const hexbins: HexbinRecord[] = allHexIds.map(hexId => ({
    hexId,
    all:         accToRecord(allAcc.get(hexId)),
    vertebrates: accToRecord(vertAcc.get(hexId)),
    habitatQuality: habitatByHex[hexId] ?? 0,
  }))

  const output: HexbinsFile = {
    generatedAt: new Date().toISOString(),
    hexbinCount: hexbins.length,
    hexbins,
  }

  writeFileSync(OUTPUT, JSON.stringify(output))
  console.log(`Done. ${hexbins.length} hexbins written to ${OUTPUT}`)
}

main().catch(err => { console.error(err); process.exit(1) })
