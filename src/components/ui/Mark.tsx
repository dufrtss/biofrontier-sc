'use client'

import { useId } from 'react'

/**
 * The BioFrontier mark: one H3 cell carrying the frontier ramp across it, so
 * the logo is the legend. Same geometry and same stops as `src/app/icon.svg` —
 * if one moves, move the other.
 *
 * The gradient id comes from useId because a gradient is referenced by id from
 * the fill, and two marks on a page with the same id would make the second one
 * paint from the first one's definition. It costs nothing to be safe here.
 *
 * Decorative by default. Beside the wordmark in the header there is already an
 * <h1> saying the name, and a labelled image next to it makes a screen reader
 * announce the same thing twice. Pass `label` only where the mark stands alone
 * and has to speak for itself.
 */
export default function Mark({
  size = 22,
  className,
  label,
}: {
  size?: number
  className?: string
  label?: string
}) {
  const id = useId()
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#b2d6b4" />
          <stop offset="50%" stopColor="#4c9c2e" />
          <stop offset="100%" stopColor="#2f721f" />
        </linearGradient>
      </defs>
      <polygon
        points="16.00,2.20 4.05,9.10 4.05,22.90 16.00,29.80 27.95,22.90 27.95,9.10"
        fill={`url(#${id})`}
      />
    </svg>
  )
}
