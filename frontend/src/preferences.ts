import { reportIssue } from './diagnostics'

// Preferences live next to the document in the WebView2 profile but outside
// it: they are not content, never enter the history and never block a save.
export const TOOLBAR_POSITION_KEY = 'canvie.toolbar'

// The top-left corner of the toolbar bar, in CSS pixels of the window.
export type ToolbarPosition = { left: number; top: number }

function storage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

// null means the default place. An unreadable value is dropped and logged.
export function loadToolbarPosition(): ToolbarPosition | null {
  let raw: string | null = null
  try {
    raw = storage()?.getItem(TOOLBAR_POSITION_KEY) ?? null
  } catch {
    return null
  }
  if (raw === null) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value === 'object' && value !== null && 'left' in value && 'top' in value && Number.isFinite(value.left) && Number.isFinite(value.top)) {
      return { left: Number(value.left), top: Number(value.top) }
    }
  } catch {
    // Falls through to the reset below.
  }
  console.warn('Canvie: saved toolbar position is invalid; using the default')
  reportIssue('toolbar_position_reset')
  saveToolbarPosition(null)
  return null
}

// null forgets the position, so the toolbar returns to its default place.
export function saveToolbarPosition(position: ToolbarPosition | null): void {
  try {
    if (position) storage()?.setItem(TOOLBAR_POSITION_KEY, JSON.stringify(position))
    else storage()?.removeItem(TOOLBAR_POSITION_KEY)
  } catch (error) {
    console.warn('Canvie: toolbar position could not be saved', error)
  }
}
