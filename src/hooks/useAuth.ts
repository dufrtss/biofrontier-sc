'use client'

import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

/**
 * The URL fragment as it was when the page loaded.
 *
 * Read at module scope, not inside an effect: supabase-js parses and clears the
 * fragment from its own asynchronous initialisation, which can win the race
 * against a React effect and leave a failed link with nothing to report.
 */
const initialHash = typeof window !== 'undefined' ? window.location.hash : ''

/**
 * Whether this page load is the return trip from a magic link.
 *
 * Read from the same snapshot and for the same reason: `detectSessionInUrl`
 * consumes the fragment during supabase-js's own initialisation, so by the time
 * any component renders there is nothing left to look at. The flow is implicit
 * (see `lib/supabase.ts`), so a successful verification arrives as
 * `#access_token=...`.
 *
 * This is deliberately NOT "is signed in". A session persists across visits,
 * and something that explains what just changed should appear when something
 * just changed — not on every load for the rest of the month.
 */
const arrivedFromMagicLink = /(?:^|[#&])access_token=/.test(initialHash)

/**
 * Where a magic link should land: the current page, minus its fragment.
 *
 * Dropping the fragment is load-bearing. GoTrue reports a failed verification
 * by appending `#error=...&error_code=otp_expired&...` to the redirect target,
 * and a user whose first link failed retries from exactly that page. Passing
 * `window.location.href` would then carry the dead link's error into the next
 * link's `redirect_to`, and on success GoTrue appends `#access_token=...` to a
 * URL that already has a `#`. The browser keeps only the first fragment, so
 * `detectSessionInUrl` reads the stale error instead of the new session: one
 * expired link locks the address out of every link that follows it.
 */
function redirectTarget(): string {
  const { origin, pathname, search } = window.location
  return `${origin}${pathname}${search}`
}

/**
 * Magic-link session state.
 *
 * No password is ever collected. For the audience this tool is built for —
 * students and field biologists who will sign in occasionally, from a phone in
 * the field as often as a desk — an emailed link is both less friction and one
 * fewer credential for us to be responsible for.
 */
export function useAuth() {
  const [user, setUser]           = useState<User | null>(null)
  const [loading, setLoading]     = useState(supabase !== null)
  const [linkError, setLinkError] = useState<string | null>(null)

  // A link that failed verification arrives as an error fragment rather than an
  // exception, so it is invisible unless it is read here. Reading it is also
  // what allows it to be cleared — see `redirectTarget`.
  useEffect(() => {
    if (!initialHash.includes('error')) return
    const params = new URLSearchParams(initialHash.replace(/^#/, ''))
    const code = params.get('error_code')
    if (!code) return
    // Deliberate: the fragment is read once, at load, from outside React. A
    // lazy `useState` initialiser would be the lint-clean shape but the server
    // render has no fragment to read, so it would mismatch on hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLinkError(params.get('error_description') ?? code)
    window.history.replaceState(null, '', redirectTarget())
  }, [])

  useEffect(() => {
    if (!supabase) return
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setUser(data.session?.user ?? null)
      setLoading(false)
    })

    // Fires on sign-in, sign-out, and token refresh — including when
    // `detectSessionInUrl` picks the session out of a magic-link redirect, so
    // the UI updates without a reload.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => { active = false; sub.subscription.unsubscribe() }
  }, [])

  const signIn = useCallback(async (email: string) => {
    if (!supabase) throw new Error('Community contributions are not configured')
    setLinkError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // Back to the page they were on — including the hexbin, which rides in
        // `?hex=` precisely so it survives this round trip. Before that it was
        // React state, and this comment described something that could not
        // happen: the link returned to the map with nothing selected.
        emailRedirectTo: typeof window !== 'undefined' ? redirectTarget() : undefined,
      },
    })
    if (error) throw new Error(error.message)
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) return
    await supabase.auth.signOut()
  }, [])

  return { user, loading, linkError, arrivedFromMagicLink, signIn, signOut }
}
