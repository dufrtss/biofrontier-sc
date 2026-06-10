'use client'

import { useEffect, useRef } from 'react'
import type { ScoredHexbin, TaxonFilter } from '@/lib/types'
import { scoreToColor } from '@/lib/color'
import { hexCenter } from '@/lib/h3-utils'

interface Props {
  hex: ScoredHexbin | null
  taxonFilter: TaxonFilter
  onClose: () => void
}

interface AnimatedBarProps {
  label: string
  value: number
  color: string
  animate: boolean
}

function AnimatedBar({ label, value, color, animate }: AnimatedBarProps) {
  const pct = Math.round(value * 100)
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!barRef.current || !animate) return
    const el = barRef.current
    el.style.width = '0%'
    const raf = requestAnimationFrame(() => {
      el.style.transition = 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
      el.style.width = `${pct}%`
    })
    return () => cancelAnimationFrame(raf)
  }, [pct, animate])

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-baseline">
        <span className="text-[11px] text-slate-400 tracking-wide uppercase font-medium">{label}</span>
        <span className="text-xs font-mono text-slate-300 tabular-nums">{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden border border-slate-700/50">
        <div
          ref={barRef}
          className="h-full rounded-full"
          style={{
            width: animate ? '0%' : `${pct}%`,
            background: color,
          }}
        />
      </div>
    </div>
  )
}

export default function HexDetail({ hex, taxonFilter, onClose }: Props) {
  const prevHexId = useRef<string | null>(null)
  const shouldAnimate = hex !== null && hex.hexId !== prevHexId.current

  useEffect(() => {
    if (hex) prevHexId.current = hex.hexId
  }, [hex])

  if (!hex) return null

  const td = taxonFilter === 'vertebrates' ? hex.vertebrates : hex.all
  const [lat, lng] = hexCenter(hex.hexId)
  const accentColor = scoreToColor(hex.frontierScore)
  const frontierPct = Math.round(hex.frontierScore * 100)
  const effortPct = Math.round(hex.effortScore * 100)
  const habitatPct = Math.round(hex.habitatQuality * 100)
  const surveyGapPct = 100 - effortPct

  // Frontier score label
  const frontierLabel =
    hex.frontierScore >= 0.8 ? 'CRITICAL GAP' :
    hex.frontierScore >= 0.6 ? 'HIGH POTENTIAL' :
    hex.frontierScore >= 0.4 ? 'MODERATE' :
    'WELL SURVEYED'

  return (
    <div className="flex flex-col h-full bg-slate-900" style={{ borderLeft: `1px solid rgba(148,163,184,0.12)` }}>

      {/* Header band — color-coded by frontier score */}
      <div
        className="relative px-4 pt-4 pb-3 overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${accentColor}18 0%, transparent 60%)`,
          borderBottom: `1px solid ${accentColor}28`,
        }}
      >
        {/* Subtle diagonal stripe texture */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: `repeating-linear-gradient(
              45deg,
              ${accentColor} 0px,
              ${accentColor} 1px,
              transparent 1px,
              transparent 8px
            )`,
          }}
        />

        <div className="relative flex items-start justify-between">
          <div className="flex-1 min-w-0">
            {/* Rank + score headline */}
            <div className="flex items-baseline gap-3">
              <span
                className="text-5xl font-black leading-none tabular-nums tracking-tighter"
                style={{ color: accentColor, fontFeatureSettings: '"tnum"' }}
              >
                #{hex.rank}
              </span>
              <div>
                <div
                  className="text-2xl font-bold leading-none tabular-nums"
                  style={{ color: accentColor }}
                >
                  {frontierPct}%
                </div>
                <div
                  className="text-[9px] font-bold tracking-[0.15em] mt-0.5"
                  style={{ color: `${accentColor}cc` }}
                >
                  {frontierLabel}
                </div>
              </div>
            </div>

            {/* Coordinates */}
            <div className="mt-2 font-mono text-[11px] text-slate-500 tracking-wider">
              {Math.abs(lat).toFixed(4)}°S&nbsp;&nbsp;
              {Math.abs(lng).toFixed(4)}°W
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-600 hover:text-slate-300 transition-colors text-base leading-none mt-0.5 ml-2 shrink-0 w-7 h-7 flex items-center justify-center rounded hover:bg-slate-700/60"
            aria-label="Close panel"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">

        {/* Key metric grid */}
        <div className="px-4 pt-4 pb-3">
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Records',     value: td.occurrenceCount.toLocaleString(),    icon: '◉' },
              { label: 'Species',     value: td.uniqueSpeciesCount.toLocaleString(), icon: '◈' },
              { label: 'Observers',   value: td.uniqueObserverCount.toLocaleString(), icon: '◎' },
              { label: 'Survey days', value: td.uniqueDateCount.toLocaleString(),     icon: '◇' },
            ].map(({ label, value, icon }) => (
              <div
                key={label}
                className="rounded-lg px-3 py-2.5"
                style={{
                  background: 'rgba(30,41,59,0.8)',
                  border: '1px solid rgba(148,163,184,0.07)',
                }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px]" style={{ color: `${accentColor}99` }}>{icon}</span>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">{label}</span>
                </div>
                <div className="text-lg font-mono font-bold text-slate-200 tabular-nums leading-none">
                  {value}
                </div>
              </div>
            ))}
          </div>

          {/* Date range */}
          {td.firstDate && (
            <div
              className="mt-2 px-3 py-2 rounded-lg text-[11px] font-mono text-slate-500 tracking-wide"
              style={{
                background: 'rgba(30,41,59,0.5)',
                border: '1px solid rgba(148,163,184,0.06)',
              }}
            >
              <span className="text-slate-600">PERIOD</span>
              &nbsp;&nbsp;
              {td.firstDate}&nbsp;→&nbsp;{td.lastDate}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="mx-4 border-t border-slate-800" />

        {/* Score breakdown */}
        <div className="px-4 py-4 space-y-3.5">
          <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.18em]">
            Score Breakdown
          </h3>

          <AnimatedBar
            label="Frontier potential"
            value={hex.frontierScore}
            color={accentColor}
            animate={shouldAnimate}
          />

          <AnimatedBar
            label="Habitat quality"
            value={hex.habitatQuality}
            color="rgb(34,197,94)"
            animate={shouldAnimate}
          />

          {/* Survey gap — inverted effort score */}
          <div className="space-y-1">
            <div className="flex justify-between items-baseline">
              <span className="text-[11px] text-slate-400 tracking-wide uppercase font-medium">Survey gap</span>
              <span className="text-xs font-mono text-slate-300 tabular-nums">{surveyGapPct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden border border-slate-700/50">
              <SurveyGapBar pct={surveyGapPct} animate={shouldAnimate} />
            </div>
          </div>

          {/* Score detail annotation */}
          <div
            className="rounded px-2.5 py-2 text-[10px] leading-relaxed text-slate-600"
            style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.05)' }}
          >
            Frontier&nbsp;=&nbsp;survey gap&nbsp;×&nbsp;habitat&nbsp;quality.
            High habitat coverage with low observation density indicates discovery potential.
          </div>
        </div>

        {/* Top species */}
        {td.topSpecies.length > 0 && (
          <>
            <div className="mx-4 border-t border-slate-800" />
            <div className="px-4 py-4">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.18em] mb-3">
                Top Recorded Species
              </h3>
              <ul className="space-y-1.5">
                {td.topSpecies.map(({ name, count }) => (
                  <li key={name} className="flex items-center justify-between gap-2 group">
                    <a
                      href={`https://www.gbif.org/species/search?q=${encodeURIComponent(name)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[12px] italic truncate text-blue-400/80 hover:text-blue-300 transition-colors flex-1 min-w-0"
                      title={name}
                    >
                      {name}
                    </a>
                    <span
                      className="text-[11px] font-mono text-slate-600 tabular-nums shrink-0 rounded px-1.5 py-0.5"
                      style={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(148,163,184,0.07)' }}
                    >
                      {count}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {/* Bottom spacer */}
        <div className="h-2" />
      </div>

      {/* Footer */}
      <div
        className="px-4 py-2.5 text-[10px] font-mono text-slate-700 tracking-wide leading-relaxed"
        style={{ borderTop: '1px solid rgba(148,163,184,0.07)' }}
      >
        DATA&nbsp;·&nbsp;GBIF&nbsp;&nbsp;/&nbsp;&nbsp;SCORES&nbsp;·&nbsp;ATLANTIC FOREST HABITAT + SURVEY GAP
      </div>
    </div>
  )
}

// Separate component to keep survey gap bar animation self-contained
function SurveyGapBar({ pct, animate }: { pct: number; animate: boolean }) {
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!barRef.current || !animate) return
    const el = barRef.current
    el.style.width = '0%'
    const raf = requestAnimationFrame(() => {
      el.style.transition = 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
      el.style.width = `${pct}%`
    })
    return () => cancelAnimationFrame(raf)
  }, [pct, animate])

  return (
    <div
      ref={barRef}
      className="h-full rounded-full"
      style={{
        width: animate ? '0%' : `${pct}%`,
        background: 'rgb(249,115,22)',
      }}
    />
  )
}
