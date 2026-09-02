/**
 * Joins `public/data/habitat-by-hex.json` onto `public/data/hexbins.json`,
 * replacing the `habitatQuality` each hexbin carries.
 *
 * Why this exists as its own step: habitat normally reaches `hexbins.json`
 * through `data:fetch`, which also re-downloads ~70k occurrences from GBIF and
 * iNaturalist. Re-running the whole pipeline to pick up a new land-cover
 * release would change the occurrence data and the habitat data in one commit,
 * leaving any shift in the ranking unattributable — and GBIF's rate limiting
 * has truncated the last two full runs, so a refetch also silently costs
 * records. This merges habitat alone, against the occurrences already on disk.
 *
 * Usage:
 *   npm run data:habitat-merge
 *   npm run data:habitat-merge -- --dry-run
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import type { HexbinsFile } from '../src/lib/types'

const HEXBINS = resolve('public/data/hexbins.json')
const HABITAT = resolve('public/data/habitat-by-hex.json')

const dryRun = process.argv.includes('--dry-run')

const file: HexbinsFile = JSON.parse(readFileSync(HEXBINS, 'utf-8'))
const habitatByHex: Record<string, number> = JSON.parse(readFileSync(HABITAT, 'utf-8'))

const recordsIn = (h: { taxa?: Record<string, { occurrenceCount: number }> }) =>
  h.taxa?.all?.occurrenceCount ?? 0

/**
 * A hexbin with no entry in the habitat file was never measured, which is not
 * the same as having been measured and found bare. Most are open Atlantic —
 * MapBiomas leaves sea unmapped — but the set also includes cells on the
 * Argentine border, where the land is real and simply outside a Brazil-only
 * mosaic.
 *
 * Such hexbins are dropped rather than defaulted to 0. `resolveActiveComponents`
 * decides once per dataset which components may score, deliberately never per
 * hexbin, so there is no way to express "habitat is unknown here" in a ranked
 * row: the choice is a fabricated number or no row. Keeping the grid to cells
 * that were all measured the same way is what makes the ranking comparable.
 */
const measured   = file.hexbins.filter(h => habitatByHex[h.hexId] !== undefined)
const unmeasured = file.hexbins.filter(h => habitatByHex[h.hexId] === undefined)

const merged = measured.map(h => ({ ...h, habitatQuality: habitatByHex[h.hexId] }))

const droppedWithRecords = unmeasured.filter(h => recordsIn(h) > 0)
const droppedRecords     = droppedWithRecords.reduce((sum, h) => sum + recordsIn(h), 0)
const totalRecords       = file.hexbins.reduce((sum, h) => sum + recordsIn(h), 0)

const values = merged.map(h => h.habitatQuality).sort((a, b) => a - b)
const pct = (v: number) => `${(v * 100).toFixed(1)}%`

console.log(`hexbins:  ${file.hexbins.length} → ${merged.length} (${unmeasured.length} unmeasured, dropped)`)
console.log(`  of those dropped, ${droppedWithRecords.length} held records:`)
console.log(`  ${droppedRecords} occurrences lost (${(droppedRecords / totalRecords * 100).toFixed(2)}% of ${totalRecords})`)
console.log(`habitat:  min ${pct(values[0])}  median ${pct(values[Math.floor(values.length / 2)])}  max ${pct(values[values.length - 1])}`)
console.log(`  distinct values: ${new Set(values).size} (1 would mean the placeholder is still in place)`)

if (dryRun) {
  console.log('\n--dry-run: nothing written')
  process.exit(0)
}

writeFileSync(HEXBINS, JSON.stringify({
  ...file,
  hexbinCount: merged.length,
  hexbins: merged,
}))
console.log(`\nDone → ${HEXBINS}`)
