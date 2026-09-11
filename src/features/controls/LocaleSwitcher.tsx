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
    <div className="flex items-center gap-0.5">
      {routing.locales.map((locale, i) => (
        <span key={locale} className="flex items-center">
          <button
            onClick={() => switchLocale(locale)}
            className={[
              'text-[11px] font-semibold tracking-wider px-1.5 py-0.5 rounded transition-colors',
              locale === currentLocale
                ? 'text-blue-400 underline underline-offset-2'
                : 'text-slate-500 hover:text-slate-400',
            ].join(' ')}
            type="button"
          >
            {LABELS[locale]}
          </button>
          {i < routing.locales.length - 1 && (
            <span className="text-slate-600 text-[10px] select-none">·</span>
          )}
        </span>
      ))}
    </div>
  )
}
