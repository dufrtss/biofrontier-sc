'use client'

import { usePathname, useRouter } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { useParams } from 'next/navigation'

const LABELS: Record<string, string> = {
  'pt-BR': 'PT',
  'en': 'EN',
  'es': 'ES',
}

export default function LocaleSwitcher() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useParams()
  const currentLocale = params.locale as string

  const switchLocale = (locale: string) => {
    router.replace(pathname, { locale })
  }

  return (
    // Same segmented part as the taxon filter: one outline, shared hairlines,
    // no separator glyphs. The interpuncts were doing the job a shared border
    // does better, and the underline on the current locale was the last
    // rounded-era decoration left in the footer.
    <div className="flex border border-edge">
      {routing.locales.map(locale => (
        <button
          key={locale}
          onClick={() => switchLocale(locale)}
          // The active locale is otherwise announced by nothing at all — it was
          // colour and an underline, both purely visual.
          aria-current={locale === currentLocale ? 'true' : undefined}
          className={[
            'hud-label px-2 py-1 transition-colors border-l border-edge first:border-l-0',
            locale === currentLocale
              ? 'emit relative z-10 bg-raised text-highlight'
              : 'text-muted hover:text-system',
          ].join(' ')}
          type="button"
        >
          {LABELS[locale]}
        </button>
      ))}
    </div>
  )
}
