import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import DonateModal, { DONATE_URL } from '@/features/donate/DonateModal'
import messages from '@/messages/pt-BR.json'

function mount(open: boolean, onClose = () => {}) {
  return render(
    <NextIntlClientProvider locale="pt-BR" messages={messages}>
      <DonateModal open={open} onClose={onClose} />
    </NextIntlClientProvider>,
  )
}

describe('DonateModal', () => {
  afterEach(cleanup)

  it('renders nothing until it is opened', () => {
    mount(false)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  // The whole point of the interstitial: the thanks has to reach the reader
  // before PayPal does.
  it('thanks the reader for using, contributing and supporting', () => {
    mount(true)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent(messages.Donate.title)
    expect(dialog).toHaveTextContent(messages.Donate.usingIt)
    expect(dialog).toHaveTextContent(messages.Donate.contributing)
    expect(dialog).toHaveTextContent(messages.Donate.supporting)
  })

  it('does not reach PayPal until the reader chooses to', async () => {
    let closed = false
    mount(true, () => { closed = true })

    const link = screen.getByRole('link', { name: messages.Donate.continue })
    expect(link).toHaveAttribute('href', DONATE_URL)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
    expect(closed).toBe(false)

    await userEvent.click(link)
    expect(closed).toBe(true)
  })

  it('closes on Escape, "later", the ✕ and the backdrop', async () => {
    const dismissals: Array<() => Promise<unknown>> = [
      () => userEvent.keyboard('{Escape}'),
      () => userEvent.click(screen.getByText(messages.Donate.later)),
      () => userEvent.click(screen.getByLabelText(messages.Donate.close)),
      // The backdrop is the dialog's parent; clicking the dialog itself must
      // NOT close it, which the next assertion block covers.
      () => userEvent.click(screen.getByRole('dialog').parentElement!),
    ]

    for (const dismiss of dismissals) {
      let closed = false
      mount(true, () => { closed = true })
      await dismiss()
      expect(closed).toBe(true)
      cleanup()
    }
  })

  // Enter on an auto-focused payment link would send someone to PayPal without
  // them choosing to, which is exactly what this dialog exists to prevent.
  it('does not put focus on the outbound payment link', () => {
    mount(true)
    expect(document.activeElement).toBe(screen.getByRole('dialog'))
  })

  it('stays open when the dialog body itself is clicked', async () => {
    let closed = false
    mount(true, () => { closed = true })

    await userEvent.click(screen.getByRole('dialog'))
    expect(closed).toBe(false)
  })
})
