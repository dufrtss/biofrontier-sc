'use client'

import { useState, useRef, useEffect } from 'react'

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
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onMouse = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onMouse)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouse)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative inline-flex items-center" ref={ref}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        className="w-4 h-4 rounded-full bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-slate-200 text-[9px] font-bold leading-none flex items-center justify-center transition-colors ml-1 shrink-0"
        aria-label="More information"
        type="button"
      >
        ?
      </button>
      {open && (
        <div
          className={[
            'absolute top-6 z-50 w-64 bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-xl text-xs text-slate-300 leading-relaxed',
            align === 'right' ? 'right-0' : 'left-0',
          ].join(' ')}
        >
          <p>{content}</p>
          {learnMore && onLearnMore && (
            <button
              onClick={() => { onLearnMore(learnMore.sectionId); setOpen(false) }}
              className="mt-2 block text-blue-400 hover:text-blue-300 transition-colors"
              type="button"
            >
              {learnMore.label ?? 'Full methodology →'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
