'use client'

import { useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'

interface MethodologyPanelProps {
  open: boolean
  initialSection?: string
  onClose: () => void
}

interface SectionProps {
  id: string
  title: string
  children: React.ReactNode
}

function Section({ id, title, children }: SectionProps) {
  return (
    <section id={`methodology-${id}`} className="scroll-mt-4">
      <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider mb-3 pb-2 border-b border-slate-700/60">
        {title}
      </h3>
      <div className="text-xs text-slate-400 leading-relaxed space-y-2">{children}</div>
    </section>
  )
}

function Code({ children }: { children: string }) {
  return (
    <pre className="bg-slate-800 border border-slate-700 rounded px-3 py-2 font-mono text-emerald-400 text-[11px] overflow-x-auto whitespace-pre-wrap">
      {children}
    </pre>
  )
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px] border-collapse">
        <thead>
          <tr>
            {headers.map(h => (
              <th key={h} className="text-left text-slate-500 font-medium px-2 py-1.5 border-b border-slate-700">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-slate-800">
              {row.map((cell, j) => (
                <td key={j} className="px-2 py-1.5 text-slate-400 align-top">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function MethodologyPanel({ open, initialSection, onClose }: MethodologyPanelProps) {
  const t = useTranslations('MethodologyPanel')
  const tTaxon = useTranslations('TaxonSelector')
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || !initialSection) return
    const timer = setTimeout(() => {
      const el = document.getElementById(`methodology-${initialSection}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 200)
    return () => clearTimeout(timer)
  }, [open, initialSection])

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/50 z-[1999]" onClick={onClose} aria-hidden />
      )}
      <div
        className={[
          'fixed right-0 top-0 h-full w-full md:w-[480px] bg-slate-900 border-l border-slate-700 z-[2000] flex flex-col transition-transform duration-200',
          open ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
        aria-hidden={!open}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/60 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider font-condensed">
              {t('title')}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">{t('subtitle')}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 text-lg leading-none"
            aria-label={t('close')}
          >
            ✕
          </button>
        </div>

        {/* Scrollable content */}
        <div ref={contentRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-8 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>

          <Section id="frontier-score" title={t('frontierScore.title')}>
            <p>{t('frontierScore.intro')}</p>
            <Code>{'frontier_score = (1 − survey_effort) × 0.53\n               + habitat_quality  × 0.47'}</Code>
            <Table
              headers={t.raw('frontierScore.tableHeaders') as string[]}
              rows={t.raw('frontierScore.tableRows') as string[][]}
            />
            <p>{t('frontierScore.weightsNote')}</p>
            <p className="text-slate-500 italic">{t('frontierScore.caveat')}</p>
          </Section>

          <Section id="survey-effort" title={t('surveyEffort.title')}>
            <p>{t('surveyEffort.intro')}</p>
            <Code>{'effort = unique_observers   × 0.30\n       + unique_survey_days × 0.30\n       + record_density     × 0.25\n       + temporal_span      × 0.15'}</Code>
            <Table
              headers={t.raw('surveyEffort.tableHeaders') as string[]}
              rows={t.raw('surveyEffort.tableRows') as string[][]}
            />
            <p>{t('surveyEffort.normNote')}</p>
          </Section>

          <Section id="habitat-quality" title={t('habitatQuality.title')}>
            <p>{t('habitatQuality.intro')}</p>
            <p className="text-amber-400/80 font-medium">{t('habitatQuality.warning')}</p>
            <p className="text-slate-500">{t('habitatQuality.sourcesLabel')}</p>
            <ul className="list-disc pl-4 space-y-1 text-slate-500">
              {(t.raw('habitatQuality.sources') as string[]).map(s => <li key={s}>{s}</li>)}
            </ul>
          </Section>

          <Section id="data-source" title={t('dataSource.title')}>
            <p>
              {t('dataSource.introPre')}{' '}
              <strong className="text-slate-200">GBIF</strong>{' '}
              {t('dataSource.introPost')}
            </p>
            <p className="text-slate-500">{t('dataSource.contributingLabel')}</p>
            <ul className="list-disc pl-4 space-y-1 text-slate-500">
              {(t.raw('dataSource.contributing') as string[]).map(s => <li key={s}>{s}</li>)}
            </ul>
            <p className="text-slate-500 mt-2">{t('dataSource.excludedLabel')}</p>
            <ul className="list-disc pl-4 space-y-1 text-slate-500">
              {(t.raw('dataSource.excluded') as string[]).map(s => <li key={s}>{s}</li>)}
            </ul>
          </Section>

          <Section id="taxa-coverage" title={t('taxaCoverage.title')}>
            <p>
              <strong className="text-slate-200">{tTaxon('allTaxa')}</strong>{' '}
              {t('taxaCoverage.allIntro')}
            </p>
            <Table
              headers={t.raw('taxaCoverage.taxaTableHeaders') as string[]}
              rows={t.raw('taxaCoverage.taxaTableRows') as string[][]}
            />
            <p className="mt-2">
              <strong className="text-slate-200">{tTaxon('vertebrates')}</strong>{' '}
              {t('taxaCoverage.vertebratesIntro')}
            </p>
            <Table
              headers={t.raw('taxaCoverage.classTableHeaders') as string[]}
              rows={t.raw('taxaCoverage.classTableRows') as string[][]}
            />
            <p className="text-slate-500 mt-2">{t('taxaCoverage.groupsNote')}</p>
          </Section>

          <Section id="geographic-scope" title={t('geographicScope.title')}>
            <p>{t('geographicScope.intro')}</p>
            <p>{t('geographicScope.bboxLabel')}</p>
            <Code>{'North: −25.95°  South: −29.35°\nWest:  −53.85°  East:  −48.35°'}</Code>
            <p>{t('geographicScope.edgeNote')}</p>
            <Table
              headers={t.raw('geographicScope.statsHeaders') as string[]}
              rows={t.raw('geographicScope.statsRows') as string[][]}
            />
          </Section>

          <Section id="scientific-caveats" title={t('scientificCaveats.title')}>
            <p>{t('scientificCaveats.intro')}</p>
            <Table
              headers={t.raw('scientificCaveats.tableHeaders') as string[]}
              rows={t.raw('scientificCaveats.tableRows') as string[][]}
            />
          </Section>

        </div>
      </div>
    </>
  )
}
