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
        className="w-4 h-4 rounded-full bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-slate-200 text-[9px] font-bold leading-none flex items-center justify-center transition-colors ml-1 shrink-0"
        aria-label="More information"
        type="button"
      >
        ?
      </button>
      {open && pos && createPortal(
        <div
          ref={popoverRef}
          style={{ top: pos.top, left: pos.left }}
          className="fixed z-[9999] w-64 bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-xl text-xs text-slate-300 leading-relaxed"
        >
          <p>{content}</p>
          {learnMore && onLearnMore && (
            <button
              onClick={() => { onLearnMore(learnMore.sectionId); setOpen(false) }}
              className="mt-2 block text-blue-400 hover:text-blue-300 transition-colors"
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
