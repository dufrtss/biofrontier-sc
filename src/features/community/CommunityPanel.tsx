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

/* True black fill rather than a grey one: on OLED the field is an unlit hole
   and the hairline around it is the whole control. `focus:outline-none` is
   deliberately absent — the global :focus-visible ring is the keyboard
   affordance, and the cyan border is the mouse-visible one on top of it. */
const inputClass =
  'w-full bg-background border border-edge px-2.5 py-1.5 text-xs text-primary ' +
  'placeholder:text-muted focus:border-system transition-colors'

/* The one loud action in the panel: cut corner, cyan edge, no filled slab. */
const primaryAction =
  'notch-sm border border-system bg-system/10 px-3 py-2 hud-label text-system ' +
  'hover:bg-system/20 disabled:border-edge disabled:bg-transparent ' +
  'disabled:text-muted transition-colors'

export default function CommunityPanel({ hexId, center, frontierScore, onSubmitted }: Props) {
  const t = useTranslations('Community')
  const { user, loading: authLoading, linkError, signIn, signOut } = useAuth()

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
        <h3 className="hud-label">{t('title')}</h3>
        {user && (
          <button onClick={signOut} className={`hud-label text-muted hover:text-system transition-colors`}>
            {t('signOut')}
          </button>
        )}
      </div>

      {/* A solid cyan edge rather than a tinted box: the prompt is the panel's
          live signal, and on black a lit rule carries further than a fill. */}
      {isHighFrontier && (
        <p className="border-l-2 border-system pl-2.5 text-[11px] leading-relaxed text-system">
          {t('highFrontierPrompt')}
        </p>
      )}

      {/* The score is a hypothesis about where records are missing, not a
          claim that nothing lives here — say so before asking for data. */}
      <p className="text-[10px] leading-relaxed text-muted">{t('reviewExplainer', { n: CONSENSUS_THRESHOLD })}</p>

      {authLoading ? null : !user ? (
        <div className="space-y-2">
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder={t('emailPlaceholder')} className={inputClass} autoComplete="email"
          />
          <button
            onClick={handleSignIn} disabled={busy || !email.trim()}
            className={`w-full ${primaryAction}`}
          >
            {t('sendMagicLink')}
          </button>
        </div>
      ) : !formOpen ? (
        <button
          onClick={() => setFormOpen(true)}
          className={`w-full border border-edge bg-background px-3 py-2 hud-label
                      text-secondary hover:text-system hover:border-system transition-colors`}
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
                 onChange={e => setDate(e.target.value)} className={`${inputClass} technical`} />
          <textarea
            value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            placeholder={t('notesPlaceholder')} className={inputClass}
          />
          <p className="text-[10px] leading-relaxed text-muted">
            {t('coordinateNote', { lat: center[0].toFixed(4), lng: center[1].toFixed(4) })}
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleSubmit} disabled={busy || !name.trim()}
              className={`flex-1 ${primaryAction}`}
            >
              {t('submit')}
            </button>
            <button
              onClick={() => setFormOpen(false)}
              className={`border border-edge px-3 py-2 hud-label text-muted
                          hover:text-primary hover:border-line-loud transition-colors`}
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      )}

      {user && pending.length > 0 && (
        <div className="space-y-2 pt-1">
          <h4 className="hud-label">{t('awaitingReview')}</h4>
          {pending.map(s => {
            const agrees   = s.identifications.filter(i => i.verdict === 'agree').length
            const disagree = s.identifications.filter(i => i.verdict === 'disagree').length
            const mine     = s.observer_id === user.id
            const myVote   = s.identifications.find(i => i.user_id === user.id)
            return (
              <div key={s.id} className="border border-edge bg-background px-2.5 py-2 space-y-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs italic text-secondary truncate">{s.scientific_name}</span>
                  {/* A count that reaches the threshold is a confirmed record,
                      and phosphor is this palette's "live readout" — the green
                      says approved without spending cyan on it. */}
                  <span
                    className={`technical text-[10px] shrink-0 ${
                      agrees >= CONSENSUS_THRESHOLD ? 'text-phosphor' : 'text-muted'
                    }`}
                  >
                    {t('confirmations', { n: agrees, of: CONSENSUS_THRESHOLD })}
                  </span>
                </div>
                <div className="technical text-[10px] text-muted">{s.observed_on}</div>
                {disagree > 0 && (
                  <div className="text-[10px] text-warning">{t('disputed', { n: disagree })}</div>
                )}
                {s.notes && <p className="text-[10px] text-muted leading-relaxed">{s.notes}</p>}

                {mine ? (
                  <div className="flex items-center justify-between">
                    <span className="hud-label">{t('yourRecord')}</span>
                    <button
                      onClick={() => handleWithdraw(s.id)} disabled={busy}
                      className={`hud-label text-muted hover:text-danger transition-colors`}
                    >
                      {t('withdraw')}
                    </button>
                  </div>
                ) : (
                  /* One segmented control, not two pills: a single hairline box
                     split by a shared border, so the pair reads as one switch
                     with two positions. The cast verdict is held by an inset
                     bar under the label rather than by a filled slab. */
                  <div className="flex border border-edge">
                    <button
                      onClick={() => handleVote(s.id, 'agree')} disabled={busy}
                      className={`flex-1 border-r border-edge px-2 py-1.5 hud-label transition-colors ${
                        myVote?.verdict === 'agree'
                          ? 'bg-phosphor/10 text-phosphor shadow-[inset_0_-2px_0_0_var(--color-phosphor)]'
                          : 'text-muted hover:text-system'
                      }`}
                    >
                      {t('confirm')}
                    </button>
                    <button
                      onClick={() => handleVote(s.id, 'disagree')} disabled={busy}
                      className={`flex-1 px-2 py-1.5 hud-label transition-colors ${
                        myVote?.verdict === 'disagree'
                          ? 'bg-warning/10 text-warning shadow-[inset_0_-2px_0_0_var(--color-warning)]'
                          : 'text-muted hover:text-warning'
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

      {notice && <p className="text-[10px] text-system">{notice}</p>}
      {error  && <p className="text-[10px] text-danger">{error}</p>}
      {linkError && <p className="text-[10px] text-danger">{linkError}</p>}
    </div>
  )
}
