'use client'

import { useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { ScoredHexbin } from '@/lib/types'
import { hexBoundary } from '@/lib/h3-utils'
import { scoreToColor, scoreToOpacity } from '@/lib/color'
import type { GapMapProps } from './GapMap'
import InfoTooltip from '@/components/ui/InfoTooltip'

/**
 * Escapes text interpolated into a Leaflet popup. Species names, dates and
 * display names in the community layer are written by contributors, and
 * `bindPopup` takes raw HTML — so this is the boundary where untrusted text
 * stops being markup.
 */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

export default function GapMapClient({ hexbins, selectedHexId, onHexSelect, onOpenMethodology, communitySubmissions }: GapMapProps) {
  const t = useTranslations('GapMap')
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<L.Map | null>(null)
  const polygonsRef  = useRef<Map<string, L.Polygon>>(new Map())
  const communityRef = useRef<L.LayerGroup | null>(null)

  // Stable ref so polygon effects can read current translations without re-running
  const tRef = useRef(t)
  useEffect(() => { tRef.current = t }, [t])

  // Stable callback ref to avoid re-running polygon effect when parent re-renders
  const onHexSelectRef = useRef(onHexSelect)
  useEffect(() => { onHexSelectRef.current = onHexSelect }, [onHexSelect])

  // Initialise map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, { zoomControl: true }).setView([-27.5, -51.0], 7)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 18,
    }).addTo(map)

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      polygonsRef.current.clear()
    }
  }, [])

  // Render / update hex polygons when hexbins data changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || Object.keys(hexbins).length === 0) return

    // Remove all old polygons
    polygonsRef.current.forEach(p => p.remove())
    polygonsRef.current.clear()

    Object.values(hexbins).forEach(hex => {
      const boundary = hexBoundary(hex.hexId)
      const hasData  = hex.rank > 0

      const polygon = L.polygon(boundary, hasData ? {
        color:       'transparent',
        fillColor:   scoreToColor(hex.frontierScore),
        fillOpacity: scoreToOpacity(hex.frontierScore),
        weight:      0.8,
      } : {
        color:       'transparent',
        fillColor:   '#475569',
        fillOpacity: 0.10,
        weight:      0,
      })

      if (hasData) {
        polygon.bindTooltip(
          `<strong>#${hex.rank}</strong> Frontier: ${(hex.frontierScore * 100).toFixed(0)}%`,
          { sticky: true, className: 'biofrontier-tooltip' }
        )
      } else {
        polygon.bindTooltip(tRef.current('unsurveyed'), { sticky: true, className: 'biofrontier-tooltip' })
      }

      polygon.on('click', () => onHexSelectRef.current(hex.hexId))
      polygon.addTo(map)
      polygonsRef.current.set(hex.hexId, polygon)
    })
  }, [hexbins])

  // Highlight selected hexbin
  useEffect(() => {
    polygonsRef.current.forEach((polygon, hexId) => {
      if (hexId === selectedHexId) {
        polygon.setStyle({ color: '#ffffff', weight: 2, fillOpacity: 0.9 })
        polygon.bringToFront()
      } else {
        const hex = hexbins[hexId]
        if (hex) {
          const hasData = hex.rank > 0
          polygon.setStyle(hasData ? {
            color:       'transparent',
            weight:      0.8,
            fillOpacity: scoreToOpacity(hex.frontierScore),
          } : {
            color:       'transparent',
            weight:      0,
            fillOpacity: 0.10,
          })
        }
      }
    })
  }, [selectedHexId, hexbins])

  // Community marker layer.
  //
  // Deliberately a separate Leaflet layer rather than a change to the hexbin
  // polygons: an approved community record does not alter a hexbin's frontier
  // score in Phase 1, and drawing it as if it did would misrepresent the data.
  // A reader must be able to see at a glance which marks came from GBIF and
  // iNaturalist and which came from the community.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    communityRef.current?.remove()
    if (communitySubmissions.length === 0) { communityRef.current = null; return }

    const group = L.layerGroup(
      communitySubmissions.map(s =>
        L.circleMarker([s.latitude, s.longitude], {
          radius: 5,
          color: '#34d399',
          weight: 2,
          fillColor: '#065f46',
          fillOpacity: 0.9,
        }).bindPopup(
          `<div style="font-size:12px;line-height:1.5">
             <em>${escapeHtml(s.scientific_name)}</em><br/>
             <span style="color:#64748b">${escapeHtml(s.observed_on)}</span><br/>
             <span style="color:#64748b">${tRef.current('communityConfirmations', { n: s.confirmation_count })}</span>
             ${s.observer_display_name ? `<br/><span style="color:#64748b">${escapeHtml(s.observer_display_name)}</span>` : ''}
           </div>`,
        ),
      ),
    ).addTo(map)

    communityRef.current = group
    return () => { group.remove() }
  }, [communitySubmissions])

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />

      {/* Legend */}
      <div className="absolute bottom-8 left-4 z-[1000] bg-slate-900/90 backdrop-blur rounded-lg px-3 py-2 text-xs text-slate-300 border border-slate-700">
        <div className="flex items-center mb-2">
          <p className="text-slate-400 uppercase tracking-widest text-[10px] font-semibold">{t('surveyCoverage')}</p>
          <InfoTooltip
            content={t('tooltipCoverage')}
            learnMore={{ sectionId: 'geographic-scope' }}
            onLearnMore={onOpenMethodology}
          />
        </div>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: 'rgb(59,130,246)' }} />
          {t('wellSurveyed')}
        </div>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: 'rgb(239,68,68)' }} />
          {t('highFrontier')}
        </div>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-3 h-3 rounded-sm inline-block bg-slate-600 opacity-50" />
          {t('unsurveyed')}
        </div>
        <div className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full inline-block"
            style={{ background: '#065f46', border: '2px solid #34d399' }}
          />
          {t('communityRecord')}
        </div>
      </div>
    </div>
  )
}
