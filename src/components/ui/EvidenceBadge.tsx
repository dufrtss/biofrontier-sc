'use client'

import { useTranslations } from 'next-intl'
import type { EvidenceLevel } from '@/lib/evidence'

const FILLED: Record<EvidenceLevel, number> = { weak: 1, moderate: 2, strong: 3 }

interface Props {
  level: EvidenceLevel
  className?: string
}

/**
 * Three bars and a label. The label carries the meaning; the bars let the eye
 * compare rows down the ranking without reading each one. Weak evidence takes
 * the warning colour because it is the one level that changes how the score
 * beside it should be read.
 */
export default function EvidenceBadge({ level, className = '' }: Props) {
  const t = useTranslations('Evidence')
  const tone = level === 'weak' ? 'text-warning' : 'text-slate-600'

  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] whitespace-nowrap ${tone} ${className}`}>
      <span className="inline-flex items-end gap-px" aria-hidden>
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="w-[3px] bg-current"
            style={{ height: `${4 + i * 2}px`, opacity: i < FILLED[level] ? 1 : 0.25 }}
          />
        ))}
      </span>
      {t(level)}
    </span>
  )
}
