import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import type { Tool } from './canvasTypes'

export type AppMode = 'canvas' | 'locked' | 'overlay'

export interface ModeState {
  mode: AppMode
  raised: boolean
}

export function inTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export async function getMode(): Promise<ModeState> {
  if (!inTauri()) return { mode: 'canvas', raised: false }
  try {
    return await invoke<ModeState>('get_mode')
  } catch {
    return { mode: 'canvas', raised: false }
  }
}

export async function toggleLock(): Promise<void> {
  if (!inTauri()) return
  try {
    await invoke('toggle_lock')
  } catch {
    // v1: UI stays usable even if the command is denied
  }
}

export async function toggleOverlay(): Promise<void> {  if (!inTauri()) return
  try {
    await invoke('toggle_overlay')
  } catch {
    // v1: UI stays usable even if the command is denied
  }
}

/// Tell the backend whether Canvas clicks pass through to the desktop
/// (cursor tool). The backend owns the OS click-through flag: calling the
/// Tauri window API directly would drop our Progman parenting.
export async function setPassthrough(active: boolean): Promise<void> {
  if (!inTauri()) return
  try {
    await invoke('set_passthrough', { active })
  } catch {
    // v1: UI stays usable even if the command is denied
  }
}

export async function onModeChanged(cb: (state: ModeState) => void): Promise<UnlistenFn | null> {
  if (!inTauri()) return null
  try {
    return await listen<ModeState>('canvie-mode', (event) => cb(event.payload))
  } catch {
    return null
  }
}

/// Tool picked from the tray menu (tray can't touch React state, so it
/// emits and the frontend applies).
export async function onToolChanged(cb: (tool: Tool) => void): Promise<UnlistenFn | null> {
  if (!inTauri()) return null
  try {
    return await listen<{ tool: Tool }>('canvie-tool', (event) => cb(event.payload.tool))
  } catch {
    return null
  }
}
