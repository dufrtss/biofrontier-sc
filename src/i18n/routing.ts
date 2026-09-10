import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['pt-BR', 'en', 'es'],
  defaultLocale: 'pt-BR',

  // Portuguese is the primary language of this tool, not a fallback for people
  // whose browser asked for nothing better. The audience is Santa Catarina —
  // its field biologists, its students, its state agencies — and the habitat
  // data, the place names and the methodology are all written for them first.
  //
  // Left on, next-intl resolves `/` from the `NEXT_LOCALE` cookie and then the
  // `accept-language` header, so a browser set to English landed on `/en` and
  // never saw the Portuguese site at all. Off, `/` is always `/pt-BR`; `/en`
  // and `/es` still serve normally because an explicit route prefix is matched
  // ahead of any detection, and the locale switcher links straight to them.
  localeDetection: false,
})
