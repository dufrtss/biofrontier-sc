'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { ScoredHexbin } from '@/lib/types'
import { hexBoundary } from '@/lib/h3-utils'
import { scoreToColor, scoreToOpacity } from '@/lib/color'
import type { GapMapProps } from './GapMap'
import InfoTooltip from '@/components/InfoTooltip'

export default function GapMapClient({ hexbins, selectedHexId, onHexSelect, onOpenMethodology }: GapMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<L.Map | null>(null)
  const polygonsRef  = useRef<Map<string, L.Polygon>>(new Map())

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
        polygon.bindTooltip('Unsurveyed', { sticky: true, className: 'biofrontier-tooltip' })
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

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />

      {/* Legend */}
      <div className="absolute bottom-8 left-4 z-[1000] bg-slate-900/90 backdrop-blur rounded-lg px-3 py-2 text-xs text-slate-300 border border-slate-700">
        <div className="flex items-center mb-2">
          <p className="text-slate-400 uppercase tracking-widest text-[10px] font-semibold">Survey Coverage</p>
          <InfoTooltip
            content="Each cell is an H3 hexagonal grid unit (~36 km²). Boundaries are algorithmic, not administrative — they don't align with municipalities or protected areas."
            learnMore={{ sectionId: 'geographic-scope' }}
            onLearnMore={onOpenMethodology}
          />
        </div>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: 'rgb(59,130,246)' }} />
          Well surveyed
        </div>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: 'rgb(239,68,68)' }} />
          High frontier potential
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm inline-block bg-slate-600 opacity-50" />
          Unsurveyed
        </div>
      </div>
    </div>
  )
}
