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
  noData:      '#0A1116',  // --color-raised
  noDataEdge:  '#13252C',  // --color-line
  hoverStroke: '#B7F0FF',  // --color-highlight
  community:   '#87DEFF',  // --color-system
} as const

// Hexbins are drawn with their own edges rather than as flat fills. A lattice
// of hairlines is what makes a grid of cells read as an instrument overlay
// instead of a heatmap blur, and on a true-black panel a 0.6px line at 45%
// survives where a fill gradient just smears. Unsurveyed cells keep the edge
// and lose the fill: absence of data is still structure, and a cell nobody has
// walked is worth seeing.
const EDGE_WEIGHT  = 0.6
const EDGE_OPACITY = 0.45

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

    // One dark cartographic ground, and nothing under it.
    //
    // A hillshade relief layer sat here for one iteration and gave the terrain
    // genuine presence — which is exactly why it came out. Against a true-black
    // OLED ground the landscape became the loudest thing on screen, and the
    // hexbins that are the whole subject of the map read as an overlay on a
    // picture of Santa Catarina. The basemap's job is to say where you are and
    // then get out of the way.
    //
    // Note the path segment: /Canvas/. Esri answers a wrong service path by
    // failing the tile request rather than erroring visibly, so dropping it
    // shows up only as a map with no place names.
    L.tileLayer(`${ESRI}/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`, {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://www.esri.com/">Esri</a>',
      maxZoom: 16,
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
        color:       scoreToColor(hex.frontierScore),
        opacity:     EDGE_OPACITY,
        weight:      EDGE_WEIGHT,
        fillColor:   scoreToColor(hex.frontierScore),
        fillOpacity: scoreToOpacity(hex.frontierScore),
      } : {
        color:       MAP.noDataEdge,
        opacity:     0.55,
        weight:      EDGE_WEIGHT,
        fillColor:   MAP.noData,
        fillOpacity: 0.10,
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

  // Highlight selected hexbin.
  //
  // The glow is a class on the rendered <path> rather than a Leaflet style
  // because SVG has no box-shadow and setStyle cannot set className after
  // construction. `.hex-selected` carries a drop-shadow filter, which is what
  // makes the selection look emitted rather than outlined — the one effect on
  // this screen that an OLED panel renders and a backlit one cannot.
  useEffect(() => {
    polygonsRef.current.forEach((polygon, hexId) => {
      const el = polygon.getElement()
      if (hexId === selectedHexId) {
        polygon.setStyle({ color: MAP.hoverStroke, opacity: 1, weight: 2, fillOpacity: 0.9 })
        polygon.bringToFront()
        el?.classList.add('hex-selected')
      } else {
        el?.classList.remove('hex-selected')
        const hex = hexbins[hexId]
        if (hex) {
          const hasData = hex.rank > 0
          polygon.setStyle(hasData ? {
            color:       scoreToColor(hex.frontierScore),
            opacity:     EDGE_OPACITY,
            weight:      EDGE_WEIGHT,
            fillOpacity: scoreToOpacity(hex.frontierScore),
          } : {
            color:       MAP.noDataEdge,
            opacity:     0.55,
            weight:      EDGE_WEIGHT,
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
      <div className="absolute bottom-8 left-4 z-[1000] bg-background/85 backdrop-blur-sm px-3 py-2.5 text-xs text-secondary border border-edge notch">
        <div className="flex items-center mb-2">
          <p className="hud-label text-secondary">{t('surveyCoverage')}</p>
          <InfoTooltip
            content={t('tooltipCoverage')}
            learnMore={{ sectionId: 'geographic-scope' }}
            onLearnMore={onOpenMethodology}
          />
        </div>
        {/* A sequential scale deserves a continuous legend. Two swatches implied
            two categories; the ramp is one quantity getting brighter. */}
        <div className="mb-1.5">
          {/* Hard stops, not a smooth gradient: the ramp is seven discrete
              steps and the fill on the map can only ever be one of them, so a
              continuous bar would promise a precision the data does not have. */}
          <div
            className="h-2 border border-edge"
            style={{
              background: `linear-gradient(to right, ${
                frontierRamp.map((c, i) =>
                  `${c} ${(i / frontierRamp.length) * 100}% ${((i + 1) / frontierRamp.length) * 100}%`,
                ).join(', ')
              })`,
            }}
          />
          <div className="flex justify-between gap-3 mt-1 hud-label leading-tight">
            <span>{t('wellSurveyed')}</span>
            <span className="text-right">{t('highFrontier')}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <span
            className="w-3 h-3 inline-block shrink-0"
            style={{ background: MAP.noData, border: `1px solid ${MAP.noDataEdge}` }}
          />
          {t('unsurveyed')}
        </div>
        <div className="flex items-center gap-2">
          {/* Round, because the thing it stands for is a round marker on the
              map. A legend swatch that is not the shape of its mark is a lie. */}
          <span
            className="w-3 h-3 rounded-full inline-block shrink-0"
            style={{ background: MAP.noData, border: `2px solid ${MAP.community}` }}
          />
          {t('communityRecord')}
        </div>
      </div>
    </div>
  )
}
