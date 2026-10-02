/**
 * The BioFrontier mark: three H3-style cells in the brand green, two sampled
 * and one still empty. The empty one is what the atlas exists to find.
 *
 * Same geometry as `src/app/icon.svg`: if one moves, move the other.
 *
 * Colour comes from `--color-brand` rather than a literal, so the mark follows
 * the theme the way everything else does: the dark theme lifts that green a
 * step. The favicon cannot do this (a standalone SVG has no access to the
 * page's custom properties) and carries the light value baked in.
 *
 * Decorative by default. Beside the wordmark in the header there is already an
 * <h1> saying the name, and a labelled image next to it makes a screen reader
 * announce the same thing twice. Pass `label` only where the mark stands alone.
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
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 256 256"
      className={className}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      <polygon points="70.8,24.0 117.6,51.0 117.6,105.0 70.8,132.0 24.1,105.0 24.1,51.0" fill="var(--color-brand)" />
      <polygon points="185.2,24.0 231.9,51.0 231.9,105.0 185.2,132.0 138.4,105.0 138.4,51.0" fill="var(--color-brand)" />
      <polygon
        points="128.0,134.0 165.2,155.5 165.2,198.5 128.0,220.0 90.8,198.5 90.8,155.5"
        fill="none"
        stroke="var(--color-brand)"
        strokeWidth={20}
        strokeLinejoin="round"
      />
    </svg>
  )
}
