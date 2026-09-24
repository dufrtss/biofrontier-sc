import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import messages from '@/messages/pt-BR.json'

const authState = {
  user: null as { id: string; email: string } | null,
  loading: false,
  linkError: null,
  arrivedFromMagicLink: false,
  signIn: vi.fn(),
  signOut: vi.fn(),
}

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => authState }))
vi.mock('@/lib/supabase', () => ({ communityEnabled: () => true }))
vi.mock('@/lib/community', async () => {
  const actual = await vi.importActual<typeof import('@/lib/community')>('@/lib/community')
  return {
    ...actual,
    fetchReviewableSubmissions: vi.fn(async () => []),
    createSubmission: vi.fn(),
    submitIdentification: vi.fn(),
    withdrawSubmission: vi.fn(),
  }
})

const { default: CommunityPanel } = await import('@/features/community/CommunityPanel')

const HIGHLIGHT = 'shadow-[0_0_0_3px_var(--color-brand-ink)]'

function mount() {
  return render(
    <NextIntlClientProvider locale="pt-BR" messages={messages}>
      <CommunityPanel hexId="86a8100dfffffff" center={[-27.5, -48.5]} frontierScore={0.8} onSubmitted={() => {}} />
    </NextIntlClientProvider>,
  )
}

/** The panel's outermost element, which carries the arrival ring. */
function panel(container: HTMLElement) {
  return container.firstElementChild as HTMLElement
}

describe('CommunityPanel: magic-link arrival', () => {
  let scrollIntoView: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    authState.user = null
    authState.arrivedFromMagicLink = false
  })

  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  it('scrolls the panel into view and rings it when a magic link lands', () => {
    authState.user = { id: 'u1', email: 'a@b.c' }
    authState.arrivedFromMagicLink = true

    const { container } = mount()
    act(() => { vi.advanceTimersByTime(0) })

    expect(scrollIntoView).toHaveBeenCalledOnce()
    expect(panel(container).className).toContain(HIGHLIGHT)
  })

  it('holds the ring instead of clearing it on a timer', () => {
    // It used to clear at 2600ms. In the light theme, which is the default,
    // that was over before the reader had looked away from the map.
    authState.user = { id: 'u1', email: 'a@b.c' }
    authState.arrivedFromMagicLink = true

    const { container } = mount()
    act(() => { vi.advanceTimersByTime(0) })
    expect(panel(container).className).toContain(HIGHLIGHT)

    act(() => { vi.advanceTimersByTime(5000) })
    expect(panel(container).className).toContain(HIGHLIGHT)
  })

  it.each([
    ['a click', () => window.dispatchEvent(new Event('pointerdown'))],
    ['a keystroke', () => window.dispatchEvent(new Event('keydown'))],
  ])('clears the ring on %s', (_label, interact) => {
    authState.user = { id: 'u1', email: 'a@b.c' }
    authState.arrivedFromMagicLink = true

    const { container } = mount()
    act(() => { vi.advanceTimersByTime(0) })
    expect(panel(container).className).toContain(HIGHLIGHT)

    act(() => { interact() })
    expect(panel(container).className).not.toContain(HIGHLIGHT)
  })

  it('does not treat the arrival scroll as a dismissal', () => {
    // scrollIntoView emits scroll events, and a smooth scroll keeps emitting
    // for its whole duration, so a scroll listener would clear the ring while
    // it was still being drawn.
    authState.user = { id: 'u1', email: 'a@b.c' }
    authState.arrivedFromMagicLink = true

    const { container } = mount()
    act(() => { vi.advanceTimersByTime(0) })

    act(() => { window.dispatchEvent(new Event('scroll')) })
    expect(panel(container).className).toContain(HIGHLIGHT)
  })

  it('still gives up eventually on a tab left open', () => {
    authState.user = { id: 'u1', email: 'a@b.c' }
    authState.arrivedFromMagicLink = true

    const { container } = mount()
    act(() => { vi.advanceTimersByTime(0) })
    act(() => { vi.advanceTimersByTime(15_000) })

    expect(panel(container).className).not.toContain(HIGHLIGHT)
  })

  it('does nothing on an ordinary visit', () => {
    authState.user = { id: 'u1', email: 'a@b.c' }
    authState.arrivedFromMagicLink = false

    const { container } = mount()
    act(() => { vi.advanceTimersByTime(10) })

    expect(scrollIntoView).not.toHaveBeenCalled()
    expect(panel(container).className).not.toContain(HIGHLIGHT)
  })

  it('waits for the session before greeting', () => {
    authState.user = null
    authState.arrivedFromMagicLink = true

    mount()
    act(() => { vi.advanceTimersByTime(10) })

    expect(scrollIntoView).not.toHaveBeenCalled()
  })
})
