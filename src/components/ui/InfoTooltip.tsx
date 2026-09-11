'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslations } from 'next-intl'

interface InfoTooltipProps {
  content: string
  learnMore?: {
    label?: string
    sectionId: string
  }
  onLearnMore?: (sectionId: string) => void
  align?: 'left' | 'right'
}

export default function InfoTooltip({
  content,
  learnMore,
  onLearnMore,
  align = 'left',
}: InfoTooltipProps) {
  const t = useTranslations('InfoTooltip')
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onMouse = (e: MouseEvent) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onMouse)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouse)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      const TOOLTIP_W = 256
      const MARGIN = 8
      let left = align === 'right' ? rect.right - TOOLTIP_W : rect.left
      left = Math.min(left, window.innerWidth - TOOLTIP_W - MARGIN)
      left = Math.max(left, MARGIN)
      setPos({ top: rect.bottom + 6, left })
    }
    setOpen(o => !o)
  }

  return (
    <div className="inline-flex items-center">
      <button
        ref={btnRef}
        onClick={handleOpen}
        className="w-4 h-4 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 text-[10px] font-bold grid place-items-center transition-colors ml-1 shrink-0"
        aria-label="More information"
        type="button"
      >
        {/* Optical, not geometric. Centring puts the ink box of `?` within a
            twentieth of a pixel of the circle's centre — the layout is right
            and the badge still looks wrong, because the glyph is top-heavy:
            almost all its mass is in the bowl and the only thing below is a
            small dot with a gap. Rasterising it and weighting by coverage puts
            the centroid 0.073em above the box centre and 0.016em right of the
            advance centre. These are those numbers, and they are specific to
            this face and this character — re-measure before reusing them. */}
        <span className="block leading-none translate-x-[-0.016em] translate-y-[0.088em]" aria-hidden="true">?</span>
      </button>
      {open && pos && createPortal(
        <div
          ref={popoverRef}
          style={{ top: pos.top, left: pos.left }}
          className="fixed z-[9999] w-64 bg-panel border border-slate-200 rounded-lg p-3 shadow-lg text-xs text-slate-600 leading-relaxed"
        >
          <p>{content}</p>
          {learnMore && onLearnMore && (
            <button
              onClick={() => { onLearnMore(learnMore.sectionId); setOpen(false) }}
              className="mt-2 block font-medium text-brand-ink hover:underline transition-colors"
              type="button"
            >
              {learnMore.label ?? t('learnMore')}
            </button>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}
