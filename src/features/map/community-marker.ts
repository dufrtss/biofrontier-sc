import type { ApprovedSubmission } from '@/lib/community'

/**
 * Escapes text interpolated into a Leaflet popup. Species names, dates and
 * display names in the community layer are written by contributors, and
 * `bindPopup` takes raw HTML, so this is the boundary where untrusted text
 * stops being markup.
 */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

type Translate = (key: string, values?: Record<string, string | number>) => string

/**
 * Leaflet path options for one community record.
 *
 * An obscured record is drawn as a larger dashed ring with no fill: it stands
 * for "somewhere in this cell", and a solid dot of the usual size would claim
 * a precision the point no longer has. Several obscured records in one cell
 * share a centre and stack, which is the honest picture too.
 */
export function communityMarkerStyle(
  s: Pick<ApprovedSubmission, 'location_obscured'>,
  palette: { community: string; communityFill: string },
) {
  return s.location_obscured
    ? { radius: 9, color: palette.community, weight: 1.5, dashArray: '3 3', fillOpacity: 0 }
    : { radius: 5, color: palette.community, weight: 2, fillColor: palette.communityFill, fillOpacity: 0.9 }
}

/** Popup markup for one record. Every contributor-written value is escaped. */
export function communityPopupHtml(s: ApprovedSubmission, t: Translate, areaKm2: number): string {
  const muted = 'color:var(--color-slate-500)'
  return `<div style="font-size:12px;line-height:1.5">
     <em>${escapeHtml(s.scientific_name)}</em><br/>
     <span style="${muted}">${escapeHtml(s.observed_on)}</span><br/>
     <span style="${muted}">${escapeHtml(t('communityConfirmations', { n: s.confirmation_count }))}</span>
     ${s.observer_display_name ? `<br/><span style="${muted}">${escapeHtml(s.observer_display_name)}</span>` : ''}
     ${s.location_obscured ? `<br/><span style="${muted}">${escapeHtml(t('communityObscured', { area: areaKm2 }))}</span>` : ''}
   </div>`
}
