import { supabase } from './supabase'

/**
 * Data access for the community contribution layer.
 *
 * Mirrors `supabase/migrations/20260902_0001_community_contributions.sql`. Two
 * invariants from that schema shape everything here:
 *
 *  1. `status` is derived by trigger from peer identifications. Nothing in this
 *     module writes it, and a client that tried would be rejected by the
 *     database. The single exception is an observer withdrawing their own
 *     record, which the schema permits explicitly.
 *  2. Anonymous visitors read `approved_submissions` and nothing else. The
 *     underlying tables are authenticated-only, so the pending-review queries
 *     below simply return empty for a signed-out caller rather than failing.
 */

export interface ApprovedSubmission {
  id: string
  hex_id: string
  latitude: number
  longitude: number
  observed_on: string
  scientific_name: string
  class_name: string | null
  gbif_species_key: number | null
  created_at: string
  observer_display_name: string | null
  confirmation_count: number
}

export interface PendingSubmission {
  id: string
  hex_id: string
  latitude: number
  longitude: number
  observed_on: string
  scientific_name: string
  class_name: string | null
  notes: string | null
  status: 'pending' | 'approved' | 'disputed' | 'withdrawn'
  observer_id: string
  created_at: string
  identifications: Array<{
    id: string
    user_id: string
    verdict: 'agree' | 'disagree'
    proposed_name: string | null
    comment: string | null
  }>
}

export interface NewSubmission {
  hexId: string
  latitude: number
  longitude: number
  observedOn: string
  scientificName: string
  className?: string | null
  notes?: string | null
}

/** Approved records for the public map layer. Works signed out. */
export async function fetchApprovedSubmissions(): Promise<ApprovedSubmission[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('approved_submissions')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

/**
 * Submissions awaiting review in one hexbin, with the identifications already
 * cast so the UI can show progress toward consensus and hide the vote buttons
 * from someone who has already voted.
 *
 * Disputed rows are included: a dispute is an open question for the community,
 * not a closed verdict, and hiding them would strand the record.
 */
export async function fetchReviewableSubmissions(hexId: string): Promise<PendingSubmission[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('submissions')
    .select('*, identifications(id, user_id, verdict, proposed_name, comment)')
    .eq('hex_id', hexId)
    .in('status', ['pending', 'disputed'])
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as PendingSubmission[]
}

/**
 * Records an observation. `observer_id` is set from the caller's own session
 * rather than passed in — the insert policy requires it to equal auth.uid(),
 * so letting a caller supply it could only ever produce a rejected write.
 */
export async function createSubmission(input: NewSubmission): Promise<void> {
  if (!supabase) throw new Error('Community contributions are not configured')
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')

  const { error } = await supabase.from('submissions').insert({
    observer_id:     user.id,
    hex_id:          input.hexId,
    latitude:        input.latitude,
    longitude:       input.longitude,
    observed_on:     input.observedOn,
    scientific_name: input.scientificName.trim(),
    class_name:      input.className ?? null,
    notes:           input.notes?.trim() || null,
  })
  if (error) throw new Error(error.message)
}

/**
 * Confirms or disputes someone else's identification. Upserted on
 * (submission_id, user_id) so changing your mind revises your existing vote
 * instead of failing on the unique constraint — the status trigger recomputes
 * either way.
 */
export async function submitIdentification(
  submissionId: string,
  verdict: 'agree' | 'disagree',
  proposedName?: string,
  comment?: string,
): Promise<void> {
  if (!supabase) throw new Error('Community contributions are not configured')
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')

  const { error } = await supabase.from('identifications').upsert({
    submission_id: submissionId,
    user_id:       user.id,
    verdict,
    proposed_name: verdict === 'disagree' ? proposedName?.trim() || null : null,
    comment:       comment?.trim() || null,
  }, { onConflict: 'submission_id,user_id' })
  if (error) throw new Error(error.message)
}

/** Withdraws your own record. The only status change a client may make. */
export async function withdrawSubmission(submissionId: string): Promise<void> {
  if (!supabase) throw new Error('Community contributions are not configured')
  const { error } = await supabase
    .from('submissions')
    .update({ status: 'withdrawn' })
    .eq('id', submissionId)
  if (error) throw new Error(error.message)
}

/**
 * Agreements needed to approve a submission. Mirrors the constant in
 * `refresh_submission_status`; the database is authoritative and this copy
 * exists only so the UI can show "1 of 2 confirmations" without a round trip.
 */
export const CONSENSUS_THRESHOLD = 2
