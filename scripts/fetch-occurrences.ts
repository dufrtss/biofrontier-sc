/**
 * Builds `public/data/hexbins.json` — the single data file the app loads.
 *
 * Fetches occurrence records from every selected source, deduplicates across
 * them, aggregates to H3 hexbins, and writes a schema v2 file with a global
 * species index.
 *
 * Prerequisite: `public/data/habitat-by-hex.json` (`npm run data:habitat` for
 * real forest cover, or `npm run data:habitat-fallback` for the placeholder).
 *
 * Usage:
 *   npm run data:fetch
 *   npm run data:fetch -- --sources=gbif
 *   npm run data:fetch -- --sources=gbif,inaturalist --max-per-source=100000
 *   npm run data:fetch -- --list-sources
 *
 * Duration: minutes to tens of minutes depending on sources and record cap.
 */
import { writeFileSync, readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { occurrenceToHex, generateSCHexgrid } from '../src/lib/h3-utils'
import type {
  HexbinRecord,
  HexbinsFile,
  SourceId,
  SourceMeta,
  TaxonRecord,
} from '../src/lib/types'
import { CURRENT_SCHEMA_VERSION } from '../src/lib/hexbins-file'
import { ALL_SOURCES, getSource, isSourceId } from './sources'
import { dedupeOccurrences } from './sources/dedup'
import type { Occurrence } from './sources/types'

const OUTPUT  = resolve('public/data/hexbins.json')
const HABITAT = resolve('public/data/habitat-by-hex.json')

/** Cap applied to each source independently, not to the combined total. */
const DEFAULT_MAX_PER_SOURCE = 50_000
const DEFAULT_SOURCES: SourceId[] = ['gbif', 'inaturalist']

interface CliOptions {
  sources: SourceId[]
  /** Per-source cap. Each adapter applies it independently. */
  maxPerSource: number
  listSources: boolean
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    sources: DEFAULT_SOURCES,
    maxPerSource: DEFAULT_MAX_PER_SOURCE,
    listSources: false,
  }

  for (const arg of argv) {
    if (arg === '--list-sources') {
      options.listSources = true
    } else if (arg.startsWith('--sources=')) {
      const requested = arg.slice('--sources='.length).split(',').map(s => s.trim()).filter(Boolean)
      const invalid = requested.filter(s => !isSourceId(s))
      if (invalid.length > 0) {
        console.error(
          `Unknown source(s): ${invalid.join(', ')}\n` +
          `Available: ${ALL_SOURCES.map(s => s.id).join(', ')}`,
        )
        process.exit(1)
      }
      options.sources = requested as SourceId[]
    } else if (arg.startsWith('--max-per-source=') || arg.startsWith('--max=')) {
      const n = Number(arg.slice(arg.indexOf('=') + 1))
      if (!Number.isFinite(n) || n <= 0) {
        console.error(`--max-per-source must be a positive number, got: ${arg}`)
        process.exit(1)
      }
      options.maxPerSource = n
    } else if (arg.startsWith('--')) {
      console.error(`Unknown flag: ${arg}`)
      process.exit(1)
    }
  }

  return options
}

function listSources(): void {
  console.log('Available occurrence sources:\n')
  for (const source of ALL_SOURCES) {
    const availability = source.isAvailable()
    const status = availability.ok ? 'ready' : 'unavailable'
    console.log(`  ${source.id.padEnd(13)} ${source.label.padEnd(14)} [${status}]`)
    if (!availability.ok) console.log(`  ${' '.repeat(13)} ${availability.reason}`)
  }
  console.log(`\nDefault: --sources=${DEFAULT_SOURCES.join(',')}`)
  console.log(`--max-per-source applies to each source independently (default ${DEFAULT_MAX_PER_SOURCE}).`)
}

// ─── Aggregation ─────────────────────────────────────────────────────────────

interface HexAccumulator {
  occurrenceCount: number
  /** speciesId → record count. */
  species: Map<number, number>
  observers: Set<string>
  dates: Set<string>
  firstDate: string | null
  lastDate: string | null
  countsBySource: Partial<Record<SourceId, number>>
}

function newAccumulator(): HexAccumulator {
  return {
    occurrenceCount: 0,
    species: new Map(),
    observers: new Set(),
    dates: new Set(),
    firstDate: null,
    lastDate: null,
    countsBySource: {},
  }
}

function accumulate(acc: HexAccumulator, record: Occurrence, speciesId: number | null): void {
  acc.occurrenceCount++
  acc.countsBySource[record.source] = (acc.countsBySource[record.source] ?? 0) + 1

  if (speciesId !== null) {
    acc.species.set(speciesId, (acc.species.get(speciesId) ?? 0) + 1)
  }
  if (record.observer) acc.observers.add(record.observer)
  if (record.date) {
    acc.dates.add(record.date)
    if (!acc.firstDate || record.date < acc.firstDate) acc.firstDate = record.date
    if (!acc.lastDate  || record.date > acc.lastDate)  acc.lastDate  = record.date
  }
}

/**
 * Built fresh per call rather than spread from a shared constant: a shallow
 * copy would leave all ~5,900 empty hexbins sharing one `topSpecies`,
 * `speciesIds` and `countsBySource` instance, so a single downstream push or
 * assignment would mutate every empty hexbin at once.
 */
function emptyTaxonRecord(): TaxonRecord {
  return {
    occurrenceCount: 0,
    uniqueSpeciesCount: 0,
    uniqueObserverCount: 0,
    uniqueDateCount: 0,
    temporalSpanYears: 0,
    firstDate: null,
    lastDate: null,
    topSpecies: [],
    speciesIds: [],
    countsBySource: {},
  }
}

function toTaxonRecord(acc: HexAccumulator | undefined, speciesIndex: string[]): TaxonRecord {
  if (!acc) return emptyTaxonRecord()

  const span = acc.firstDate && acc.lastDate
    ? Math.max(0, new Date(acc.lastDate).getFullYear() - new Date(acc.firstDate).getFullYear())
    : 0

  const topSpecies = [...acc.species.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id, count]) => ({ name: speciesIndex[id], count }))

  return {
    occurrenceCount: acc.occurrenceCount,
    uniqueSpeciesCount: acc.species.size,
    uniqueObserverCount: acc.observers.size,
    uniqueDateCount: acc.dates.size,
    temporalSpanYears: span,
    firstDate: acc.firstDate,
    lastDate: acc.lastDate,
    topSpecies,
    speciesIds: [...acc.species.keys()],
    countsBySource: acc.countsBySource,
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))

  if (options.listSources) {
    listSources()
    return
  }

  if (!existsSync(HABITAT)) {
    console.error(`Missing ${HABITAT}\nRun: npm run data:habitat-fallback`)
    process.exit(1)
  }

  const habitatByHex: Record<string, number> = JSON.parse(readFileSync(HABITAT, 'utf-8'))
  const allHexIds = generateSCHexgrid()

  // ── Fetch ──
  const allRecords: Occurrence[] = []
  const sourceMeta: SourceMeta[] = []

  for (const sourceId of options.sources) {
    const source = getSource(sourceId)!
    const availability = source.isAvailable()

    if (!availability.ok) {
      console.warn(`\n⚠ Skipping ${source.label}: ${availability.reason}`)
      continue
    }

    console.log(`\nFetching from ${source.label}...`)
    const started = Date.now()

    const records = await source.fetchAll({
      maxRecords: options.maxPerSource,
      log: message => process.stdout.write(`\r  ${message}`.padEnd(72)),
    })

    process.stdout.write('\n')
    console.log(`  ${records.length} records in ${((Date.now() - started) / 1000).toFixed(1)}s`)

    allRecords.push(...records)
    sourceMeta.push({
      id: sourceId,
      recordCount: records.length,
      duplicatesDropped: 0,  // filled in after deduplication
      fetchedAt: new Date().toISOString(),
    })
  }

  if (allRecords.length === 0) {
    console.error('\nNo records fetched from any source. Aborting without writing output.')
    process.exit(1)
  }

  // ── Deduplicate ──
  console.log(`\nDeduplicating ${allRecords.length} records across sources...`)
  const { records, droppedBySource } = dedupeOccurrences(allRecords)
  for (const meta of sourceMeta) {
    meta.duplicatesDropped = droppedBySource[meta.id] ?? 0
  }
  const dropped = allRecords.length - records.length
  console.log(`  ${records.length} unique (${dropped} duplicates dropped)`)
  for (const meta of sourceMeta) {
    if (meta.duplicatesDropped > 0) {
      console.log(`    ${meta.id}: ${meta.duplicatesDropped} dropped as already seen`)
    }
  }

  // ── Aggregate ──
  console.log('\nAggregating to hexbins...')
  const speciesIndex: string[] = []
  const speciesIdByName = new Map<string, number>()

  const internSpecies = (name: string | null): number | null => {
    if (!name) return null
    let id = speciesIdByName.get(name)
    if (id === undefined) {
      id = speciesIndex.length
      speciesIndex.push(name)
      speciesIdByName.set(name, id)
    }
    return id
  }

  const allAcc  = new Map<string, HexAccumulator>()
  const vertAcc = new Map<string, HexAccumulator>()

  for (const record of records) {
    const hexId = occurrenceToHex(record.lat, record.lng)
    const speciesId = internSpecies(record.species)

    for (const [map, include] of [[allAcc, true], [vertAcc, record.isVertebrate]] as const) {
      if (!include) continue
      let acc = map.get(hexId)
      if (!acc) { acc = newAccumulator(); map.set(hexId, acc) }
      accumulate(acc, record, speciesId)
    }
  }

  const hexbins: HexbinRecord[] = allHexIds.map(hexId => ({
    hexId,
    all:            toTaxonRecord(allAcc.get(hexId), speciesIndex),
    vertebrates:    toTaxonRecord(vertAcc.get(hexId), speciesIndex),
    habitatQuality: habitatByHex[hexId] ?? 0,
  }))

  const output: HexbinsFile = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    hexbinCount: hexbins.length,
    speciesIndex,
    sources: sourceMeta,
    hexbins,
  }

  writeFileSync(OUTPUT, JSON.stringify(output))

  const populated = hexbins.filter(h => h.all.occurrenceCount > 0).length
  console.log(`\nDone → ${OUTPUT}`)
  console.log(`  ${hexbins.length} hexbins (${populated} with records)`)
  console.log(`  ${speciesIndex.length} unique species`)
  console.log(`  sources: ${sourceMeta.map(s => `${s.id} (${s.recordCount})`).join(', ')}`)
}

main().catch(err => { console.error(err); process.exit(1) })
