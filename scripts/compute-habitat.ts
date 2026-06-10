// Computes per-hexbin Atlantic Forest coverage fraction from a GeoJSON polygon file.
// Prerequisite: download sc-atlantic-forest.geojson and place at public/data/sc-atlantic-forest.geojson
//
// Data sources (choose one):
//   SOS Mata Atlântica: https://www.sosma.org.br/link-direto/dados-mata-atlantica/
//   MapBiomas Collection (free account): https://mapbiomas.org/en/download
//   IBGE Biomes: https://www.ibge.gov.br/geociencias/informacoes-ambientais/vegetacao/15842-biomas.html
//
// Run: npm run data:habitat
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import * as turf from '@turf/turf'
import { generateSCHexgrid, hexBoundary } from '../src/lib/h3-utils'

const FOREST_PATH = resolve('public/data/sc-atlantic-forest.geojson')
const OUTPUT      = resolve('public/data/habitat-by-hex.json')

function main() {
  if (!existsSync(FOREST_PATH)) {
    console.error(`Missing: ${FOREST_PATH}\nDownload the GeoJSON first — see file header for sources.`)
    process.exit(1)
  }

  const geojson = JSON.parse(readFileSync(FOREST_PATH, 'utf-8'))
  const forestFeatures: turf.Feature[] = geojson.type === 'FeatureCollection'
    ? geojson.features
    : [geojson]

  const hexIds = generateSCHexgrid()
  const result: Record<string, number> = {}
  let processed = 0

  for (const hexId of hexIds) {
    const boundary = hexBoundary(hexId)
    // hexBoundary returns [lat, lng]; GeoJSON/turf needs [lng, lat]
    const ring = [...boundary.map(([lat, lng]) => [lng, lat] as [number, number])]
    ring.push(ring[0])  // close the ring
    const hexPoly = turf.polygon([ring])
    const hexAreaM2 = turf.area(hexPoly)

    let intersectM2 = 0
    for (const feature of forestFeatures) {
      try {
        const intersection = turf.intersect(
          turf.featureCollection([hexPoly, feature as turf.Feature<turf.Polygon | turf.MultiPolygon>])
        )
        if (intersection) intersectM2 += turf.area(intersection)
      } catch {
        // skip invalid geometry
      }
    }

    result[hexId] = Math.min(1, intersectM2 / hexAreaM2)
    processed++
    if (processed % 100 === 0) process.stdout.write(`\r${processed}/${hexIds.length}`)
  }

  writeFileSync(OUTPUT, JSON.stringify(result))
  console.log(`\nDone. Written ${hexIds.length} hexbins → ${OUTPUT}`)
}

main()
