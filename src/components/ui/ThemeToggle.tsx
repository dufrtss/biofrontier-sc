'use client'

import { useTranslations } from 'next-intl'
import { useTheme } from '@/hooks/useTheme'

/**
 * Light/dark switch.
 *
 * Both glyphs are always in the DOM and CSS picks which one shows, rather than
 * branching on the hook's value. The hook starts at 'light' and corrects in an
 * effect — it has to, since the server has no <html> to read — so rendering
 * from it would flip the icon a frame after the page has already painted dark.
 * The class is on <html> before first paint, so letting CSS choose means the
 * icon is right immediately.
 */
export default function ThemeToggle() {
  const t = useTranslations('ThemeToggle')
  const { toggle } = useTheme()

  return (
    <button
      onClick={toggle}
      className="p-1.5 -m-1.5 rounded text-slate-500 hover:text-slate-900 transition-colors"
      aria-label={t('label')}
      type="button"
    >
      <svg
        width="16" height="16" viewBox="0 0 16 16" fill="none"
        stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"
        aria-hidden="true" className="dark:hidden"
      >
        {/* Moon: offers the dark theme */}
        <path d="M13.5 9.6A5.8 5.8 0 1 1 6.4 2.5a4.6 4.6 0 0 0 7.1 7.1Z" />
      </svg>
      <svg
        width="16" height="16" viewBox="0 0 16 16" fill="none"
        stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"
        aria-hidden="true" className="hidden dark:block"
      >
        {/* Sun: offers the light theme */}
        <circle cx="8" cy="8" r="3.1" />
        <path d="M8 1.2v1.6M8 13.2v1.6M14.8 8h-1.6M2.8 8H1.2M12.8 3.2l-1.1 1.1M4.3 11.7l-1.1 1.1M12.8 12.8l-1.1-1.1M4.3 4.3 3.2 3.2" />
      </svg>
    </button>
  )
}
