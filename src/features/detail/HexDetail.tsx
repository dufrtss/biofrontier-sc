'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { ScoredHexbin, TaxonFilter } from '@/lib/types'
import { scoreToColor } from '@/lib/color'
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
        <span className="flex items-center hud-label">
          {label}{labelExtra}
        </span>
        <span className="technical text-xs text-secondary">{pct}%</span>
      </div>
      {/* Square ends on a hairline track over black. The component hues are
          validated for colour-blind separation and are the only thing carrying
          identity here, so the bar gives them a hard edge to end on rather than
          a rounded cap that softens the reading. */}
      <div className="h-1.5 bg-background overflow-hidden border border-line">
        <div
          ref={barRef}
          className="h-full"
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
  const accentColor = scoreToColor(hex.frontierScore)
  const frontierPct = Math.round(hex.frontierScore * 100)

  const frontierLabel =
    hex.frontierScore >= 0.8 ? t('criticalGap') :
    hex.frontierScore >= 0.6 ? t('highPotential') :
    hex.frontierScore >= 0.4 ? t('moderate') :
    t('wellSurveyed')

  return (
    <div className="flex flex-col h-full bg-background" style={{ borderLeft: '1px solid var(--color-edge)' }}>

      {/* Header band. The wash that used to fade the ramp colour across this
          block is gone: a gradient over true black is the one place the panel
          still looked moulded. What is left is a flat ground, the technical
          hatch, and the ramp colour spent where it reads hardest — the figures
          and a solid 1px rule under them. */}
      <div className="relative px-4 pt-4 pb-3 overflow-hidden bg-background"
        style={{ borderBottom: `1px solid ${accentColor}` }}
      >
        <div
          className="absolute inset-0 opacity-[0.05] pointer-events-none"
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
                    className="technical text-5xl font-black leading-none"
                    style={{ color: accentColor }}
                  >
                    #{hex.rank}
                  </span>
                  <div>
                    <div className="technical text-2xl font-bold leading-none" style={{ color: accentColor }}>
                      {frontierPct}%
                    </div>
                    <div className="hud-label mt-1" style={{ color: accentColor }}>
                      {frontierLabel}
                    </div>
                  </div>
                </>
              ) : (
                <span className="hud-label border border-edge px-2 py-1">
                  {t('unsurveyed')}
                </span>
              )}
            </div>

            <div className="technical mt-2 text-[11px] text-muted tracking-wider">
              {Math.abs(lat).toFixed(4)}°S&nbsp;&nbsp;
              {Math.abs(lng).toFixed(4)}°W
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-muted hover:text-system transition-colors text-base leading-none mt-0.5 ml-2 shrink-0 w-7 h-7 flex items-center justify-center"
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
              /* Outlined cells on black rather than grey tiles: the figure is
                 the content and the box only has to say where it stops. */
              <div
                key={label}
                className="px-3 py-2.5 bg-background border border-edge"
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-[10px]" style={{ color: accentColor }}>{icon}</span>
                  <span className="hud-label">{label}</span>
                  {tip && (
                    <InfoTooltip
                      content={tip}
                      learnMore={section ? { sectionId: section } : undefined}
                      onLearnMore={section ? onOpenMethodology : undefined}
                    />
                  )}
                </div>
                <div className="technical text-lg font-bold text-primary leading-none">
                  {value}
                </div>
              </div>
            ))}
          </div>

          {td.firstDate && (
            <div className="mt-2 px-3 py-2 flex items-center gap-2 bg-background border border-edge">
              <span className="hud-label">{t('period')}</span>
              <span className="technical text-[11px] text-secondary">
                {td.firstDate}&nbsp;→&nbsp;{td.lastDate}
              </span>
            </div>
          )}
        </div>

        <div className="mx-4 border-t border-line" />

        {/* Score breakdown */}
        <div className="px-4 py-4 space-y-3.5">
          <div className="flex items-center">
            <h3 className="hud-label text-secondary">
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

          {habitatIsPlaceholder ? (
            <div className="space-y-1">
              <div className="flex justify-between items-baseline">
                <span className="flex items-center hud-label">
                  {t('habitatQuality')}
                  <InfoTooltip
                    content={t('tooltipHabitatPlaceholder')}
                    learnMore={{ sectionId: 'habitat-quality' }}
                    onLearnMore={onOpenMethodology}
                  />
                </span>
                <span className="technical text-xs text-muted">—</span>
              </div>
              <p className="text-[10px] text-muted leading-relaxed">
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
              color="var(--color-component-habitat)"
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
            color="var(--color-component-gap)"
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
                color="var(--color-component-incompleteness)"
                animate={shouldAnimate}
              />
              <p className="text-[10px] text-muted leading-relaxed">
                {t('incompletenessDetail', {
                  missing: hex.missingSpeciesCount,
                  expected: hex.expectedSpeciesCount,
                })}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex justify-between items-baseline">
                <span className="flex items-center hud-label">
                  {t('taxonomicIncompleteness')}
                  <InfoTooltip
                    content={t('tooltipIncompleteness')}
                    learnMore={{ sectionId: 'taxonomic-incompleteness' }}
                    onLearnMore={onOpenMethodology}
                  />
                </span>
                <span className="technical text-xs text-muted">—</span>
              </div>
              <p className="text-[10px] text-muted leading-relaxed">
                {t('incompletenessUnavailable')}
              </p>
            </div>
          )}

          {/* Prose, so it stays in sentence case — the label register is for
              labels, and uppercasing an explanation makes it unreadable. */}
          <div className="px-2.5 py-2 text-[10px] leading-relaxed text-muted bg-background border border-line">
            {t('scoreAnnotation')}
          </div>
        </div>

        {/* Top species */}
        {td.topSpecies.length > 0 && (
          <>
            <div className="mx-4 border-t border-line" />
            <div className="px-4 py-4">
              <div className="flex items-center mb-3">
                <h3 className="hud-label text-secondary">
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
                      className="text-[12px] italic truncate text-brand hover:text-highlight transition-colors flex-1 min-w-0"
                      title={name}
                    >
                      {name}
                    </a>
                    <span className="technical text-[11px] text-secondary shrink-0 px-1.5 py-0.5 bg-background border border-line">
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
        <div className="mx-4 border-t border-line" />
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
        className="px-4 py-2.5 hud-label leading-relaxed"
        style={{ borderTop: '1px solid var(--color-line)' }}
      >
        {t('footer')}
      </div>
    </div>
  )
}
