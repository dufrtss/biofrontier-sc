'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { ScoredHexbin, TaxonFilter } from '@/lib/types'
import { scoreToColor, scoreToInk } from '@/lib/color'
import { hexCenter } from '@/lib/h3-utils'
import { taxonDataFor } from '@/lib/hexbins-file'
import { gbifSpeciesUrl } from '@/lib/gbif'
import InfoTooltip from '@/components/ui/InfoTooltip'
import CommunityPanel from '@/features/community/CommunityPanel'

interface Props {
  hex: ScoredHexbin | null
  taxonFilter: TaxonFilter
  /** Species name → GBIF usage key; a name missing here links to a GBIF search. */
  gbifKeyByName: Map<string, number>
  /** When true the habitat figure is a uniform placeholder, not a measurement. */
  habitatIsPlaceholder: boolean
  onClose: () => void
  onOpenMethodology: (sectionId: string) => void
  /** Called after a community submission or review vote, to refresh the map layer. */
  onCommunityChange: () => void
}

interface AnimatedBarProps {
  label: string
  labelExtra?: React.ReactNode
  value: number
  color: string
  animate: boolean
}

// The three score components are a categorical set: identity, not magnitude.
// Validated all-pairs on white — every one clears 3:1 against the track, worst
// normal-vision ΔE 58.4 and worst deuteranopia ΔE 27.6, against a floor of 15.
// Getting there needed the green and the amber split across LIGHTNESS as well
// as hue: at similar lightness those two collapse to ΔE 9.6 for a deuteranope,
// which is the single most common way a three-colour chart fails. Each bar also
// carries its own text label, so identity never rests on colour alone.
const COMPONENT = {
  habitat:        '#216300',
  gap:            '#d27908',
  incompleteness: '#4841af',
} as const

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
        <span className="flex items-center text-[11px] text-slate-500 tracking-wide uppercase font-medium">
          {label}{labelExtra}
        </span>
        <span className="text-xs font-mono text-slate-500 tabular-nums">{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-50 overflow-hidden border border-slate-200">
        <div
          ref={barRef}
          className="h-full rounded-full"
          style={{ width: animate ? '0%' : `${pct}%`, background: color }}
        />
      </div>
    </div>
  )
}

export default function HexDetail({ hex, taxonFilter, gbifKeyByName, habitatIsPlaceholder, onClose, onOpenMethodology, onCommunityChange }: Props) {
  const t = useTranslations('HexDetail')
  const prevHexIdRef = useRef<string | null>(null)
  const [shouldAnimate, setShouldAnimate] = useState(false)

  useEffect(() => {
    if (hex) {
      setShouldAnimate(hex.hexId !== prevHexIdRef.current)
      prevHexIdRef.current = hex.hexId
    }
  }, [hex])

  if (!hex) return null

  const td = taxonDataFor(hex, taxonFilter)
  const [lat, lng] = hexCenter(hex.hexId)
  // Two colours for one score, because they do two different jobs. The fill is
  // the hexbin's colour on the map, so the panel and the hexagon agree at a
  // glance; the ink is the same score taken down to something legible as type.
  // Inverting the ramp for a light basemap made the palest end unreadable —
  // only the last two steps of the fill ramp clear AA on white — so anything
  // that is a letterform or a hairline uses the ink and anything that is an
  // area uses the fill. See src/lib/color.ts.
  const accentFill = scoreToColor(hex.frontierScore)
  const accentInk  = scoreToInk(hex.frontierScore)
  const frontierPct = Math.round(hex.frontierScore * 100)

  const frontierLabel =
    hex.frontierScore >= 0.8 ? t('criticalGap') :
    hex.frontierScore >= 0.6 ? t('highPotential') :
    hex.frontierScore >= 0.4 ? t('moderate') :
    t('wellSurveyed')

  return (
    <div className="flex flex-col h-full bg-white" style={{ borderLeft: '1px solid #e2e8f0' }}>

      {/* Header band */}
      <div
        className="relative px-4 pt-4 pb-3 overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${accentFill}40 0%, transparent 60%)`,
          borderBottom: `1px solid ${accentInk}33`,
        }}
      >
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: `repeating-linear-gradient(45deg, ${accentInk} 0px, ${accentInk} 1px, transparent 1px, transparent 8px)`,
          }}
        />

        <div className="relative flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-3">
              {hex.rank > 0 ? (
                <>
                  <span
                    className="text-5xl font-black leading-none tabular-nums tracking-tighter"
                    style={{ color: accentInk, fontFeatureSettings: '"tnum"' }}
                  >
                    #{hex.rank}
                  </span>
                  <div>
                    <div className="text-2xl font-bold leading-none tabular-nums" style={{ color: accentInk }}>
                      {frontierPct}%
                    </div>
                    <div className="text-[9px] font-bold tracking-[0.15em] mt-0.5" style={{ color: accentInk }}>
                      {frontierLabel}
                    </div>
                  </div>
                </>
              ) : (
                <span className="text-sm font-semibold text-slate-500 bg-slate-50 rounded px-2 py-1">
                  {t('unsurveyed')}
                </span>
              )}
            </div>

            <div className="mt-2 technical text-[11px] text-slate-600 tracking-wider">
              {Math.abs(lat).toFixed(4)}°S&nbsp;&nbsp;
              {Math.abs(lng).toFixed(4)}°W
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-900 transition-colors text-base leading-none mt-0.5 ml-2 shrink-0 w-7 h-7 flex items-center justify-center rounded hover:bg-slate-100"
            aria-label={t('closePanel')}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>

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
                style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px]" style={{ color: accentInk, opacity: 0.7 }}>{icon}</span>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">{label}</span>
                  {tip && (
                    <InfoTooltip
                      content={tip}
                      learnMore={section ? { sectionId: section } : undefined}
                      onLearnMore={section ? onOpenMethodology : undefined}
                    />
                  )}
                </div>
                <div className="text-lg font-mono font-bold text-slate-800 tabular-nums leading-none">
                  {value}
                </div>
              </div>
            ))}
          </div>

          {td.firstDate && (
            <div
              className="mt-2 px-3 py-2 rounded-lg text-[11px] font-mono text-slate-500 tracking-wide"
              style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}
            >
              <span className="text-slate-500">{t('period')}</span>
              &nbsp;&nbsp;{td.firstDate}&nbsp;→&nbsp;{td.lastDate}
            </div>
          )}
        </div>

        <div className="mx-4 border-t border-slate-200" />

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
            /* Neutral, not the hexbin's green. This bar is the TOTAL and the
               three below it are its components — and at a high score the ramp's
               dark end (#105e00) lands within a few percent of the habitat
               component (#216300), so two adjacent bars came out the same
               colour and the composite read as a fourth component. The tie to
               the map is carried by the header, which is already in the
               hexbin's own colour. */
            color="#334155"
            animate={shouldAnimate}
          />

          {habitatIsPlaceholder ? (
            <div className="space-y-1">
              <div className="flex justify-between items-baseline">
                <span className="flex items-center text-[11px] text-slate-500 tracking-wide uppercase font-medium">
                  {t('habitatQuality')}
                  <InfoTooltip
                    content={t('tooltipHabitatPlaceholder')}
                    learnMore={{ sectionId: 'habitat-quality' }}
                    onLearnMore={onOpenMethodology}
                  />
                </span>
                <span className="text-xs font-mono text-slate-500">—</span>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                {t('habitatPlaceholderNote')}
              </p>
            </div>
          ) : (
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
              color={COMPONENT.habitat}
              animate={shouldAnimate}
            />
          )}

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
            color={COMPONENT.gap}
            animate={shouldAnimate}
          />

          {hex.taxonomicIncompleteness !== null ? (
            <div className="space-y-1">
              <AnimatedBar
                label={t('taxonomicIncompleteness')}
                labelExtra={
                  <InfoTooltip
                    content={t('tooltipIncompleteness')}
                    learnMore={{ sectionId: 'taxonomic-incompleteness' }}
                    onLearnMore={onOpenMethodology}
                  />
                }
                value={hex.taxonomicIncompleteness}
                color={COMPONENT.incompleteness}
                animate={shouldAnimate}
              />
              <p className="text-[10px] text-slate-500 leading-relaxed">
                {t('incompletenessDetail', {
                  missing: hex.missingSpeciesCount,
                  expected: hex.expectedSpeciesCount,
                })}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex justify-between items-baseline">
                <span className="flex items-center text-[11px] text-slate-500 tracking-wide uppercase font-medium">
                  {t('taxonomicIncompleteness')}
                  <InfoTooltip
                    content={t('tooltipIncompleteness')}
                    learnMore={{ sectionId: 'taxonomic-incompleteness' }}
                    onLearnMore={onOpenMethodology}
                  />
                </span>
                <span className="text-xs font-mono text-slate-500">—</span>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                {t('incompletenessUnavailable')}
              </p>
            </div>
          )}

          <div
            className="rounded px-2.5 py-2 text-[10px] leading-relaxed text-slate-500"
            style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}
          >
            {t('scoreAnnotation')}
          </div>
        </div>

        {/* Top species */}
        {td.topSpecies.length > 0 && (
          <>
            <div className="mx-4 border-t border-slate-200" />
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
                      href={gbifSpeciesUrl(name, gbifKeyByName.get(name))}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[12px] italic truncate text-brand-ink hover:underline transition-colors flex-1 min-w-0"
                      title={name}
                    >
                      {name}
                    </a>
                    <span
                      className="text-[11px] font-mono text-slate-500 tabular-nums shrink-0 rounded px-1.5 py-0.5"
                      style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}
                    >
                      {count}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {/* Community contributions. Renders nothing when Supabase is not
            configured, so a fork without a backend keeps the full analysis. */}
        <div className="mx-4 border-t border-slate-200" />
        <CommunityPanel
          /* Remount per hexbin: a different cell is a different question, and
             carrying a half-typed form across would risk filing an observation
             against the wrong one. */
          key={hex.hexId}
          hexId={hex.hexId}
          center={[lat, lng]}
          frontierScore={hex.frontierScore}
          onSubmitted={onCommunityChange}
        />

        <div className="h-2" />
      </div>

      {/* Footer */}
      <div
        className="px-4 py-2.5 text-[10px] font-mono text-slate-500 tracking-wide leading-relaxed"
        style={{ borderTop: '1px solid #e2e8f0' }}
      >
        {t('footer')}
      </div>
    </div>
  )
}
