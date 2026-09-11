'use client'

import { useCallback, useSyncExternalStore } from 'react'
import type { Theme } from '@/lib/color'

export const THEME_STORAGE_KEY = 'biofrontier-theme'

/**
 * The theme, shared by everything that needs it.
 *
 * `<html class="dark">` is the source of truth, not a React state atom, because
 * it is set by an inline script before first paint — see the root layout. That
 * makes the theme genuinely external state, so it is read with
 * useSyncExternalStore rather than mirrored into useState: mirroring means a
 * render pass where the hook says "light" while the page is already painted
 * dark, which is exactly the frame the map would repaint in the wrong palette.
 *
 * A module-level subscriber list rather than a context provider: the consumers
 * are the toggle in the footer and the map, a leaf several levels away that
 * re-renders expensively. A context would put everything between them in the
 * update path for a value only two of them read.
 */
const listeners = new Set<() => void>()

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  return () => { listeners.delete(onChange) }
}

/** Returns a primitive, so React can compare snapshots without caching. */
function getSnapshot(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

/** The server has no <html> to read. Light is what it renders; the inline
 *  script has already corrected the DOM by the time this matters. */
function getServerSnapshot(): Theme {
  return 'light'
}

export function setTheme(theme: Theme): void {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  // Tells the browser which way to paint scrollbars, form controls and the
  // canvas behind the page; without it a dark page keeps white scrollbars.
  root.style.colorScheme = theme
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Private mode, or storage disabled. The choice then lasts the session,
    // which is better than refusing to switch at all.
  }
  listeners.forEach(notify => notify())
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const toggle = useCallback(() => {
    setTheme(getSnapshot() === 'dark' ? 'light' : 'dark')
  }, [])
  return { theme, toggle }
}
