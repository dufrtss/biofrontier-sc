'use client'

import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

/**
 * Magic-link session state.
 *
 * No password is ever collected. For the audience this tool is built for —
 * students and field biologists who will sign in occasionally, from a phone in
 * the field as often as a desk — an emailed link is both less friction and one
 * fewer credential for us to be responsible for.
 */
export function useAuth() {
  const [user, setUser]       = useState<User | null>(null)
  const [loading, setLoading] = useState(supabase !== null)

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
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // Back to the page they were on, so a link opened on a phone lands on
        // the same hexbin they were looking at.
        emailRedirectTo: typeof window !== 'undefined' ? window.location.href : undefined,
      },
    })
    if (error) throw new Error(error.message)
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) return
    await supabase.auth.signOut()
  }, [])

  return { user, loading, signIn, signOut }
}
