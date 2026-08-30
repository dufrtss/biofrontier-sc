/**
 * Links from a species name to its page on gbif.org.
 *
 * The obvious URL — `https://www.gbif.org/species/search?q=<name>` — is broken
 * upstream: GBIF now redirects `/species/search` to `/taxon/search` and drops
 * the query string on the way, so the reader lands on an empty search form and
 * has to retype the name. `/taxon/search?q=<name>` does keep the query, and
 * legacy numeric usage keys still resolve — `/species/<usageKey>` serves the
 * taxon page itself (canonical `/taxon/<id>`).
 *
 * So a species with a resolved backbone key links straight to its page, and one
 * without falls back to a search that at least arrives pre-filled. Keys come
 * from the data file's `speciesKeys` (schema v4+); see `scripts/gbif-keys.ts`.
 */
export function gbifSpeciesUrl(name: string, usageKey?: number | null): string {
  return usageKey != null
    ? `https://www.gbif.org/species/${usageKey}`
    : `https://www.gbif.org/taxon/search?q=${encodeURIComponent(name)}`
}
