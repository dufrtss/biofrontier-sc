import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import SignedInModal from '@/features/community/SignedInModal'
import { CONSENSUS_THRESHOLD } from '@/lib/community'
import messages from '@/messages/pt-BR.json'

function mount(open: boolean, onClose = () => {}, onShowRanking = () => {}) {
  return render(
    <NextIntlClientProvider locale="pt-BR" messages={messages}>
      <SignedInModal open={open} onClose={onClose} onShowRanking={onShowRanking} />
    </NextIntlClientProvider>,
  )
}

describe('SignedInModal', () => {
  afterEach(cleanup)

  it('renders nothing until it is opened', () => {
    mount(false)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  // The reason this dialog exists: signing in unlocks three things and every
  // one of them is hidden behind a hexbin the reader has not selected.
  it('names what signing in made possible', () => {
    mount(true)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent(messages.SignedIn.title)
    expect(dialog).toHaveTextContent(messages.SignedIn.canAdd)
    expect(dialog).toHaveTextContent(messages.SignedIn.canWithdraw)
    expect(dialog).toHaveTextContent(messages.SignedIn.whereToFind)
  })

  // The threshold is interpolated rather than written into the copy, so a
  // change to the consensus rule cannot leave the explanation lying.
  it('quotes the real consensus threshold', () => {
    mount(true)
    expect(screen.getByRole('dialog')).toHaveTextContent(
      messages.SignedIn.canReview.replace('{n}', String(CONSENSUS_THRESHOLD)),
    )
  })

  // Community records deliberately do not feed the index. Saying so here, and
  // not only after someone has submitted, is the honest ordering.
  it('says up front that community records do not change the score', () => {
    mount(true)
    expect(screen.getByRole('dialog')).toHaveTextContent(messages.SignedIn.notInIndex)
  })

  it('takes the reader to the ranking, which is where contributing starts', async () => {
    const onClose = vi.fn()
    const onShowRanking = vi.fn()
    mount(true, onClose, onShowRanking)

    await userEvent.click(screen.getByRole('button', { name: messages.SignedIn.showRanking }))
    expect(onShowRanking).toHaveBeenCalledOnce()
    // Dismissed too: leaving it open over the panel it just revealed would put
    // the dialog in front of the thing it is pointing at.
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('can be dismissed without going anywhere', async () => {
    const onClose = vi.fn()
    const onShowRanking = vi.fn()
    mount(true, onClose, onShowRanking)

    await userEvent.click(screen.getByRole('button', { name: messages.SignedIn.explore }))
    expect(onClose).toHaveBeenCalledOnce()
    expect(onShowRanking).not.toHaveBeenCalled()
  })

  it('closes on Escape', async () => {
    const onClose = vi.fn()
    mount(true, onClose)
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })
})
