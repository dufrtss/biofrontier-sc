// Generates a uniform habitat score of 0.5 for all SC hexbins.
// Use when the real Atlantic Forest GeoJSON is not yet available.
// Run: npm run data:habitat-fallback
import { writeFileSync } from 'fs'
import { resolve } from 'path'
import { generateSCHexgrid } from '../src/lib/h3-utils'

const OUTPUT = resolve('public/data/habitat-by-hex.json')
const hexIds = generateSCHexgrid()
const result: Record<string, number> = {}
hexIds.forEach(id => { result[id] = 0.5 })
writeFileSync(OUTPUT, JSON.stringify(result))
console.log(`Written ${hexIds.length} hexbins with habitat=0.5 (fallback) → ${OUTPUT}`)
