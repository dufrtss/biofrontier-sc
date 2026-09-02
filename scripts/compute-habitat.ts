/**
 * Computes per-hexbin native forest cover for Santa Catarina from MapBiomas,
 * writing `public/data/habitat-by-hex.json` — the habitat component of the
 * frontier score.
 *
 * Reads MapBiomas Brazil land-cover directly over HTTP: the annual mosaics are
 * cloud-optimised GeoTIFFs in a public bucket, so only the tiles covering SC
 * are transferred (~5% of a 750 MB national raster) and nothing has to be
 * downloaded by hand first. The earlier version of this script expected an
 * Atlantic Forest remnants GeoJSON that nobody could fetch without an account,
 * which is why every hexbin carried the uniform placeholder for months.
 *
 * Usage:
 *   npm run data:habitat
 *   npm run data:habitat -- --year=2024
 *
 * Duration: a few minutes, network-bound.
 */
import { writeFileSync } from 'fs'
import { resolve } from 'path'
import { fromUrl } from 'geotiff'
import { latLngToCell } from 'h3-js'
import { generateSCHexgrid, SC_BBOX, SC_RESOLUTION } from '../src/lib/h3-utils'
import { HABITAT_SOURCE, habitatRasterUrl } from '../src/lib/habitat-source'

const OUTPUT = resolve('public/data/habitat-by-hex.json')

/**
 * The release the app documents in its methodology panel. `--year` overrides it
 * for a one-off comparison against an earlier mosaic; regenerating the bundled
 * data for a different year means editing `src/lib/habitat-source.ts`, so the
 * two cannot drift apart.
 */
const DEFAULT_YEAR = HABITAT_SOURCE.year

/**
 * MapBiomas classes counted as habitat: native forest formations.
 *
 * The exclusion that matters here is class 9, forest plantation — SC's planalto
 * carries large pine and eucalyptus stands, and a generic tree-cover product
 * (Hansen, ESA WorldCover) would score those identically to old-growth Atlantic
 * Forest. Distinguishing them is the reason this uses MapBiomas at all.
 *
 * Natural non-forest vegetation is also excluded: SC's highland grasslands
 * (campos de altitude) are genuine habitat, but the frontier score defines this
 * component as Atlantic Forest cover, and quietly widening it here would leave
 * the published methodology describing something the data no longer is. A
 * broader "native vegetation" variant belongs in scoring-config, not in a
 * silent edit to this set.
 *
 * 3 Forest Formation · 4 Savanna Formation · 5 Mangrove · 6 Floodable Forest ·
 * 49 Wooded Sandbank Vegetation (restinga arbórea)
 */
const NATIVE_FOREST_CLASSES = new Set([3, 4, 5, 6, 49])

/** MapBiomas writes 0 outside the mapped area — ocean, and beyond the border. */
const NO_DATA = 0

/**
 * Sample every 4th pixel in each direction: 120 m spacing, ~2,500 samples per
 * 36 km² hexbin, which pins a coverage fraction to well under a percentage
 * point. Reading every pixel would mean 267 million H3 lookups for a precision
 * the score cannot use — the tiles are fetched either way, so the stride costs
 * nothing in transfer.
 */
const SAMPLE_STRIDE = 4

/** Rows per read. 512 × ~20,600 px ≈ 10 MB per strip, two tile rows at a time. */
const STRIP_ROWS = 512

/**
 * Concurrent range requests and their byte size.
 *
 * geotiff issues one request per block and will happily open a hundred at once,
 * which the bucket answers with connect timeouts rather than data. Fewer, larger
 * blocks read the same bytes in a fraction of the requests — COG tiles are laid
 * out row-major, so a 4 MB block spans a whole run of horizontally adjacent
 * tiles and the strip loop below consumes them in exactly that order.
 */
const MAX_CONCURRENT_REQUESTS = 6
const BLOCK_BYTES = 4 << 20

/**
 * Hexbins on the bounding box edge extend past it, so the raster window is
 * padded by more than one hexbin's width (~7 km). Without this those hexbins
 * would be scored on the fraction of themselves that happens to fall inside the
 * box — an artefact that looks exactly like sparse forest.
 */
const PAD_DEG = 0.1

/**
 * `fetch` with a concurrency cap, a generous timeout and retries, handed to
 * geotiff so every range request it makes goes through it. A single dropped
 * request would otherwise abort a read that is minutes in.
 */
function throttledFetch(): typeof fetch {
  let active = 0
  const waiting: Array<() => void> = []

  const release = () => {
    active--
    waiting.shift()?.()
  }

  return async (input, init) => {
    if (active >= MAX_CONCURRENT_REQUESTS) {
      await new Promise<void>(resolve => waiting.push(resolve))
    }
    active++

    try {
      let lastError: unknown
      for (let attempt = 1; attempt <= 4; attempt++) {
        try {
          return await fetch(input, { ...init, signal: AbortSignal.timeout(120_000) })
        } catch (err) {
          lastError = err
          if (attempt < 4) await new Promise(r => setTimeout(r, 1000 * attempt))
        }
      }
      throw lastError
    } finally {
      release()
    }
  }
}

interface CliOptions {
  year: number
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { year: DEFAULT_YEAR }

  for (const arg of argv) {
    if (arg.startsWith('--year=')) {
      const year = Number(arg.slice('--year='.length))
      if (!Number.isInteger(year) || year < 1985 || year > DEFAULT_YEAR) {
        console.error(`Invalid --year: ${arg.slice('--year='.length)} (1985–${DEFAULT_YEAR})`)
        process.exit(1)
      }
      options.year = year
    } else {
      console.error(`Unknown argument: ${arg}`)
      process.exit(1)
    }
  }

  return options
}

/** Per-hexbin tallies: sampled land pixels, and how many were native forest. */
interface Tally {
  sampled: number
  forest: number
}

async function main(): Promise<void> {
  const { year } = parseArgs(process.argv.slice(2))
  const url = habitatRasterUrl(year)

  console.log(`MapBiomas ${HABITAT_SOURCE.collectionLabel} coverage ${year}`)
  console.log(`  ${url}`)

  // Checked up front: geotiff surfaces a missing object as a parse failure
  // deep in a range read, which reads like a corrupt file rather than a year
  // MapBiomas has not published.
  const head = await fetch(url, { method: 'HEAD' })
  if (!head.ok) {
    console.error(`\nMapBiomas returned HTTP ${head.status} for that raster.`)
    console.error('Check the year — the collection may not cover it yet.')
    process.exit(1)
  }

  const tiff = await fromUrl(url, {
    blockSize: BLOCK_BYTES,
    cacheSize: 64,
    fetch: throttledFetch(),
  })
  const image = await tiff.getImage(0)
  const [originLng, , , originLat] = image.getBoundingBox()
  const [resLng, resLat] = image.getResolution()  // resLat is negative: y grows south

  // Pixel window covering the padded SC bounding box.
  const toCol = (lng: number) => Math.floor((lng - originLng) / resLng)
  const toRow = (lat: number) => Math.floor((lat - originLat) / resLat)
  const colStart = Math.max(0, toCol(SC_BBOX.west - PAD_DEG))
  const colEnd   = Math.min(image.getWidth(), toCol(SC_BBOX.east + PAD_DEG) + 1)
  const rowStart = Math.max(0, toRow(SC_BBOX.north + PAD_DEG))
  const rowEnd   = Math.min(image.getHeight(), toRow(SC_BBOX.south - PAD_DEG) + 1)
  const windowWidth = colEnd - colStart

  const hexIds = generateSCHexgrid()
  const tallies = new Map<string, Tally>(hexIds.map(id => [id, { sampled: 0, forest: 0 }]))

  console.log(`  window ${windowWidth} × ${rowEnd - rowStart} px over ${hexIds.length} hexbins`)

  const started = Date.now()
  let strips = 0

  for (let row = rowStart; row < rowEnd; row += STRIP_ROWS) {
    const stripEnd = Math.min(row + STRIP_ROWS, rowEnd)

    // Retried as a unit: one dropped tile request should not throw away the
    // strips already tallied, and re-reading a strip is idempotent because the
    // tallies for it have not been written yet.
    let band: Uint8Array | undefined
    for (let attempt = 1; attempt <= 3 && !band; attempt++) {
      try {
        const rasters = await image.readRasters({ window: [colStart, row, colEnd, stripEnd] })
        band = (rasters as unknown as Uint8Array[])[0]
      } catch (err) {
        if (attempt === 3) throw err
        console.warn(`\n  strip @${row} failed (${err}); retrying`)
      }
    }

    for (let y = 0; y < stripEnd - row; y += SAMPLE_STRIDE) {
      // Pixel centre, so a sample is never ambiguous between two hexbins.
      const lat = originLat + (row + y + 0.5) * resLat
      const rowOffset = y * windowWidth

      for (let x = 0; x < windowWidth; x += SAMPLE_STRIDE) {
        const value = band![rowOffset + x]
        if (value === NO_DATA) continue

        const lng = originLng + (colStart + x + 0.5) * resLng
        const tally = tallies.get(latLngToCell(lat, lng, SC_RESOLUTION))
        if (!tally) continue  // outside the SC grid — the window is padded

        tally.sampled++
        if (NATIVE_FOREST_CLASSES.has(value)) tally.forest++
      }
    }

    strips++
    const done = stripEnd - rowStart
    process.stdout.write(
      `\r  ${done}/${rowEnd - rowStart} rows (${((Date.now() - started) / 1000).toFixed(0)}s)`,
    )
  }

  process.stdout.write('\n')

  // Fraction of *land* rather than of hexbin area: coastal hexbins are mostly
  // ocean, which MapBiomas leaves unmapped, and scoring them against their full
  // area would report the sea as deforestation.
  //
  // Hexbins with no land at all are omitted rather than written as 0. The
  // pipeline reads a missing entry as 0 either way, but the file should not
  // claim to have measured open ocean and found it deforested — a downtown
  // hexbin that genuinely holds no native forest is a different statement.
  const byHex: Record<string, number> = {}
  for (const [hexId, { sampled, forest }] of tallies) {
    if (sampled > 0) byHex[hexId] = forest / sampled
  }

  writeFileSync(OUTPUT, JSON.stringify(byHex))

  const values = Object.values(byHex)
  const sorted = [...values].sort((a, b) => a - b)
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length

  console.log(`\nDone → ${OUTPUT}`)
  console.log(`  ${values.length} hexbins with land, ${tallies.size - values.length} all ocean (omitted)`)
  console.log(`  forest cover: mean ${(mean * 100).toFixed(1)}%` +
              ` · median ${(sorted[Math.floor(sorted.length / 2)] * 100).toFixed(1)}%` +
              ` · max ${(sorted[sorted.length - 1] * 100).toFixed(1)}%`)
  console.log(`  read in ${strips} strips over ${((Date.now() - started) / 1000).toFixed(0)}s`)
  console.log('\nRe-run npm run data:fetch to fold these values into hexbins.json.')
}

main().catch(err => { console.error(err); process.exit(1) })
