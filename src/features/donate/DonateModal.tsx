'use client'

import { useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'

/**
 * PayPal is the whole payment stack here. There is no account system to bill
 * against and no recurring tier to manage — a one-off transfer from someone who
 * found the map useful is the entire expected volume, and anything heavier
 * would cost more to operate than it collects.
 */
export const DONATE_URL =
  'https://www.paypal.com/donate/?cmd=_donations' +
  '&business=eduardofragadefreitas@gmail.com' +
  '&item_name=BioFrontier%20SC&currency_code=BRL'

interface DonateModalProps {
  open: boolean
  onClose: () => void
}

/**
 * Thanks the reader before handing them off to PayPal.
 *
 * The donate link used to go straight out to a payment form, which put the ask
 * before the thanks and sent people to a third-party page with no idea what the
 * money was for. The interstitial is the only place the project gets to say
 * what a contribution actually pays for — and to thank the larger group who
 * use the map and submit observations without ever donating anything.
 */
export default function DonateModal({ open, onClose }: DonateModalProps) {
  const t = useTranslations('Donate')
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    // Move focus into the dialog so Tab walks its controls rather than the map
    // behind it. Focus the container, not the PayPal link: making the outbound
    // payment link the default action means a stray Enter navigates away from
    // the app, which is the one thing this dialog exists to stop happening by
    // accident.
    dialogRef.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      /* Near-opaque black rather than a grey scrim: the map behind should go
         dark, not hazy, so the dialog is the only lit thing on the panel. */
      className="fixed inset-0 z-[2100] flex items-center justify-center p-4 bg-background/92"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="donate-title"
        /* Hairline edge plus a tight cyan bloom instead of a drop shadow: the
           overlay should read as lit from within, not as paper floating above
           the map. */
        className="w-full max-w-md bg-surface border border-edge emit-soft"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-5 pt-4 pb-3 border-b border-edge">
          <h2
            id="donate-title"
            className="text-sm font-semibold text-primary uppercase tracking-[0.14em]"
          >
            {t('title')}
          </h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-system text-lg leading-none transition-colors"
            aria-label={t('close')}
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4 space-y-3 text-xs text-secondary leading-relaxed">
          <p>{t('usingIt')}</p>
          <p>{t('contributing')}</p>
          <p>{t('supporting')}</p>
          <p className="text-system">{t('freeEitherWay')}</p>
        </div>

        <div className="flex items-center justify-end gap-3 px-5 pb-4 pt-1">
          <button
            onClick={onClose}
            className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted hover:text-secondary transition-colors"
          >
            {t('later')}
          </button>
          {/* A real link, not a scripted `window.open`: it survives a popup
              blocker and still supports middle-click and open-in-new-tab. */}
          <a
            href={DONATE_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="notch border border-system bg-system/10 px-4 py-2 font-mono text-[10px]
                       uppercase tracking-[0.14em] text-system hover:bg-system/20 transition-colors"
          >
            {t('continue')}
          </a>
        </div>
      </div>
    </div>
  )
}
