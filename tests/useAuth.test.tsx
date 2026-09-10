import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'

const signInWithOtp = vi.fn(async () => ({ error: null }))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithOtp,
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => {},
    },
  },
  communityEnabled: true,
}))

/**
 * `useAuth` reads the fragment at module scope, so each case has to set the URL
 * before the module is first imported. Resetting the registry gives every test
 * its own evaluation of it.
 */
async function mountWith(url: string) {
  window.history.replaceState(null, '', url)
  vi.resetModules()
  const { useAuth } = await import('@/hooks/useAuth')

  function Harness() {
    const { linkError, signIn } = useAuth()
    return (
      <button onClick={() => void signIn('bio@example.org')}>
        {linkError ?? 'no-error'}
      </button>
    )
  }

  render(<Harness />)
  return screen.getByRole('button')
}

const EXPIRED =
  '#error=access_denied&error_code=otp_expired' +
  '&error_description=Email+link+is+invalid+or+has+expired&sb='

describe('useAuth magic-link redirect', () => {
  beforeEach(() => signInWithOtp.mockClear())
  afterEach(cleanup)

  // A fragment that is not an auth error, so the clean-up effect leaves it in
  // place: this is what actually pins `emailRedirectTo` to a bare URL rather
  // than to `window.location.href`.
  it('never sends the current fragment back as the redirect target', async () => {
    const button = await mountWith('/pt-BR#access_token=leftover&token_type=bearer')
    button.click()

    await waitFor(() => expect(signInWithOtp).toHaveBeenCalled())
    const { emailRedirectTo } = signInWithOtp.mock.calls[0][0].options
    expect(emailRedirectTo).not.toContain('#')
    expect(emailRedirectTo).toBe(`${window.location.origin}/pt-BR`)
  })

  it('does not carry a dead link\'s error into the next link', async () => {
    const button = await mountWith(`/pt-BR${EXPIRED}`)
    button.click()

    await waitFor(() => expect(signInWithOtp).toHaveBeenCalled())
    const { emailRedirectTo } = signInWithOtp.mock.calls[0][0].options
    expect(emailRedirectTo).not.toContain('error')
    expect(emailRedirectTo).toBe(`${window.location.origin}/pt-BR`)
  })

  it('keeps the path and query so the link lands back on the same hexbin', async () => {
    const button = await mountWith('/pt-BR?hex=8a2a1072b59ffff')
    button.click()

    await waitFor(() => expect(signInWithOtp).toHaveBeenCalled())
    expect(signInWithOtp.mock.calls[0][0].options.emailRedirectTo)
      .toBe(`${window.location.origin}/pt-BR?hex=8a2a1072b59ffff`)
  })

  it('surfaces a failed link and strips it from the address bar', async () => {
    await mountWith(`/pt-BR${EXPIRED}`)

    await screen.findByText('Email link is invalid or has expired')
    await waitFor(() => expect(window.location.hash).toBe(''))
  })

  it('reports nothing when the page was not reached from a link', async () => {
    const button = await mountWith('/pt-BR')
    expect(button).toHaveTextContent('no-error')
  })
})
