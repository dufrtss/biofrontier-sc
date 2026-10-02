import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['pt-BR', 'en', 'es'],
  defaultLocale: 'pt-BR',

  // `/` follows the visitor: the `NEXT_LOCALE` cookie first (set when someone
  // switches language), then the browser's `accept-language`. A browser that
  // asks for none of the three gets pt-BR, since the audience is Santa Catarina.
  // Prefixed routes (`/en`, `/es`) are matched ahead of detection, so shared
  // links open in the language they were sent in.
  localeDetection: true,
})
