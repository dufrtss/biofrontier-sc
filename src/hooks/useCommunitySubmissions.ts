'use client'

import { useCallback, useEffect, useState } from 'react'
import { fetchApprovedSubmissions, type ApprovedSubmission } from '@/lib/community'
import { communityEnabled } from '@/lib/supabase'

/**
 * Consensus-approved community records, for the separate GapMap marker layer.
 *
 * These stay out of the frontier score entirely — they are not merged into the
 * hexbin data, not counted as survey effort, and not passed to any scoring
 * function. That separation is the Phase 1 requirement in
 * `.claude/decisions/biofrontier-community-contributions.md`: the review
 * workflow has to prove itself before community data is allowed to move a
 * published ranking. Folding them into effort is Phase 2.
 *
 * A failure here is surfaced but never fatal — the frontier analysis does not
 * depend on this request, so a Supabase outage should cost the marker layer
 * and nothing else.
 */
export function useCommunitySubmissions() {
  const [submissions, setSubmissions] = useState<ApprovedSubmission[]>([])
  const [error, setError]             = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  /** Requests a refetch. Bumping a token keeps the fetch itself in the effect
   *  below, so state is only ever set from an async continuation. */
  const refresh = useCallback(() => setReloadToken(n => n + 1), [])

  useEffect(() => {
    if (!communityEnabled) return
    let cancelled = false
    void (async () => {
      try {
        const rows = await fetchApprovedSubmissions()
        if (cancelled) return
        setSubmissions(rows)
        setError(null)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      }
    })()
    return () => { cancelled = true }
  }, [reloadToken])

  return { submissions, error, refresh }
}
