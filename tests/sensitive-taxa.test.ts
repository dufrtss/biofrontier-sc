import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { resolve } from 'path'
import { cellToParent, latLngToCell } from 'h3-js'
import { SENSITIVE_LOCATIONS, taxonNameKey } from '@/lib/sensitive-taxa'
import { reviewableLocationFilter } from '@/lib/community'
import { communityMarkerStyle, communityPopupHtml } from '@/features/map/community-marker'
import type { ApprovedSubmission } from '@/lib/community'

const MIGRATIONS = resolve(__dirname, '../supabase/migrations')
const readMigration = (suffix: string) => {
  const file = readdirSync(MIGRATIONS).find(f => f.endsWith(suffix))
  if (!file) throw new Error(`no migration ending ${suffix}`)
  return readFileSync(resolve(MIGRATIONS, file), 'utf8')
}

describe('taxonNameKey', () => {
  // The same cases were run against public.taxon_name_key in SQL; the two
  // must agree or a name obscured on one side is exact on the other.
  it.each([
    ['Leopardus guttulus', 'leopardus guttulus'],
    ['  Leopardus   guttulus  ', 'leopardus guttulus'],
    ['Leopardus guttulus (Hensel, 1872)', 'leopardus guttulus'],
    ['Aphelandra margaritae É.Morren', 'aphelandra margaritae'],
    ['Amazona pretrei pretrei', 'amazona pretrei'],
    ['Leopardus cf. guttulus', 'leopardus guttulus'],
    ['Leopardus aff. guttulus', 'leopardus guttulus'],
    ['Leopardus (Oncifelis) guttulus', 'leopardus guttulus'],
    ['LEOPARDUS GUTTULUS', 'leopardus guttulus'],
  ])('keys %j as %j', (name, key) => {
    expect(taxonNameKey(name)).toBe(key)
  })

  it.each([['Leopardus sp.'], ['Leopardus spp.'], ['Leopardus'], [''], [null], [undefined]])(
    'gives %j no key, so it is shown exactly',
    name => { expect(taxonNameKey(name)).toBeNull() },
  )
})

describe('migrations agree with SENSITIVE_LOCATIONS', () => {
  it('snaps to the resolution the client computes parents at', () => {
    const sql = readMigration('_obscure_sensitive_locations.sql')
    expect(SENSITIVE_LOCATIONS.resolution).toBe(5)
    expect(sql).toContain(`(${SENSITIVE_LOCATIONS.resolution}::bigint << 52)`)
  })

  it('seeds exactly the lists the methodology names, at its snapshot date', () => {
    const seed = readMigration('_seed_sensitive_locations.sql')
    const header = seed.split('\n').filter(l => l.startsWith('--')).join('\n')
    expect(header).toContain(`Snapshot ${SENSITIVE_LOCATIONS.snapshotDate}`)
    for (const list of SENSITIVE_LOCATIONS.lists) expect(header).toContain(`(SIBBR ${list.uid})`)
    const seeded = [...header.matchAll(/\(SIBBR (drt\d+)\)/g)].map(m => m[1])
    expect(seeded).toHaveLength(SENSITIVE_LOCATIONS.lists.length)
  })
})

describe('reviewableLocationFilter', () => {
  it('matches the hexbin itself or an obscured record in its coarse cell', () => {
    const hex = latLngToCell(-27.12, -49.43, 6)
    expect(reviewableLocationFilter(hex))
      .toBe(`hex_id.eq.${hex},obscured_cell.eq.${cellToParent(hex, SENSITIVE_LOCATIONS.resolution)}`)
  })

  it('refuses anything that is not a cell, rather than building a filter from it', () => {
    expect(() => reviewableLocationFilter('86a8),status.eq.approved')).toThrow()
  })
})

describe('community marker', () => {
  const base: ApprovedSubmission = {
    id: '1', hex_id: '86a826427ffffff', latitude: -27.1, longitude: -49.4, location_obscured: false,
    observed_on: '2026-09-30', scientific_name: 'Turdus rufiventris', class_name: 'Aves',
    gbif_species_key: null, created_at: '2026-09-30', observer_display_name: 'ana', confirmation_count: 2,
  }
  const palette = { community: '#334155', communityFill: '#ffffff' }
  const t = (key: string, v?: Record<string, string | number>) => `${key}:${JSON.stringify(v ?? {})}`

  it('draws an exact record as a small filled dot', () => {
    expect(communityMarkerStyle(base, palette)).toMatchObject({ radius: 5, fillOpacity: 0.9 })
    expect(communityPopupHtml(base, t, 252)).not.toContain('communityObscured')
  })

  it('draws an obscured record as a larger hollow dashed ring and says why', () => {
    const obscured = { ...base, hex_id: null, location_obscured: true, scientific_name: 'Leopardus guttulus' }
    expect(communityMarkerStyle(obscured, palette)).toMatchObject({ fillOpacity: 0, dashArray: '3 3' })
    expect(communityMarkerStyle(obscured, palette).radius).toBeGreaterThan(5)
    expect(communityPopupHtml(obscured, t, 252)).toContain('communityObscured')
    expect(communityPopupHtml(obscured, t, 252)).toContain('252')
  })

  it('escapes contributor text in the popup', () => {
    const html = communityPopupHtml({ ...base, scientific_name: '<img src=x onerror=alert(1)>' }, t, 252)
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img')
  })
})
