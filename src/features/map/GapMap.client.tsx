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
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

// Leaflet paints SVG attributes directly, so these cannot be utility classes.
// One block, each entry named for the Cold Signal token it mirrors — if a token
// in globals.css moves, this is the only other place that has to move with it.
const MAP = {
  noData:      '#0C0F11',  // --color-raised
  hoverStroke: '#B7F0FF',  // --color-highlight
  community:   '#87DEFF',  // --color-system
} as const

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
    // Standard OSM tiles are a light, saturated street map — beige roads, green
    // parks, white labels — and they fought both the dark UI and the hexbin
    // fills for attention. Esri's Dark Gray Canvas is a desaturated cartography
    // that reads as ground rather than as content. Free, keyless, attribution
    // required.
    //
    // CARTO's Dark Matter was the first choice and is the better-looking map,
    // but it now stamps "API KEY REQUIRED" across every tile. It still answers
    // 200 with a plausible tile size, so this was invisible until the map was
    // actually rendered and looked at — a tile endpoint returning 200 is not
    // evidence that the tile is usable.
    //
    // Splitting labels off puts place names in a pane ABOVE the hexbins, so a
    // town stays readable through a 0.8-opacity fill instead of being buried by
    // the data drawn over it.
    const ESRI = 'https://services.arcgisonline.com/ArcGIS/rest/services'

    // Terrain first, as the actual ground.
    //
    // The previous pass dimmed the basemap so hard that the state read as a
    // black void with hexagons floating in it. For this tool the terrain is not
    // decoration: where a river runs and where the land rises is the context
    // that makes an under-surveyed hexbin mean anything, and the biologist
    // reading it is placing the map against country they know.
    //
    // Esri's hillshade is a near-white relief raster, so it is inverted — flats
    // fall to black, lit slopes come through — and tinted toward the bio green.
    // The Serra do Mar and the coastal escarpment are legible without lifting
    // the map's overall brightness.
    //
    // This was first tried as a screen-blended pane above the ground. Don't:
    // mix-blend-mode makes a Leaflet pane isolate, so instead of screening into
    // the ground it paints over it and the basemap goes entirely black.
    // Stacking two ordinary layers costs nothing and has no such trap.
    L.tileLayer(`${ESRI}/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}`, {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://www.esri.com/">Esri</a>',
      maxZoom: 16,
      className: 'basemap-relief',
    }).addTo(map)

    // Then the cartography — coastline, rivers, reservoirs, borders — over the
    // relief at partial opacity, so both survive.
    L.tileLayer(`${ESRI}/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`, {
      maxZoom: 16,
      opacity: 0.45,
      className: 'basemap-ground',
    }).addTo(map)

    // Labels go ABOVE the hexbins, so a town stays readable through a
    // 0.8-opacity fill instead of being buried by the data drawn over it.
    map.createPane('labels')
    map.getPane('labels')!.style.zIndex = '650'
    map.getPane('labels')!.style.pointerEvents = 'none'

    L.tileLayer(`${ESRI}/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}`, {
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
        polygon.setStyle({ color: MAP.hoverStroke, weight: 2, fillOpacity: 0.9 })
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
          color: MAP.community,
          weight: 2,
          fillColor: MAP.noData,
          fillOpacity: 0.9,
        }).bindPopup(
          `<div style="font-size:12px;line-height:1.5">
             <em>${escapeHtml(s.scientific_name)}</em><br/>
             <span style="color:var(--color-muted)">${escapeHtml(s.observed_on)}</span><br/>
             <span style="color:var(--color-muted)">${tRef.current('communityConfirmations', { n: s.confirmation_count })}</span>
             ${s.observer_display_name ? `<br/><span style="color:var(--color-muted)">${escapeHtml(s.observer_display_name)}</span>` : ''}
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
      <div className="absolute bottom-8 left-4 z-[1000] bg-surface/90 backdrop-blur rounded-lg px-3 py-2 text-xs text-secondary border border-line">
        <div className="flex items-center mb-2">
          <p className="text-secondary uppercase tracking-widest text-[10px] font-semibold">{t('surveyCoverage')}</p>
          <InfoTooltip
            content={t('tooltipCoverage')}
            learnMore={{ sectionId: 'geographic-scope' }}
            onLearnMore={onOpenMethodology}
          />
        </div>
        {/* A sequential scale deserves a continuous legend. Two swatches implied
            two categories; the ramp is one quantity getting brighter. */}
        <div className="mb-1.5">
          <div
            className="h-2 rounded-sm"
            style={{ background: `linear-gradient(to right, ${frontierRamp.join(', ')})` }}
          />
          <div className="flex justify-between gap-3 mt-1 text-[10px] text-muted leading-tight">
            <span>{t('wellSurveyed')}</span>
            <span className="text-right">{t('highFrontier')}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-3 h-3 rounded-sm inline-block bg-line-loud opacity-50" />
          {t('unsurveyed')}
        </div>
        <div className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full inline-block"
            style={{ background: MAP.noData, border: `2px solid ${MAP.community}` }}
          />
          {t('communityRecord')}
        </div>
      </div>
    </div>
  )
}
