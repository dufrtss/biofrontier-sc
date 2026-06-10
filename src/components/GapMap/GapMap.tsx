'use client'

// SSR-safe wrapper: ssr:false is only valid inside a Client Component per Next.js 16 docs.
import dynamic from 'next/dynamic'
import type { ScoredHexbin } from '@/lib/types'

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
}

export default function GapMap(props: GapMapProps) {
  return <GapMapClient {...props} />
}
