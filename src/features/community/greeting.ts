/**
 * Whether the post-sign-in dialog should be shown on this page load.
 *
 * Pulled out of AppShell because getting it wrong is not visible in a diff: the
 * dialog appears on one specific journey, and every mistake so far has been a
 * condition that looked right in the JSX and described the wrong thing.
 */
export interface GreetingInputs {
  /** This load is the return trip from a magic link, read from the URL fragment. */
  arrivedFromMagicLink: boolean
  /** A session has resolved. */
  hasUser: boolean
  /** The reader has already closed the dialog on this load. */
  dismissed: boolean
  /** The dataset is in, so there is something for the dialog to point at. */
  selectionRestored: boolean
  /**
   * The URL carried a hexbin when the page loaded.
   *
   * This is the whole point of the check, and it must be the URL as it ARRIVED
   * rather than whether a hexbin is selected right now. Those two agree on the
   * first frame and diverge immediately afterwards, because the reader can
   * select and deselect hexbins at will.
   *
   * Reading live selection instead meant the dialog was suppressed by any open
   * detail panel and then appeared the moment one was closed, which is how a
   * dialog explaining that you have just signed in ends up ambushing someone
   * several clicks later.
   */
  arrivedWithHex: boolean
}

export function shouldGreetOnArrival(i: GreetingInputs): boolean {
  if (!i.arrivedFromMagicLink) return false
  if (!i.hasUser) return false
  if (i.dismissed) return false
  if (!i.selectionRestored) return false
  // The link brought the reader back to a hexbin, so they land on the
  // submission form itself and a dialog would cover the thing it points at.
  if (i.arrivedWithHex) return false
  return true
}
