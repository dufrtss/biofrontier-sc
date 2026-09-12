'use client'

import { useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { CONSENSUS_THRESHOLD } from '@/lib/community'

interface SignedInModalProps {
  open: boolean
  onClose: () => void
  /** Opens the frontier ranking, which is where contributing starts. */
  onShowRanking: () => void
}

/**
 * Says what just changed, on arrival from a magic link.
 *
 * Signing in unlocks real capability — submitting an observation, confirming or
 * disputing someone else's — and every bit of it lives at the bottom of the
 * detail panel of a hexbin you have to pick first. The link lands on the map
 * with nothing selected, so the honest description of the experience was that
 * you click a link, the page looks identical, and you are left to discover the
 * difference by chance.
 *
 * Hence a dialog that names the three things that are now possible and then
 * offers the one action that leads to them. The offer matters more than the
 * text: "open a frontier location and scroll down" is an instruction, and an
 * instruction the reader has to carry is worse than a button that does it.
 */
export default function SignedInModal({ open, onClose, onShowRanking }: SignedInModalProps) {
  const t = useTranslations('SignedIn')
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    // Focus the container rather than the primary action, matching DonateModal:
    // a stray Enter should dismiss nothing and navigate nowhere.
    dialogRef.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[2100] flex items-center justify-center p-4 bg-black/60"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="signed-in-title"
        className="w-full max-w-md bg-panel border border-slate-200 rounded-lg shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-5 pt-4 pb-3 border-b border-slate-200">
          <h2
            id="signed-in-title"
            className="text-sm font-semibold text-slate-800 uppercase tracking-wider font-condensed"
          >
            {t('title')}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-900 text-lg leading-none"
            aria-label={t('close')}
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4 space-y-3 text-xs text-slate-500 leading-relaxed">
          <p>{t('intro')}</p>
          <ul className="space-y-2">
            <li className="flex gap-2">
              <span aria-hidden="true" className="text-brand-ink shrink-0">▸</span>
              <span>{t('canAdd')}</span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden="true" className="text-brand-ink shrink-0">▸</span>
              <span>{t('canReview', { n: CONSENSUS_THRESHOLD })}</span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden="true" className="text-brand-ink shrink-0">▸</span>
              <span>{t('canWithdraw')}</span>
            </li>
          </ul>
          <p>{t('whereToFind')}</p>
          {/* Stated here because it is the question a contributor asks second,
              and the answer is easy to mistake for false modesty if it only
              turns up after they have already submitted something. */}
          <p className="text-slate-600">{t('notInIndex')}</p>
        </div>

        <div className="flex items-center justify-end gap-3 px-5 pb-4 pt-1">
          <button
            onClick={onClose}
            className="text-xs text-slate-600 hover:text-slate-900 transition-colors"
          >
            {t('explore')}
          </button>
          <button
            onClick={() => { onShowRanking(); onClose() }}
            className="text-xs font-medium px-3 py-1.5 rounded bg-brand-solid text-white hover:bg-brand-solid/90 transition-colors"
          >
            {t('showRanking')}
          </button>
        </div>
      </div>
    </div>
  )
}
