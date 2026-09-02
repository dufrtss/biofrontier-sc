'use client'

// SSR-safe wrapper: ssr:false is only valid inside a Client Component per Next.js 16 docs.
import dynamic from 'next/dynamic'
import type { ScoredHexbin } from '@/lib/types'
import type { ApprovedSubmission } from '@/lib/community'

const GapMapClient = dynamic(
  () => import('./GapMap.client'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center w-full h-full bg-slate-950 text-slate-500 text-sm">
        Loading map…
      </div>
    ),
  }
)

export interface GapMapProps {
  hexbins: Record<string, ScoredHexbin>
  selectedHexId: string | null
  onHexSelect: (hexId: string | null) => void
  onOpenMethodology: (sectionId: string) => void
  /**
   * Consensus-approved community records, drawn as their own marker layer.
   * Kept structurally separate from `hexbins` because they are separate: they
   * contribute nothing to any score in Phase 1.
   */
  communitySubmissions: ApprovedSubmission[]
}

export default function GapMap(props: GapMapProps) {
  return <GapMapClient {...props} />
}
