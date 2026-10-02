/**
 * Which community records have their location coarsened, and how.
 *
 * A record of a species on an official threatened list is published at the
 * centre of a coarser H3 cell instead of its own resolution-6 hexbin, the way
 * iNaturalist obscures threatened taxa. The work happens in the database
 * (`supabase/migrations/20261001000001_obscure_sensitive_locations.sql`): the
 * views that other people read never carry the hexbin or the point, so no
 * client can recover them. Only the observer sees their own record exactly.
 *
 * Single source of truth for the seed script and the methodology panel:
 * `scripts/build-sensitive-taxa.ts` downloads exactly these lists and writes
 * the seed migration, and the panel names them and the snapshot date, so the
 * published methodology cannot describe lists the database does not hold.
 *
 * Changing a list or refreshing the snapshot means editing this file and
 * re-running `npm run data:sensitive-taxa` into a new migration.
 */

export interface SensitiveTaxaList {
  /** SIBBR species list id (`specieslist.sibbr.gov.br`). */
  uid: string
  /** Short source code stored per name in `sensitive_taxa.sources`. */
  code: string
  /** The legal instrument, as it is cited. */
  label: string
}

export const SENSITIVE_LOCATIONS = {
  /**
   * H3 resolution an obscured record is snapped to. Resolution 5 averages
   * about 252 km², against the 36 km² hexbin a record belongs to, and is the
   * same order of size as iNaturalist's 0.2 by 0.2 degree box (about 440 km²
   * at this latitude). Mirrored in the migration's `h3_parent_res5`; a test
   * keeps the two in step.
   */
  resolution: 5,
  /** Mean area of a cell at `resolution`, for the methodology copy. */
  areaKm2: 252,
  /** When the lists below were downloaded into the seed migration. */
  snapshotDate: '2026-10-01',
  /**
   * National lists (Portaria MMA 148/2022, current) and the Santa Catarina
   * lists as SIBBR publishes them. The state fauna list on SIBBR is still the
   * 2011 one (CONSEMA 002/2011); its replacement, CONSEMA 315/2026, was not
   * available in machine-readable form at the snapshot date. Keeping the older
   * state list errs toward obscuring, which is the safe direction.
   */
  lists: [
    { uid: 'drt1656510535532', code: 'MMA148-anfibios',      label: 'Portaria MMA nº 148/2022, Anexo 2 (anfíbios)' },
    { uid: 'drt1656510690545', code: 'MMA148-aves',          label: 'Portaria MMA nº 148/2022, Anexo 2 (aves)' },
    { uid: 'drt1656510881021', code: 'MMA148-mamiferos',     label: 'Portaria MMA nº 148/2022, Anexo 2 (mamíferos)' },
    { uid: 'drt1656510407330', code: 'MMA148-repteis',       label: 'Portaria MMA nº 148/2022, Anexo 2 (répteis)' },
    { uid: 'drt1656510243752', code: 'MMA148-invert-terr',   label: 'Portaria MMA nº 148/2022, Anexo 2 (invertebrados terrestres)' },
    { uid: 'drt1656511232123', code: 'MMA148-peixes',        label: 'Portaria MMA nº 148/2022, Anexo 3 (peixes)' },
    { uid: 'drt1656510985933', code: 'MMA148-invert-aquat',  label: 'Portaria MMA nº 148/2022, Anexo 3 (invertebrados aquáticos)' },
    { uid: 'drt1656510072242', code: 'MMA148-flora',         label: 'Portaria MMA nº 148/2022, Anexo 1 (flora)' },
    { uid: 'drt1781796129191', code: 'SC-fauna-2011',        label: 'Resolução CONSEMA nº 002/2011 (fauna de SC)' },
    { uid: 'drt1781796308621', code: 'SC-flora-2014',        label: 'Resolução CONSEMA nº 51/2014 (flora de SC)' },
  ] satisfies SensitiveTaxaList[],
} as const

const DROPPED_TOKENS = new Set(['cf.', 'cf', 'aff.', 'aff', '?'])
const OPEN_EPITHETS  = new Set(['sp.', 'sp', 'spp.', 'spp'])

/**
 * The key a name is matched on: genus and specific epithet, lower case.
 *
 * Authors, subspecies and varieties are dropped, so a record of any form of a
 * listed species matches, and a listed subspecies obscures its whole species.
 * Both err toward obscuring. Qualifiers like `cf.` are dropped for the same
 * reason. A name with no epithet (`Leopardus sp.`) has no key and is shown
 * exactly. Mirrored by `public.taxon_name_key` in SQL; the tests pin both to
 * the same cases.
 */
export function taxonNameKey(name: string | null | undefined): string | null {
  const tokens = (name ?? '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(tok => tok !== '' && !DROPPED_TOKENS.has(tok) && !/^\(.*\)$/.test(tok))
  if (tokens.length < 2 || OPEN_EPITHETS.has(tokens[1])) return null
  return `${tokens[0]} ${tokens[1]}`
}
