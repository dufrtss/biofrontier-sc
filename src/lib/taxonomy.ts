/**
 * Taxonomic grouping for the TaxonSelector filters.
 *
 * Groups are derived from the taxonomic *class* of each occurrence, which is
 * the coarsest rank every source reliably provides: GBIF exposes `class`,
 * iNaturalist exposes `iconic_taxon_name`, and speciesLink carries a Darwin
 * Core `class` field. Working from the class name rather than each provider's
 * own identifiers keeps the mapping in one place and makes adding a source a
 * matter of normalising its class string.
 */

/** Filters offered by the TaxonSelector, in display order. */
export const TAXON_FILTERS = [
  'all',
  'vertebrates',
  'birds',
  'mammals',
  'herpetofauna',
  'invertebrates',
] as const

export type TaxonFilter = typeof TAXON_FILTERS[number]

/**
 * Class names, lowercased, mapped to the groups they belong to.
 *
 * Membership is deliberately overlapping rather than exclusive: a bird belongs
 * to `birds` and to `vertebrates`, and every record belongs to `all`. Filters
 * are views over the same records, not a partition of them.
 */
const CLASS_GROUPS: Record<string, readonly TaxonFilter[]> = {
  // Vertebrates
  mammalia:        ['vertebrates', 'mammals'],
  aves:            ['vertebrates', 'birds'],
  reptilia:        ['vertebrates', 'herpetofauna'],
  amphibia:        ['vertebrates', 'herpetofauna'],
  // Fish classes — vertebrates, but not one of the named groups.
  actinopterygii:  ['vertebrates'],
  chondrichthyes:  ['vertebrates'],
  // Legacy grouping still used by museum collections in speciesLink.
  osteichthyes:    ['vertebrates'],
  sarcopterygii:   ['vertebrates'],
  petromyzonti:    ['vertebrates'],
  myxini:          ['vertebrates'],
  elasmobranchii:  ['vertebrates'],
  cephalaspidomorphi: ['vertebrates'],

  // Invertebrates — the animal classes that actually appear in SC records.
  insecta:         ['invertebrates'],
  arachnida:       ['invertebrates'],
  malacostraca:    ['invertebrates'],
  gastropoda:      ['invertebrates'],
  bivalvia:        ['invertebrates'],
  cephalopoda:     ['invertebrates'],
  polychaeta:      ['invertebrates'],
  clitellata:      ['invertebrates'],
  chilopoda:       ['invertebrates'],
  diplopoda:       ['invertebrates'],
  entognatha:      ['invertebrates'],
  collembola:      ['invertebrates'],
  branchiopoda:    ['invertebrates'],
  maxillopoda:     ['invertebrates'],
  hexanauplia:     ['invertebrates'],
  ostracoda:       ['invertebrates'],
  anthozoa:        ['invertebrates'],
  hydrozoa:        ['invertebrates'],
  scyphozoa:       ['invertebrates'],
  asteroidea:      ['invertebrates'],
  echinoidea:      ['invertebrates'],
  holothuroidea:   ['invertebrates'],
  ophiuroidea:     ['invertebrates'],
  crinoidea:       ['invertebrates'],
  turbellaria:     ['invertebrates'],
  trematoda:       ['invertebrates'],
  cestoda:         ['invertebrates'],
  secernentea:     ['invertebrates'],
  chromadorea:     ['invertebrates'],
  demospongiae:    ['invertebrates'],
  ascidiacea:      ['invertebrates'],

  // iNaturalist's `iconic_taxon_name` is almost entirely class names already —
  // Aves, Mammalia, Insecta and the rest are covered above. `Mollusca` is the
  // one exception: a phylum, used because iNaturalist does not resolve molluscs
  // to class in that field. `Animalia` is deliberately absent — it says only
  // that the record is an animal, which cannot decide vertebrate from
  // invertebrate, so such records count toward `all` and nothing else.
  mollusca:        ['invertebrates'],
}

/**
 * Groups an occurrence of the given class belongs to, excluding `all`.
 *
 * Returns an empty array for plants, fungi, and anything unrecognised. Those
 * records still count toward `all` — they are real occurrences and contribute
 * genuine survey effort — but they are not forced into an animal group, and a
 * missing or unfamiliar class name is treated as "unknown", never guessed.
 */
export function groupsForClass(className: string | null | undefined): readonly TaxonFilter[] {
  if (!className) return []
  return CLASS_GROUPS[className.trim().toLowerCase()] ?? []
}

/** Whether a class belongs to the given filter. `all` matches everything. */
export function matchesFilter(className: string | null | undefined, filter: TaxonFilter): boolean {
  if (filter === 'all') return true
  return groupsForClass(className).includes(filter)
}
