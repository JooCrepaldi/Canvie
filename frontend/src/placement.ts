import { invoke, isTauri } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

export type Placement = 'wall' | 'edit'

export type PlacementSnapshot = {
  placement: Placement
  embedded: boolean
}

const PLACEMENT_EVENT = 'canvie-placement'

// The browser has no desktop to pin to, so it always edits.
const BROWSER_SNAPSHOT: PlacementSnapshot = { placement: 'edit', embedded: false }

// In Tauri the frontend shows Wall until the backend says otherwise.
export function initialPlacement(): Placement {
  return isTauri() ? 'wall' : BROWSER_SNAPSHOT.placement
}

export async function getPlacement(): Promise<PlacementSnapshot | null> {
  if (!isTauri()) return BROWSER_SNAPSHOT
  try {
    return await invoke<PlacementSnapshot>('get_placement')
  } catch (error) {
    console.warn('Canvie: get_placement failed; waiting for the placement event', error)
    return null
  }
}

export function onPlacementChanged(listener: (snapshot: PlacementSnapshot) => void): () => void {
  if (!isTauri()) return () => undefined
  let disposed = false
  let unlisten: (() => void) | null = null
  listen<PlacementSnapshot>(PLACEMENT_EVENT, (event) => listener(event.payload))
    .then((stop) => {
      if (disposed) stop()
      else unlisten = stop
    })
    .catch((error: unknown) => console.warn('Canvie: placement events unavailable', error))
  return () => {
    disposed = true
    unlisten?.()
  }
}
