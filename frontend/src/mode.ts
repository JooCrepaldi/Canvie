import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

export type AppMode = 'canvas' | 'locked' | 'overlay'

export function inTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export async function getMode(): Promise<AppMode> {
  if (!inTauri()) return 'canvas'
  try {
    return (await invoke<string>('get_mode')) as AppMode
  } catch {
    return 'canvas'
  }
}

export async function toggleLock(): Promise<void> {
  if (!inTauri()) return
  try {
    await invoke('toggle_lock')
  } catch {
    // MVP-0: UI stays usable even if the command is denied
  }
}

export async function toggleOverlay(): Promise<void> {
  if (!inTauri()) return
  try {
    await invoke('toggle_overlay')
  } catch {
    // MVP-0: UI stays usable even if the command is denied
  }
}

export async function onModeChanged(cb: (mode: AppMode) => void): Promise<UnlistenFn | null> {
  if (!inTauri()) return null
  try {
    return await listen<AppMode>('canvie-mode', (event) => cb(event.payload))
  } catch {
    return null
  }
}
