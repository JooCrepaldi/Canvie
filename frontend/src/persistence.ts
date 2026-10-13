import {
  createEmptyDocument,
  MAX_NOTE_LENGTH,
  MAX_STROKE_POINTS,
  MAX_ZOOM,
  MIN_ZOOM,
  type Camera,
  type CanvasDoc,
  type Note,
  type Point,
  type Stroke,
} from './canvasTypes'

export const DOCUMENT_STORAGE_KEY = 'canvie.document.v1'
export const INVALID_DOCUMENT_STORAGE_KEY = 'canvie.document.invalid.v1'
export const SAVE_DEBOUNCE_MS = 350

const MAX_STROKES = 10_000
const MAX_NOTES = 10_000
const MAX_COLOR_LENGTH = 64
const MAX_STROKE_WIDTH = 100

type DocumentStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

// recovered: the stored payload was invalid, a copy was kept and saving continues.
// blocked: the stored payload could not be read or copied, so saving stays off
// for the session and the payload is never overwritten.
export type LoadStatus = 'empty' | 'loaded' | 'recovered' | 'blocked'

export type LoadResult = {
  status: LoadStatus
  document: CanvasDoc
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

function isPoint(value: unknown): value is Point {
  return isRecord(value) && isFiniteNumber(value.x) && isFiniteNumber(value.y)
}

function isStroke(value: unknown): value is Stroke {
  return (
    isRecord(value) &&
    isId(value.id) &&
    Array.isArray(value.points) &&
    value.points.length > 0 &&
    value.points.length <= MAX_STROKE_POINTS &&
    value.points.every(isPoint) &&
    typeof value.color === 'string' &&
    value.color.length > 0 &&
    value.color.length <= MAX_COLOR_LENGTH &&
    isFiniteNumber(value.width) &&
    value.width > 0 &&
    value.width <= MAX_STROKE_WIDTH
  )
}

function isNote(value: unknown): value is Note {
  return (
    isRecord(value) &&
    isId(value.id) &&
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y) &&
    typeof value.text === 'string' &&
    value.text.trim().length > 0 &&
    value.text.length <= MAX_NOTE_LENGTH
  )
}

function isCamera(value: unknown): value is Camera {
  return isRecord(value) && isFiniteNumber(value.x) && isFiniteNumber(value.y) && isFiniteNumber(value.zoom) && value.zoom >= MIN_ZOOM && value.zoom <= MAX_ZOOM
}

function hasUniqueIds(strokes: Stroke[], notes: Note[]): boolean {
  const ids = new Set<number>()
  for (const stroke of strokes) ids.add(stroke.id)
  for (const note of notes) ids.add(note.id)
  return ids.size === strokes.length + notes.length
}

export function isCanvasDocument(value: unknown): value is CanvasDoc {
  return (
    isRecord(value) &&
    value.version === 1 &&
    typeof value.revision === 'number' &&
    Number.isSafeInteger(value.revision) &&
    value.revision >= 0 &&
    Array.isArray(value.strokes) &&
    value.strokes.length <= MAX_STROKES &&
    value.strokes.every(isStroke) &&
    Array.isArray(value.notes) &&
    value.notes.length <= MAX_NOTES &&
    value.notes.every(isNote) &&
    isCamera(value.camera) &&
    hasUniqueIds(value.strokes, value.notes)
  )
}

function parseStoredDocument(raw: string): CanvasDoc | null {
  try {
    const value: unknown = JSON.parse(raw)
    return isCanvasDocument(value) ? value : null
  } catch {
    // The parser message can quote the payload, so it is never logged.
    return null
  }
}

function browserStorage(): DocumentStorage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export class DocumentPersistence {
  private readonly storage = browserStorage()
  private readonly listeners = new Set<() => void>()
  private blocked = false
  private failed = false
  private pending: CanvasDoc | null = null
  private timer: ReturnType<typeof setTimeout> | null = null

  load(): LoadResult {
    const empty = createEmptyDocument()
    if (!this.storage) return this.block(empty, 'local storage is unavailable')

    let raw: string | null
    try {
      raw = this.storage.getItem(DOCUMENT_STORAGE_KEY)
    } catch (error) {
      return this.block(empty, 'stored document could not be read', error)
    }
    if (raw === null) return { status: 'empty', document: empty }

    const stored = parseStoredDocument(raw)
    if (stored) return { status: 'loaded', document: stored }
    if (!this.backupInvalid(raw)) return this.block(empty, 'invalid stored document could not be backed up')
    console.warn('Canvie: invalid stored document replaced by an empty canvas; a local copy was kept')
    return { status: 'recovered', document: empty }
  }

  schedule(doc: CanvasDoc): void {
    if (this.blocked) return
    this.pending = doc
    if (this.timer !== null) clearTimeout(this.timer)
    this.timer = setTimeout(() => this.flush(), SAVE_DEBOUNCE_MS)
  }

  flush(): void {
    const pending = this.pending
    this.cancelPending()
    if (!pending) return
    try {
      this.write(pending)
    } catch {
      // write() already logged the failure and exposed it through hasFailed().
    }
  }

  // Expects the current document. A scheduled save is dropped because it is
  // never newer than the document being written now.
  async saveNow(doc: CanvasDoc): Promise<void> {
    this.cancelPending()
    this.write(doc)
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  hasFailed = (): boolean => this.failed

  private cancelPending(): void {
    if (this.timer !== null) clearTimeout(this.timer)
    this.timer = null
    this.pending = null
  }

  private write(doc: CanvasDoc): void {
    try {
      if (this.blocked || !this.storage) throw new Error('document saving is disabled for this session')
      if (!isCanvasDocument(doc)) throw new Error('document failed validation before saving')
      const serialized = JSON.stringify(doc)
      this.storage.setItem(DOCUMENT_STORAGE_KEY, serialized)
      if (this.storage.getItem(DOCUMENT_STORAGE_KEY) !== serialized) throw new Error('document save was not confirmed by storage')
    } catch (error) {
      console.warn('Canvie: document save failed; the last valid document stays in storage', error)
      this.setFailed(true)
      throw error
    }
    this.setFailed(false)
  }

  private backupInvalid(raw: string): boolean {
    if (!this.storage) return false
    try {
      this.storage.removeItem(INVALID_DOCUMENT_STORAGE_KEY)
      this.storage.setItem(INVALID_DOCUMENT_STORAGE_KEY, raw)
      return true
    } catch (error) {
      console.warn('Canvie: invalid stored document could not be backed up', error)
      return false
    }
  }

  private block(empty: CanvasDoc, reason: string, error?: unknown): LoadResult {
    this.blocked = true
    const message = `Canvie: ${reason}; saving is disabled for this session`
    if (error === undefined) console.warn(message)
    else console.warn(message, error)
    return { status: 'blocked', document: empty }
  }

  private setFailed(failed: boolean): void {
    if (this.failed === failed) return
    this.failed = failed
    for (const listener of this.listeners) listener()
  }
}
