'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/hooks/useAuth'
import { communityEnabled } from '@/lib/supabase'
import {
  CONSENSUS_THRESHOLD,
  createSubmission,
  fetchReviewableSubmissions,
  submitIdentification,
  withdrawSubmission,
  type PendingSubmission,
} from '@/lib/community'

interface Props {
  hexId: string
  /** Hexbin centre, used as the default coordinate for a new observation. */
  center: [number, number]
  /**
   * Frontier score of this hexbin. Above `HIGH_FRONTIER` the panel leads with
   * an invitation to contribute rather than a neutral heading — the whole point
   * of computing the score is knowing where a record is worth most.
   */
  frontierScore: number
  onSubmitted: () => void
}

const HIGH_FRONTIER = 0.6

const inputClass =
  'w-full rounded bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs text-slate-200 ' +
  'placeholder:text-slate-600 focus:outline-none focus:border-emerald-600'

export default function CommunityPanel({ hexId, center, frontierScore, onSubmitted }: Props) {
  const t = useTranslations('Community')
  const { user, loading: authLoading, signIn, signOut } = useAuth()

  const [pending, setPending]   = useState<PendingSubmission[]>([])
  const [busy, setBusy]         = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [notice, setNotice]     = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)

  const [email, setEmail]   = useState('')
  const [name, setName]     = useState('')
  const [date, setDate]     = useState(() => new Date().toISOString().slice(0, 10))
  const [notes, setNotes]   = useState('')

  const [reloadToken, setReloadToken] = useState(0)
  const reload = useCallback(() => setReloadToken(n => n + 1), [])

  // Signed-out visitors cannot read pending rows at all — RLS restricts the
  // table to authenticated users — so this only runs once there is a session.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    void (async () => {
      try {
        const rows = await fetchReviewableSubmissions(hexId)
        if (cancelled) return
        setPending(rows)
        setError(null)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      }
    })()
    return () => { cancelled = true }
  }, [user, hexId, reloadToken])

  if (!communityEnabled) return null

  const run = async (fn: () => Promise<void>, successMessage?: string) => {
    setBusy(true); setError(null); setNotice(null)
    try {
      await fn()
      if (successMessage) setNotice(successMessage)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const handleSignIn = () => run(async () => {
    await signIn(email.trim())
  }, t('magicLinkSent'))

  const handleSubmit = () => run(async () => {
    await createSubmission({
      hexId,
      latitude: center[0],
      longitude: center[1],
      observedOn: date,
      scientificName: name,
      notes,
    })
    setName(''); setNotes(''); setFormOpen(false)
    reload()
    onSubmitted()
  }, t('submitted'))

  const handleVote = (id: string, verdict: 'agree' | 'disagree') => run(async () => {
    await submitIdentification(id, verdict)
    reload()
    onSubmitted()
  })

  const handleWithdraw = (id: string) => run(async () => {
    await withdrawSubmission(id)
    reload()
  })

  const isHighFrontier = frontierScore >= HIGH_FRONTIER

  return (
    <div className="px-4 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.18em]">
          {t('title')}
        </h3>
        {user && (
          <button onClick={signOut} className="text-[10px] text-slate-600 hover:text-slate-400 underline">
            {t('signOut')}
          </button>
        )}
      </div>

      {isHighFrontier && (
        <p className="text-[11px] leading-relaxed text-emerald-400/90">{t('highFrontierPrompt')}</p>
      )}

      {/* The score is a hypothesis about where records are missing, not a
          claim that nothing lives here — say so before asking for data. */}
      <p className="text-[10px] leading-relaxed text-slate-600">{t('reviewExplainer', { n: CONSENSUS_THRESHOLD })}</p>

      {authLoading ? null : !user ? (
        <div className="space-y-2">
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder={t('emailPlaceholder')} className={inputClass} autoComplete="email"
          />
          <button
            onClick={handleSignIn} disabled={busy || !email.trim()}
            className="w-full rounded bg-emerald-700 hover:bg-emerald-600 disabled:bg-slate-800
                       disabled:text-slate-600 px-3 py-1.5 text-xs font-medium text-white transition-colors"
          >
            {t('sendMagicLink')}
          </button>
        </div>
      ) : !formOpen ? (
        <button
          onClick={() => setFormOpen(true)}
          className="w-full rounded border border-emerald-800 bg-emerald-950/40 hover:bg-emerald-900/40
                     px-3 py-1.5 text-xs font-medium text-emerald-300 transition-colors"
        >
          {t('addObservation')}
        </button>
      ) : (
        <div className="space-y-2">
          <input
            value={name} onChange={e => setName(e.target.value)}
            placeholder={t('speciesPlaceholder')} className={inputClass}
          />
          <input type="date" value={date} max={new Date().toISOString().slice(0, 10)}
                 onChange={e => setDate(e.target.value)} className={inputClass} />
          <textarea
            value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            placeholder={t('notesPlaceholder')} className={inputClass}
          />
          <p className="text-[10px] text-slate-600">
            {t('coordinateNote', { lat: center[0].toFixed(4), lng: center[1].toFixed(4) })}
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleSubmit} disabled={busy || !name.trim()}
              className="flex-1 rounded bg-emerald-700 hover:bg-emerald-600 disabled:bg-slate-800
                         disabled:text-slate-600 px-3 py-1.5 text-xs font-medium text-white transition-colors"
            >
              {t('submit')}
            </button>
            <button
              onClick={() => setFormOpen(false)}
              className="rounded border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      )}

      {user && pending.length > 0 && (
        <div className="space-y-2 pt-1">
          <h4 className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.15em]">
            {t('awaitingReview')}
          </h4>
          {pending.map(s => {
            const agrees   = s.identifications.filter(i => i.verdict === 'agree').length
            const disagree = s.identifications.filter(i => i.verdict === 'disagree').length
            const mine     = s.observer_id === user.id
            const myVote   = s.identifications.find(i => i.user_id === user.id)
            return (
              <div key={s.id} className="rounded border border-slate-800 bg-slate-950/60 px-2.5 py-2 space-y-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs italic text-slate-300 truncate">{s.scientific_name}</span>
                  <span className="text-[10px] font-mono text-slate-500 shrink-0">
                    {t('confirmations', { n: agrees, of: CONSENSUS_THRESHOLD })}
                  </span>
                </div>
                <div className="text-[10px] text-slate-600">{s.observed_on}</div>
                {disagree > 0 && (
                  <div className="text-[10px] text-amber-500/80">{t('disputed', { n: disagree })}</div>
                )}
                {s.notes && <p className="text-[10px] text-slate-500 leading-relaxed">{s.notes}</p>}

                {mine ? (
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-600">{t('yourRecord')}</span>
                    <button
                      onClick={() => handleWithdraw(s.id)} disabled={busy}
                      className="text-[10px] text-slate-600 hover:text-red-400 underline"
                    >
                      {t('withdraw')}
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleVote(s.id, 'agree')} disabled={busy}
                      className={`flex-1 rounded px-2 py-1 text-[10px] font-medium transition-colors ${
                        myVote?.verdict === 'agree'
                          ? 'bg-emerald-800 text-white'
                          : 'border border-slate-700 text-slate-400 hover:text-emerald-300 hover:border-emerald-800'
                      }`}
                    >
                      {t('confirm')}
                    </button>
                    <button
                      onClick={() => handleVote(s.id, 'disagree')} disabled={busy}
                      className={`flex-1 rounded px-2 py-1 text-[10px] font-medium transition-colors ${
                        myVote?.verdict === 'disagree'
                          ? 'bg-amber-800 text-white'
                          : 'border border-slate-700 text-slate-400 hover:text-amber-300 hover:border-amber-800'
                      }`}
                    >
                      {t('dispute')}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {notice && <p className="text-[10px] text-emerald-400">{notice}</p>}
      {error  && <p className="text-[10px] text-red-400">{error}</p>}
    </div>
  )
}
