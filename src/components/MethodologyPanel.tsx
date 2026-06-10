'use client'

import { useEffect, useRef } from 'react'

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
        <div
          className="fixed inset-0 bg-black/50 z-[1999]"
          onClick={onClose}
          aria-hidden
        />
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
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider font-condensed">
              How It Works
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Methodology, data sources & scientific caveats</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 text-lg leading-none"
            aria-label="Close methodology panel"
          >
            ✕
          </button>
        </div>

        {/* Scrollable content */}
        <div ref={contentRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-8">

          <Section id="frontier-score" title="Frontier Score">
            <p>
              Each surveyed hexbin receives a Frontier Score combining how little
              it has been studied with how much suitable habitat remains.
            </p>
            <Code>{'frontier_score = (1 − survey_effort) × 0.53\n               + habitat_quality  × 0.47'}</Code>
            <Table
              headers={['Component', 'Range', 'Meaning']}
              rows={[
                ['survey_effort', '0 – 1', 'How intensively the hexbin has been surveyed relative to all others in SC. 0 = never surveyed; 1 = most surveyed.'],
                ['habitat_quality', '0 – 1', 'Estimated fraction of the hexbin covered by Atlantic Forest. Currently a uniform placeholder (0.5).'],
              ]}
            />
            <p>
              Weights (0.53 / 0.47) favour the survey gap slightly because habitat
              data is currently a placeholder. Once real forest-cover data is loaded
              these weights should be re-evaluated.
            </p>
            <p className="text-slate-500 italic">
              This formula is model-deduced and has not been calibrated against
              field discovery rates.
            </p>
          </Section>

          <Section id="survey-effort" title="Survey Effort Score">
            <p>
              Computed from four GBIF-derived metrics, each normalised 0–1
              across all SC hexbins (min-max), then combined with fixed weights.
            </p>
            <Code>{'effort = unique_observers   × 0.30\n       + unique_survey_days × 0.30\n       + record_density     × 0.25\n       + temporal_span      × 0.15'}</Code>
            <Table
              headers={['Input', 'Definition', 'Weight']}
              rows={[
                ['unique_observers', 'Count of distinct recordedBy values', '0.30'],
                ['unique_survey_days', 'Count of distinct eventDate values', '0.30'],
                ['record_density', 'occurrenceCount ÷ hexbin area (≈ 36 km²)', '0.25'],
                ['temporal_span', 'Years between first and last record', '0.15'],
              ]}
            />
            <p>
              Normalisation is relative to the active taxon filter — scores change
              when you switch between All Taxa and Vertebrates, because the
              reference population changes.
            </p>
          </Section>

          <Section id="habitat-quality" title="Habitat Quality">
            <p>
              Intended to represent the fraction of each hexbin covered by
              Atlantic Forest — the biome with the highest endemic species
              richness in Santa Catarina.
            </p>
            <p className="text-amber-400/80 font-medium">
              ⚠ Current status: placeholder value of 0.5 assigned to every hexbin.
              Habitat quality does not currently differentiate frontier locations.
            </p>
            <p>
              To compute real values, download an Atlantic Forest boundary GeoJSON
              and run <span className="font-mono text-emerald-400">npm run data:habitat</span> inside{' '}
              <span className="font-mono text-slate-300">projects/biofrontier-sc/</span>.
              This computes per-hexbin overlap fractions and regenerates the data.
            </p>
            <p className="text-slate-500">Data sources for forest-cover GeoJSON:</p>
            <ul className="list-disc pl-4 space-y-1 text-slate-500">
              <li>SOS Mata Atlântica — sosma.org.br</li>
              <li>MapBiomas Collection (free account) — mapbiomas.org</li>
              <li>IBGE Biomas — ibge.gov.br</li>
            </ul>
          </Section>

          <Section id="data-source" title="Data Source">
            <p>
              All occurrence records come from <strong className="text-slate-300">GBIF</strong> (Global
              Biodiversity Information Facility), an open-access infrastructure
              that aggregates biodiversity data from institutions worldwide.
            </p>
            <p className="text-slate-500">Contributing platforms include:</p>
            <ul className="list-disc pl-4 space-y-1 text-slate-500">
              <li><strong className="text-slate-400">iNaturalist</strong> — research-grade citizen science</li>
              <li><strong className="text-slate-400">speciesLink</strong> — Brazilian natural history collections</li>
              <li><strong className="text-slate-400">CRIA</strong> — Centro de Referência em Informação Ambiental</li>
              <li>Digitised museum and herbarium specimens worldwide</li>
            </ul>
            <p className="text-slate-500 mt-2">What is NOT included:</p>
            <ul className="list-disc pl-4 space-y-1 text-slate-500">
              <li>Private or unpublished research datasets</li>
              <li>Specimens not yet digitised</li>
              <li>Observations recorded after the data fetch date</li>
              <li>Records without GPS coordinates (hasCoordinate=true filter applied)</li>
            </ul>
            <p className="text-slate-500 mt-2">
              This build fetched up to 50,000 records with{' '}
              <span className="font-mono text-slate-400">stateProvince=Santa Catarina, country=BR, hasCoordinate=true</span>.
              Due to GBIF API intermittency, approximately 10,189 records were
              collected. Re-run <span className="font-mono text-emerald-400">npm run data:fetch</span> for
              a more complete dataset.
            </p>
          </Section>

          <Section id="taxa-coverage" title="Taxa Coverage">
            <p>
              <strong className="text-slate-300">All Taxa</strong> includes every organism with a GBIF
              record in SC — not just animals. This includes plants found by
              botanists and citizen naturalists, which is why plant species
              occasionally appear in the recorded species list.
            </p>
            <Table
              headers={['Kingdom', 'Examples']}
              rows={[
                ['Animalia', 'All animals — vertebrates AND invertebrates (insects, crustaceans, molluscs, worms…)'],
                ['Plantae', 'Vascular plants, mosses, ferns, flowering plants'],
                ['Fungi', 'Mushrooms, yeasts, moulds'],
                ['Bacteria', 'Prokaryotes with GBIF records (relatively few)'],
                ['Protozoa', 'Single-celled eukaryotes'],
                ['Chromista', 'Algae, water moulds, diatoms'],
              ]}
            />
            <p className="mt-2">
              <strong className="text-slate-300">Vertebrates</strong> filters to
              animals with a backbone only, using these five GBIF taxonomic classes:
            </p>
            <Table
              headers={['Class', 'GBIF key', 'Examples']}
              rows={[
                ['Mammalia', '359', 'Bats, pumas, tapirs, small rodents'],
                ['Aves', '212', 'All birds'],
                ['Reptilia', '358', 'Snakes, lizards, turtles, caimans'],
                ['Amphibia', '131', 'Frogs, salamanders, caecilians'],
                ['Actinopterygii', '204', 'Ray-finned fish'],
              ]}
            />
            <p className="text-slate-500 mt-2">
              Species group labels (e.g. &quot;(Aves)&quot;) are not shown next to species
              names because kingdom/class information was not retained during the
              current data aggregation. Re-running the pipeline with extended
              fields would enable this.
            </p>
          </Section>

          <Section id="geographic-scope" title="Geographic Scope & Grid">
            <p>
              SC is divided using the <strong className="text-slate-300">H3 hexagonal grid</strong> at{' '}
              <strong className="text-slate-300">resolution 6</strong>, producing cells of approximately{' '}
              <strong className="text-slate-300">36.1 km²</strong> each. Hexagons
              are preferred over squares because all neighbours are equidistant,
              reducing directional bias in spatial analysis.
            </p>
            <p>The grid covers this bounding box — not SC&apos;s administrative boundary:</p>
            <Code>{'North: −25.95°  South: −29.35°\nWest:  −53.85°  East:  −48.35°'}</Code>
            <p>
              Some hexbins near the edges may partially or fully fall outside SC
              proper (into Paraná to the north, Rio Grande do Sul to the south,
              or the Atlantic Ocean to the east). These edge hexbins will have zero
              or few records, which is expected and does not indicate a data error.
            </p>
            <Table
              headers={['Stat', 'Value']}
              rows={[
                ['Total hexbins in bounding box', '6,272'],
                ['Hexbins with ≥ 1 GBIF record', '795'],
                ['Hexbin area', '≈ 36.1 km²'],
                ['H3 resolution', '6'],
              ]}
            />
          </Section>

          <Section id="scientific-caveats" title="Scientific Caveats">
            <p>
              This tool is an <strong className="text-slate-300">exploratory research aid</strong>,
              not a peer-reviewed output. Use rankings to generate hypotheses about
              under-surveyed areas — not to draw conclusions. Cross-reference with
              local knowledge, published flora/fauna checklists, and protected area
              maps before planning expeditions.
            </p>
            <Table
              headers={['Claim', 'Status']}
              rows={[
                ['Frontier score equation', 'Model-deduced. Weights not calibrated against field discovery rates.'],
                ['Habitat quality values', 'Placeholder (0.5 uniform). No real forest-cover data loaded.'],
                ['Species richness per hexbin', 'Lower bound — topSpecies capped at 10 per hexbin.'],
                ['GBIF record completeness', 'Partial. Many valid observations are not in GBIF.'],
                ['Hexbin boundaries', 'Algorithmic, not ecological or administrative.'],
                ['Taxa classification', 'GBIF backbone taxonomy. May differ from other systems.'],
              ]}
            />
            <p className="mt-2">
              <strong className="text-slate-300">Reproducibility:</strong> Data
              pipeline and scoring code are open source at{' '}
              <a
                href="https://github.com/dufrtss/omega"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300"
              >
                github.com/dufrtss/omega
              </a>{' '}
              under <span className="font-mono text-slate-400">projects/biofrontier-sc/</span>.
            </p>
          </Section>

        </div>
      </div>
    </>
  )
}
