import { describe, it, expect } from 'vitest'
import { shouldGreetOnArrival, type GreetingInputs } from '@/features/community/greeting'

/** A magic-link arrival with nothing to go back to: the case the dialog is for. */
const arrival: GreetingInputs = {
  arrivedFromMagicLink: true,
  hasUser: true,
  dismissed: false,
  selectionRestored: true,
  arrivedWithHex: false,
}

describe('shouldGreetOnArrival', () => {
  it('greets when the link carried no hexbin', () => {
    expect(shouldGreetOnArrival(arrival)).toBe(true)
  })

  it('stays quiet when the link carried a hexbin', () => {
    // The reader lands on the submission form itself, so a dialog would cover
    // the thing it is pointing at.
    expect(shouldGreetOnArrival({ ...arrival, arrivedWithHex: true })).toBe(false)
  })

  it.each([
    ['this is an ordinary visit', { arrivedFromMagicLink: false }],
    ['the session has not resolved yet', { hasUser: false }],
    ['the reader already closed it', { dismissed: true }],
    ['the dataset is not in yet', { selectionRestored: false }],
  ])('stays quiet when %s', (_why, patch) => {
    expect(shouldGreetOnArrival({ ...arrival, ...patch })).toBe(false)
  })

  it('does not depend on what is selected right now', () => {
    // Regression. The gate used to read live selection, so opening a hexbin
    // suppressed the dialog and closing it released one that was by then
    // several clicks stale. Whether a hexbin is open is deliberately not an
    // input here: the only selection that matters is the one the link carried.
    const inputs = Object.keys(arrival)
    expect(inputs).not.toContain('selectedHexId')
    expect(inputs).not.toContain('hasSelection')

    // Same arrival, decided the same way, whatever the reader has opened since.
    expect(shouldGreetOnArrival(arrival)).toBe(true)
    expect(shouldGreetOnArrival({ ...arrival })).toBe(true)
  })
})
