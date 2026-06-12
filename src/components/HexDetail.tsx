'use client'

import { useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import type { ScoredHexbin, TaxonFilter } from '@/lib/types'
import { scoreToColor } from '@/lib/color'
import { hexCenter } from '@/lib/h3-utils'
import InfoTooltip from './InfoTooltip'

interface Props {
  hex: ScoredHexbin | null
  taxonFilter: TaxonFilter
  onClose: () => void
  onOpenMethodology: (sectionId: string) => void
}

interface AnimatedBarProps {
  label: string
  labelExtra?: React.ReactNode
  value: number
  color: string
  animate: boolean
}

function AnimatedBar({ label, labelExtra, value, color, animate }: AnimatedBarProps) {
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
        <span className="flex items-center text-[11px] text-slate-400 tracking-wide uppercase font-medium">
          {label}{labelExtra}
        </span>
        <span className="text-xs font-mono text-slate-300 tabular-nums">{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden border border-slate-700/50">
        <div
          ref={barRef}
          className="h-full rounded-full"
          style={{ width: animate ? '0%' : `${pct}%`, background: color }}
        />
      </div>
    </div>
  )
}

export default function HexDetail({ hex, taxonFilter, onClose, onOpenMethodology }: Props) {
  const t = useTranslations('HexDetail')
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

  const frontierLabel =
    hex.frontierScore >= 0.8 ? t('criticalGap') :
    hex.frontierScore >= 0.6 ? t('highPotential') :
    hex.frontierScore >= 0.4 ? t('moderate') :
    t('wellSurveyed')

  return (
    <div className="flex flex-col h-full bg-slate-900" style={{ borderLeft: `1px solid rgba(148,163,184,0.12)` }}>

      {/* Header band */}
      <div
        className="relative px-4 pt-4 pb-3 overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${accentColor}18 0%, transparent 60%)`,
          borderBottom: `1px solid ${accentColor}28`,
        }}
      >
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: `repeating-linear-gradient(45deg, ${accentColor} 0px, ${accentColor} 1px, transparent 1px, transparent 8px)`,
          }}
        />

        <div className="relative flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-3">
              {hex.rank > 0 ? (
                <>
                  <span
                    className="text-5xl font-black leading-none tabular-nums tracking-tighter"
                    style={{ color: accentColor, fontFeatureSettings: '"tnum"' }}
                  >
                    #{hex.rank}
                  </span>
                  <div>
                    <div className="text-2xl font-bold leading-none tabular-nums" style={{ color: accentColor }}>
                      {frontierPct}%
                    </div>
                    <div className="text-[9px] font-bold tracking-[0.15em] mt-0.5" style={{ color: `${accentColor}cc` }}>
                      {frontierLabel}
                    </div>
                  </div>
                </>
              ) : (
                <span className="text-sm font-semibold text-slate-500 bg-slate-800 rounded px-2 py-1">
                  {t('unsurveyed')}
                </span>
              )}
            </div>

            <div className="mt-2 font-mono text-[11px] text-slate-500 tracking-wider">
              {Math.abs(lat).toFixed(4)}°S&nbsp;&nbsp;
              {Math.abs(lng).toFixed(4)}°W
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-600 hover:text-slate-300 transition-colors text-base leading-none mt-0.5 ml-2 shrink-0 w-7 h-7 flex items-center justify-center rounded hover:bg-slate-700/60"
            aria-label={t('closePanel')}
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
            {(([
              { label: t('records'),    value: td.occurrenceCount.toLocaleString(),    icon: '◉', tip: t('tooltipRecords'), section: 'data-source' },
              { label: t('species'),    value: td.uniqueSpeciesCount.toLocaleString(), icon: '◈', tip: null, section: null },
              { label: t('observers'),  value: td.uniqueObserverCount.toLocaleString(), icon: '◎', tip: null, section: null },
              { label: t('surveyDays'), value: td.uniqueDateCount.toLocaleString(),    icon: '◇', tip: null, section: null },
            ]) as Array<{ label: string; value: string; icon: string; tip: string | null; section: string | null }>).map(({ label, value, icon, tip, section }) => (
              <div
                key={label}
                className="rounded-lg px-3 py-2.5"
                style={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(148,163,184,0.07)' }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px]" style={{ color: `${accentColor}99` }}>{icon}</span>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">{label}</span>
                  {tip && (
                    <InfoTooltip
                      content={tip}
                      learnMore={section ? { sectionId: section } : undefined}
                      onLearnMore={section ? onOpenMethodology : undefined}
                    />
                  )}
                </div>
                <div className="text-lg font-mono font-bold text-slate-200 tabular-nums leading-none">
                  {value}
                </div>
              </div>
            ))}
          </div>

          {td.firstDate && (
            <div
              className="mt-2 px-3 py-2 rounded-lg text-[11px] font-mono text-slate-500 tracking-wide"
              style={{ background: 'rgba(30,41,59,0.5)', border: '1px solid rgba(148,163,184,0.06)' }}
            >
              <span className="text-slate-600">{t('period')}</span>
              &nbsp;&nbsp;{td.firstDate}&nbsp;→&nbsp;{td.lastDate}
            </div>
          )}
        </div>

        <div className="mx-4 border-t border-slate-800" />

        {/* Score breakdown */}
        <div className="px-4 py-4 space-y-3.5">
          <div className="flex items-center">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.18em]">
              {t('scoreBreakdown')}
            </h3>
            <InfoTooltip
              content={t('tooltipScoreBreakdown')}
              learnMore={{ sectionId: 'frontier-score' }}
              onLearnMore={onOpenMethodology}
            />
          </div>

          <AnimatedBar
            label={t('frontierPotential')}
            labelExtra={
              <InfoTooltip
                content={t('tooltipFrontierPotential')}
                learnMore={{ sectionId: 'frontier-score' }}
                onLearnMore={onOpenMethodology}
              />
            }
            value={hex.frontierScore}
            color={accentColor}
            animate={shouldAnimate}
          />

          <AnimatedBar
            label={t('habitatQuality')}
            labelExtra={
              <InfoTooltip
                content={t('tooltipHabitatQuality')}
                learnMore={{ sectionId: 'habitat-quality' }}
                onLearnMore={onOpenMethodology}
              />
            }
            value={hex.habitatQuality}
            color="rgb(34,197,94)"
            animate={shouldAnimate}
          />

          <AnimatedBar
            label={t('surveyGap')}
            labelExtra={
              <InfoTooltip
                content={t('tooltipSurveyGap')}
                learnMore={{ sectionId: 'survey-effort' }}
                onLearnMore={onOpenMethodology}
              />
            }
            value={1 - hex.effortScore}
            color="rgb(249,115,22)"
            animate={shouldAnimate}
          />

          <div
            className="rounded px-2.5 py-2 text-[10px] leading-relaxed text-slate-600"
            style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.05)' }}
          >
            {t('scoreAnnotation')}
          </div>
        </div>

        {/* Top species */}
        {td.topSpecies.length > 0 && (
          <>
            <div className="mx-4 border-t border-slate-800" />
            <div className="px-4 py-4">
              <div className="flex items-center mb-3">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.18em]">
                  {t('topRecordedSpecies')}
                </h3>
                <InfoTooltip
                  content={t('tooltipTopSpecies')}
                  learnMore={{ sectionId: 'taxa-coverage' }}
                  onLearnMore={onOpenMethodology}
                  align="right"
                />
              </div>
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

        <div className="h-2" />
      </div>

      {/* Footer */}
      <div
        className="px-4 py-2.5 text-[10px] font-mono text-slate-700 tracking-wide leading-relaxed"
        style={{ borderTop: '1px solid rgba(148,163,184,0.07)' }}
      >
        {t('footer')}
      </div>
    </div>
  )
}
