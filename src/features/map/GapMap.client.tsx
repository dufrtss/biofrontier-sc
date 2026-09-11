'use client'

import { useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { ScoredHexbin } from '@/lib/types'
import { hexBoundary } from '@/lib/h3-utils'
import { scoreToColor, scoreToOpacity, frontierRamp } from '@/lib/color'
import type { GapMapProps } from './GapMap'
import InfoTooltip from '@/components/ui/InfoTooltip'

/**
 * Escapes text interpolated into a Leaflet popup. Species names, dates and
 * display names in the community layer are written by contributors, and
 * `bindPopup` takes raw HTML — so this is the boundary where untrusted text
 * stops being markup.
 */
// Leaflet paints SVG attributes directly, so these cannot be utility classes.
// One block, each entry named for the thing in globals.css it mirrors — if a
// colour there moves, this is the only other place that has to move with it.
const MAP = {
  noData:      '#94a3b8',  // slate-400, at low opacity
  selected:    '#0f172a',  // slate-900 — the selection ring was #ffffff, which
                           // is invisible the moment the basemap goes light
  // Community records must NOT be green. The frontier ramp is now green end to
  // end, so a green marker reads as another score rather than as a different
  // KIND of observation. Indigo is the one hue in this palette that separates
  // from the ramp under deuteranopia as well as normal vision (ΔE 80+).
  community:      '#4841af',
  communityFill:  '#ffffff',
} as const

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

    // Basemap in two halves, with the data sandwiched between them.
    //
    // Standard OSM tiles are a saturated street map — beige roads, green parks,
    // pink motorways — and every one of those colours competes with a hexbin
    // fill for the same attention. Esri's Light Gray Canvas is a cartography
    // drawn to sit *under* data: coastline, rivers, borders and place names,
    // almost no hue. Free, keyless, attribution required.
    //
    // Splitting the labels off puts place names in a pane ABOVE the hexbins, so
    // a town stays readable through a 0.8-opacity fill instead of being buried
    // by the data drawn over it.
    //
    // Note the /Canvas/ path segment: Esri answers a wrong service path by
    // failing the tile request rather than erroring, so dropping it shows up
    // only as a map with no place names.
    const ESRI = 'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas'

    L.tileLayer(`${ESRI}/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`, {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://www.esri.com/">Esri</a>',
      maxZoom: 16,
      className: 'basemap-ground',
    }).addTo(map)

    map.createPane('labels')
    map.getPane('labels')!.style.zIndex = '650'
    map.getPane('labels')!.style.pointerEvents = 'none'

    L.tileLayer(`${ESRI}/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}`, {
      maxZoom: 16,
      pane: 'labels',
      className: 'basemap-labels',
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
        fillColor:   MAP.noData,
        fillOpacity: 0.16,
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
        polygon.setStyle({ color: MAP.selected, weight: 2, fillOpacity: 0.9 })
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
            fillOpacity: 0.16,
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
          color: MAP.community,
          weight: 2,
          fillColor: MAP.communityFill,
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
      <div className="absolute bottom-8 left-4 z-[1000] bg-white/95 backdrop-blur rounded-lg px-3 py-2 text-xs text-slate-500 border border-slate-200">
        <div className="flex items-center mb-2">
          <p className="text-slate-500 uppercase tracking-widest text-[10px] font-semibold">{t('surveyCoverage')}</p>
          <InfoTooltip
            content={t('tooltipCoverage')}
            learnMore={{ sectionId: 'geographic-scope' }}
            onLearnMore={onOpenMethodology}
          />
        </div>
        {/* A sequential scale deserves a continuous legend. Two swatches
            implied two categories; the ramp is one quantity getting deeper.
            Hard stops rather than a smooth blend, because the fill on the map
            can only ever be one of seven steps and a gradient would promise a
            precision the data does not have. */}
        <div className="mb-2">
          <div
            className="h-2 rounded-sm border border-slate-200"
            style={{
              background: `linear-gradient(to right, ${
                frontierRamp.map((c, i) =>
                  `${c} ${(i / frontierRamp.length) * 100}% ${((i + 1) / frontierRamp.length) * 100}%`,
                ).join(', ')
              })`,
            }}
          />
          <div className="flex justify-between gap-3 mt-1 text-[10px] text-slate-500 leading-tight">
            <span>{t('wellSurveyed')}</span>
            <span className="text-right">{t('highFrontier')}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <span
            className="w-3 h-3 rounded-sm inline-block shrink-0 border border-slate-200"
            style={{ background: MAP.noData, opacity: 0.4 }}
          />
          {t('unsurveyed')}
        </div>
        <div className="flex items-center gap-2">
          {/* Round, because the thing it stands for is a round marker on the
              map. A legend swatch that is not the shape of its mark is a lie. */}
          <span
            className="w-3 h-3 rounded-full inline-block shrink-0"
            style={{ background: MAP.communityFill, border: `2px solid ${MAP.community}` }}
          />
          {t('communityRecord')}
        </div>
      </div>
    </div>
  )
}
