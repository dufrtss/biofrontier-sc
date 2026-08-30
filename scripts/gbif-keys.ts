/**
 * Resolves species names to GBIF backbone usage keys, so the app can link a
 * species straight to its page on gbif.org.
 *
 * Why keys at all: `gbif.org/species/search?q=<name>` — the obvious link — is
 * broken upstream. GBIF redirects it to `/taxon/search` and drops the query on
 * the way, landing the reader on an empty search form. A usage key does resolve:
 * `gbif.org/species/<key>` serves the taxon page itself. See `src/lib/gbif.ts`.
 *
 * `npm run data:fetch` calls this at the end of a run. Running it standalone
 * backfills an existing `public/data/hexbins.json` in place, which is what an
 * older file needs — the alternative being a full multi-hour refetch to add one
 * array:
 *
 *   npm run data:gbif-keys
 *
 * Duration: a few minutes for ~8,000 names.
 */
import { writeFileSync, readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import type { HexbinsFile } from '../src/lib/types'
import { CURRENT_SCHEMA_VERSION } from '../src/lib/hexbins-file'
import { fetchJson } from './sources/http'

const OUTPUT = resolve('public/data/hexbins.json')
const BASE = 'https://api.gbif.org/v1'

/**
 * Parallel name lookups. GBIF's match endpoint is a cheap in-memory lookup on
 * their side, but this is still a free public API — eight in flight keeps a
 * full run to a few minutes without behaving like a scraper.
 */
const CONCURRENCY = 8

interface MatchResponse {
  usageKey?: number
  /** `EXACT`, `FUZZY`, `HIGHERRANK` or `NONE`. */
  matchType?: string
  rank?: string
}

/**
 * The usage key for one name, or null when the backbone has no confident match.
 *
 * `strict=true` suppresses GBIF's fuzzy matching, and `HIGHERRANK` results are
 * discarded: both resolve an unrecognised binomial to its genus or family,
 * which would link the reader to a page for a different taxon than the one they
 * clicked — worse than the search fallback, because it looks right.
 */
async function matchName(name: string): Promise<number | null> {
  const params = new URLSearchParams({ name, strict: 'true' })
  const match = await fetchJson<MatchResponse>(
    `${BASE}/species/match?${params}`,
    { timeoutMs: 30_000, maxAttempts: 3 },
  )

  if (!match.usageKey) return null
  if (match.matchType === 'NONE' || match.matchType === 'HIGHERRANK') return null
  return match.usageKey
}

/**
 * Resolves every name to a usage key, in index order, with unmatched names —
 * and names whose lookup failed outright — left as null. A failed lookup is not
 * fatal: the app falls back to a GBIF search link for that species, and the next
 * run picks it up.
 */
export async function resolveGbifKeys(
  names: string[],
  log: (message: string) => void = () => {},
): Promise<Array<number | null>> {
  const keys: Array<number | null> = new Array(names.length).fill(null)
  let next = 0
  let done = 0
  let failed = 0

  const worker = async () => {
    while (true) {
      const i = next++
      if (i >= names.length) return

      try {
        keys[i] = await matchName(names[i])
      } catch {
        failed++
      }

      done++
      if (done % 250 === 0 || done === names.length) {
        log(`${done}/${names.length} names resolved`)
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker))

  const matched = keys.filter(k => k !== null).length
  log(`${matched}/${names.length} matched to GBIF taxa` +
      (failed > 0 ? `, ${failed} lookups failed` : ''))

  return keys
}

async function main() {
  if (!existsSync(OUTPUT)) {
    console.error(`${OUTPUT} not found. Run npm run data:fetch first.`)
    process.exit(1)
  }

  const file = JSON.parse(readFileSync(OUTPUT, 'utf-8')) as HexbinsFile
  if (!file.speciesIndex?.length) {
    console.error(
      'This data file carries no species index (schema v1). ' +
      'Regenerate it with npm run data:fetch — there are no names here to resolve.',
    )
    process.exit(1)
  }

  console.log(`Resolving ${file.speciesIndex.length} species names against the GBIF backbone...`)
  const speciesKeys = await resolveGbifKeys(file.speciesIndex, m => console.log(`  ${m}`))

  // Stamped v4 because that is exactly what the file now is: a v2/v3 file plus
  // the key array. Nothing else about it changes, and the reader keys off the
  // presence of `speciesKeys` rather than the version anyway.
  writeFileSync(OUTPUT, JSON.stringify({
    ...file,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    speciesKeys,
  }))
  console.log(`\nDone → ${OUTPUT}`)
}

// Only when run directly: `data:fetch` imports resolveGbifKeys from here.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => { console.error(err); process.exit(1) })
}
