import { invoke, isTauri } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

export type Placement = 'wall' | 'edit'

export type PlacementSnapshot = {
  placement: Placement
  embedded: boolean
}

const PLACEMENT_EVENT = 'canvie-placement'
const PIN_REQUESTED_EVENT = 'canvie-pin-requested'

// The browser has no desktop to pin to: an in-memory adapter switches the
// view between Wall and Edit, and Ctrl + Alt + T stands in for the global
// shortcut, so the canvas stays testable without Tauri.
const browser = {
  snapshot: { placement: 'edit', embedded: false } as PlacementSnapshot,
  placementListeners: new Set<(snapshot: PlacementSnapshot) => void>(),
  pinListeners: new Set<() => void>(),
}

function setBrowserPlacement(placement: Placement): void {
  browser.snapshot = { placement, embedded: false }
  for (const listener of browser.placementListeners) listener(browser.snapshot)
}

if (!isTauri()) {
  window.addEventListener('keydown', (event) => {
    if (!event.ctrlKey || !event.altKey || event.key.toLowerCase() !== 't') return
    event.preventDefault()
    if (browser.snapshot.placement === 'wall') setBrowserPlacement('edit')
    else for (const listener of browser.pinListeners) listener()
  })
}

// In Tauri the frontend shows Wall until the backend says otherwise.
export function initialPlacement(): Placement {
  return isTauri() ? 'wall' : browser.snapshot.placement
}

export async function getPlacement(): Promise<PlacementSnapshot | null> {
  if (!isTauri()) return browser.snapshot
  try {
    return await invoke<PlacementSnapshot>('get_placement')
  } catch (error) {
    console.warn('Canvie: get_placement failed; waiting for the placement event', error)
    return null
  }
}

export async function enterEdit(): Promise<void> {
  if (!isTauri()) return setBrowserPlacement('edit')
  await invoke('enter_edit')
}

// The caller saves the document first; the backend only moves the window.
export async function pinToWall(): Promise<void> {
  if (!isTauri()) return setBrowserPlacement('wall')
  await invoke('pin_to_wall')
}

// ready settles once the listener is registered in the backend. An event
// emitted before that is lost, so state read after ready is complete.
export type Subscription = {
  ready: Promise<void>
  unsubscribe: () => void
}

function subscribe<T>(event: string, onEvent: (payload: T) => void): Subscription {
  let disposed = false
  let unlisten: (() => void) | null = null
  const ready = listen<T>(event, (message) => onEvent(message.payload))
    .then((stop) => {
      if (disposed) stop()
      else unlisten = stop
    })
    .catch((error: unknown) => console.warn(`Canvie: ${event} events unavailable`, error))
  return {
    ready,
    unsubscribe: () => {
      disposed = true
      unlisten?.()
    },
  }
}

export function onPlacementChanged(listener: (snapshot: PlacementSnapshot) => void): Subscription {
  if (!isTauri()) {
    browser.placementListeners.add(listener)
    return {
      ready: Promise.resolve(),
      unsubscribe: () => {
        browser.placementListeners.delete(listener)
      },
    }
  }
  return subscribe<PlacementSnapshot>(PLACEMENT_EVENT, listener)
}

// The shortcut and the tray ask the frontend to save and pin during Edit.
export function onPinRequested(listener: () => void): () => void {
  if (!isTauri()) {
    browser.pinListeners.add(listener)
    return () => {
      browser.pinListeners.delete(listener)
    }
  }
  return subscribe<null>(PIN_REQUESTED_EVENT, () => listener()).unsubscribe
}
