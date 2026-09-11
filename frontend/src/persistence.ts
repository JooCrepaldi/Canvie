import type { Camera, Stroke, TextItem } from './canvasTypes'
import { reseedIds } from './canvasTypes'

export interface CanvasDoc {
  version: 1
  strokes: Stroke[]
  texts: TextItem[]
  camera: Camera
}

export interface StorageAdapter {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const STORAGE_KEY = 'canvie.canvas.v1'

function defaultAdapter(): StorageAdapter | null {
  try {
    if (typeof globalThis.localStorage !== 'undefined') {
      return globalThis.localStorage
    }
  } catch {
    // storage unavailable (privacy mode, SSR, tests without stub)
  }
  return null
}

/** Validate + normalize a parsed doc. Returns null when unusable. */
export function parseDoc(raw: string): CanvasDoc | null {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof data !== 'object' || data === null) return null
  const doc = data as Partial<CanvasDoc>
  if (!Array.isArray(doc.strokes) || !Array.isArray(doc.texts)) return null
  const cam = doc.camera
  const camera: Camera =
    cam && typeof cam.x === 'number' && typeof cam.y === 'number' && typeof cam.zoom === 'number'
      ? { x: cam.x, y: cam.y, zoom: cam.zoom }
      : { x: 0, y: 0, zoom: 1 }
  return { version: 1, strokes: doc.strokes as Stroke[], texts: doc.texts as TextItem[], camera }
}

export function loadDoc(adapter: StorageAdapter | null = defaultAdapter()): CanvasDoc | null {
  if (!adapter) return null
  const raw = adapter.getItem(STORAGE_KEY)
  if (!raw) return null
  const doc = parseDoc(raw)
  if (doc) {
    // Keep id counter ahead of restored ids so new items never collide.
    let maxId = 0
    for (const s of doc.strokes) maxId = Math.max(maxId, s.id)
    for (const t of doc.texts) maxId = Math.max(maxId, t.id)
    reseedIds(maxId)
  }
  return doc
}

export function saveDoc(doc: CanvasDoc, adapter: StorageAdapter | null = defaultAdapter()): void {
  if (!adapter) return
  try {
    adapter.setItem(STORAGE_KEY, JSON.stringify(doc))
  } catch {
    // quota exceeded or unavailable: MVP-0 keeps running in-memory
  }
}

export function clearDoc(adapter: StorageAdapter | null = defaultAdapter()): void {
  try {
    adapter?.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

/** Debounced saver: call on every state change, writes at most once per `delay`. */
export function createSaver(
  delayMs = 500,
  adapter: StorageAdapter | null = defaultAdapter(),
): (doc: CanvasDoc) => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  let pending: CanvasDoc | null = null
  return (doc: CanvasDoc) => {
    pending = doc
    if (timer) return
    timer = setTimeout(() => {
      timer = null
      if (pending) {
        saveDoc(pending, adapter)
        pending = null
      }
    }, delayMs)
  }
}
