import { useCallback, useEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react'
import {
  DEFAULT_NOTE_ALIGN,
  MAX_STROKE_POINTS,
  MAX_ZOOM,
  MIN_ZOOM,
  type Area,
  type Brush,
  type Camera,
  type CanvasDoc,
  type Note,
  type NoteAlign,
  type NoteFont,
  type NoteKind,
  type NoteSize,
  type Point,
  type Stroke,
  type Tool,
} from '../canvasTypes'
import { ContextBar } from './ContextBar'
import { NoteEditor } from './NoteEditor'
import { NoteView } from './NoteView'

type CanvasProps = {
  doc: CanvasDoc
  area: Area
  tool: Tool
  ink: string
  brush: Brush
  noteSize: NoteSize
  noteFont: NoteFont
  // The selected note, shown only while tool is select.
  selection: number | null
  onChange: (doc: CanvasDoc) => void
  onNoteSizeChange: (size: NoteSize) => void
  onNoteFontChange: (font: NoteFont) => void
  onSelect: (id: number | null) => void
  // A new note was committed; the app returns to Seleção with it selected.
  onNoteCreated: (id: number) => void
  onEditorChange: (open: boolean) => void
}

type PointerDraft =
  | { kind: 'stroke'; pointerId: number; stroke: Stroke }
  | { kind: 'pan'; pointerId: number; start: Point; camera: Camera }
  | { kind: 'note'; pointerId: number; note: Note; start: Point; element: HTMLDivElement; moved: boolean }

// id is null while a new note has not been committed yet.
// Size and font come from the toolbar while the note is written.
type EditingNote = { id: number | null; x: number; y: number; kind: NoteKind; align: NoteAlign; text: string }

// The pen draws a fine line; the highlighter a wide band.
const BRUSH_WIDTHS: Record<Brush, number> = { pen: 3, highlighter: 18 }
// Highlighter ink lets what is under it show through.
const HIGHLIGHTER_ALPHA = 0.35
const ERASER_RADIUS = 26
const DRAG_THRESHOLD = 3
// Space between the context bar and the top of the selected note.
const CONTEXT_BAR_OFFSET = 46

function screenToWorld(point: Point, camera: Camera, width: number, height: number): Point {
  return {
    x: (point.x - width / 2) / camera.zoom + camera.x,
    y: (point.y - height / 2) / camera.zoom + camera.y,
  }
}

function worldToScreen(point: Point, camera: Camera, width: number, height: number): Point {
  return {
    x: (point.x - camera.x) * camera.zoom + width / 2,
    y: (point.y - camera.y) * camera.zoom + height / 2,
  }
}

function drawStroke(context: CanvasRenderingContext2D, stroke: Stroke, camera: Camera, width: number, height: number) {
  if (stroke.points.length === 0) return

  context.beginPath()
  stroke.points.forEach((point, index) => {
    const screenPoint = worldToScreen(point, camera, width, height)
    if (index === 0) context.moveTo(screenPoint.x, screenPoint.y)
    else context.lineTo(screenPoint.x, screenPoint.y)
  })
  context.strokeStyle = stroke.color
  context.lineWidth = stroke.width * camera.zoom
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.globalAlpha = stroke.brush === 'highlighter' ? HIGHLIGHTER_ALPHA : 1
  context.stroke()
  context.globalAlpha = 1
}

function nextId(doc: CanvasDoc): number {
  const ids = [...doc.strokes.map((stroke) => stroke.id), ...doc.notes.map((note) => note.id)]
  return ids.length === 0 ? 1 : Math.max(...ids) + 1
}

export function Canvas({ doc, area, tool, ink, brush, noteSize, noteFont, selection, onChange, onNoteSizeChange, onNoteFontChange, onSelect, onNoteCreated, onEditorChange }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const notesLayerRef = useRef<HTMLDivElement>(null)
  const noteElements = useRef(new Map<number, HTMLDivElement>())
  const docRef = useRef(doc)
  const draftRef = useRef<PointerDraft | null>(null)
  const frameRef = useRef<number | null>(null)
  const dprRef = useRef(window.devicePixelRatio || 1)
  const spacePressedRef = useRef(false)
  const editingRef = useRef<EditingNote | null>(null)
  const [editing, setEditingState] = useState<EditingNote | null>(null)

  const setEditing = (next: EditingNote | null) => {
    editingRef.current = next
    setEditingState(next)
  }

  const editorOpen = editing !== null
  useEffect(() => {
    onEditorChange(editorOpen)
    return () => onEditorChange(false)
  }, [editorOpen, onEditorChange])

  // Strokes are drawn on the canvas; notes follow the camera through one CSS
  // transform on their layer, so a pan never re-renders React.
  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const current = docRef.current
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    const { camera } = current
    const context = canvas.getContext('2d')
    if (context) {
      context.setTransform(dprRef.current, 0, 0, dprRef.current, 0, 0)
      context.clearRect(0, 0, width, height)
      current.strokes.forEach((stroke) => drawStroke(context, stroke, camera, width, height))
      const draft = draftRef.current
      if (draft?.kind === 'stroke') drawStroke(context, draft.stroke, camera, width, height)
    }
    if (notesLayerRef.current) {
      notesLayerRef.current.style.transform = `translate(${width / 2 - camera.x * camera.zoom}px, ${height / 2 - camera.y * camera.zoom}px) scale(${camera.zoom})`
    }
  }, [])

  const scheduleRedraw = () => {
    if (frameRef.current !== null) return
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null
      redraw()
    })
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') spacePressedRef.current = true
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') spacePressedRef.current = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  useEffect(() => {
    docRef.current = doc
    redraw()
  }, [doc, redraw])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      dprRef.current = window.devicePixelRatio || 1
      canvas.width = Math.max(1, Math.round(rect.width * dprRef.current))
      canvas.height = Math.max(1, Math.round(rect.height * dprRef.current))
      redraw()
    }

    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()
    return () => observer.disconnect()
  }, [redraw])

  const registerNote = useCallback((id: number, element: HTMLDivElement | null) => {
    if (element) noteElements.current.set(id, element)
    else noteElements.current.delete(id)
  }, [])

  // The ref is updated first so a stroke or note started by the same event
  // gets an id beyond this change.
  const change = (next: CanvasDoc) => {
    docRef.current = next
    onChange(next)
  }

  const commitEditing = (note: EditingNote) => {
    const current = docRef.current
    const text = note.text.trimEnd()
    if (note.id === null) {
      if (text.trim() === '') return
      const id = nextId(current)
      change({ ...current, notes: [...current.notes, { id, x: note.x, y: note.y, text, size: noteSize, font: noteFont, align: note.align, kind: note.kind }] })
      onNoteCreated(id)
      return
    }
    const original = current.notes.find((candidate) => candidate.id === note.id)
    if (!original) return
    if (text.trim() === '') {
      change({ ...current, notes: current.notes.filter((candidate) => candidate.id !== note.id) })
    } else if (text !== original.text || noteSize !== original.size || noteFont !== original.font) {
      change({ ...current, notes: current.notes.map((candidate) => (candidate.id === note.id ? { ...candidate, text, size: noteSize, font: noteFont } : candidate)) })
    }
  }

  const finishEditing = (commit: boolean) => {
    const current = editingRef.current
    if (!current) return
    setEditing(null)
    if (commit) commitEditing(current)
  }

  const startEditing = (note: Note) => {
    finishEditing(true)
    onNoteSizeChange(note.size)
    onNoteFontChange(note.font)
    setEditing({ id: note.id, x: note.x, y: note.y, kind: note.kind, align: note.align, text: note.text })
  }

  const canvasPoint = (event: { clientX: number; clientY: number }): Point => {
    const rect = canvasRef.current?.getBoundingClientRect()
    return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) }
  }

  // The right button belongs to the menu: it never draws, erases or writes.
  const startPointer = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.button === 2) return
    const hadEditor = editingRef.current !== null
    finishEditing(true)
    const canvas = event.currentTarget
    const position = canvasPoint(event)
    const world = screenToWorld(position, docRef.current.camera, canvas.clientWidth, canvas.clientHeight)
    const shouldPan = tool === 'hand' || event.button === 1 || spacePressedRef.current

    // A click on the empty canvas clears the selection; Seleção draws nothing.
    if (tool === 'select' && !shouldPan) {
      onSelect(null)
      return
    }

    if ((tool === 'text' || tool === 'postit') && !shouldPan) {
      // The first click outside an open editor only closes it.
      if (!hadEditor) setEditing({ id: null, x: world.x, y: world.y, kind: tool === 'postit' ? 'postit' : 'text', align: DEFAULT_NOTE_ALIGN, text: '' })
      return
    }

    canvas.setPointerCapture(event.pointerId)
    if (shouldPan) {
      draftRef.current = { kind: 'pan', pointerId: event.pointerId, start: position, camera: docRef.current.camera }
    } else {
      draftRef.current = { kind: 'stroke', pointerId: event.pointerId, stroke: { id: nextId(docRef.current), points: [world], color: ink, width: BRUSH_WIDTHS[brush], brush } }
    }
  }

  const startNotePointer = (note: Note, event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button === 2) return
    if (tool === 'text' || tool === 'postit') {
      event.preventDefault()
      event.stopPropagation()
      startEditing(note)
      return
    }
    if (tool !== 'select' || event.button !== 0) return
    event.stopPropagation()
    finishEditing(true)
    onSelect(note.id)
    event.currentTarget.setPointerCapture(event.pointerId)
    draftRef.current = { kind: 'note', pointerId: event.pointerId, note, start: { x: event.clientX, y: event.clientY }, element: event.currentTarget, moved: false }
  }

  const updateDraft = (event: ReactPointerEvent<HTMLDivElement>) => {
    const draft = draftRef.current
    if (!draft || draft.pointerId !== event.pointerId) return
    const canvas = canvasRef.current
    if (!canvas) return
    const zoom = docRef.current.camera.zoom

    if (draft.kind === 'stroke') {
      if (draft.stroke.points.length >= MAX_STROKE_POINTS) return
      draft.stroke.points.push(screenToWorld(canvasPoint(event), docRef.current.camera, canvas.clientWidth, canvas.clientHeight))
      scheduleRedraw()
    } else if (draft.kind === 'pan') {
      const position = canvasPoint(event)
      const dx = (position.x - draft.start.x) / zoom
      const dy = (position.y - draft.start.y) / zoom
      docRef.current = { ...docRef.current, camera: { ...draft.camera, x: draft.camera.x - dx, y: draft.camera.y - dy } }
      scheduleRedraw()
    } else {
      const dx = event.clientX - draft.start.x
      const dy = event.clientY - draft.start.y
      if (!draft.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
      draft.moved = true
      draft.element.style.left = `${draft.note.x + dx / zoom}px`
      draft.element.style.top = `${draft.note.y + dy / zoom}px`
    }
  }

  const finishPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const draft = draftRef.current
    if (!draft || draft.pointerId !== event.pointerId) return
    if (event.target instanceof Element && event.target.hasPointerCapture(event.pointerId)) event.target.releasePointerCapture(event.pointerId)
    draftRef.current = null
    const current = docRef.current

    if (draft.kind === 'pan') {
      if (current.camera !== draft.camera) change(current)
    } else if (draft.kind === 'note') {
      if (draft.moved) {
        const zoom = current.camera.zoom
        const x = draft.note.x + (event.clientX - draft.start.x) / zoom
        const y = draft.note.y + (event.clientY - draft.start.y) / zoom
        change({ ...current, notes: current.notes.map((note) => (note.id === draft.note.id ? { ...note, x, y } : note)) })
      }
    } else if (tool === 'eraser') {
      const path = draft.stroke.points
      const strokes = current.strokes.filter((stroke) => !path.some((cursor) => stroke.points.some((point) => Math.hypot(point.x - cursor.x, point.y - cursor.y) <= ERASER_RADIUS)))
      // Note boxes come from layout, which is in world units inside the scaled layer.
      const notes = current.notes.filter((note) => {
        const element = noteElements.current.get(note.id)
        if (!element) return true
        const right = note.x + element.offsetWidth
        const bottom = note.y + element.offsetHeight
        return !path.some((cursor) => cursor.x >= note.x && cursor.x <= right && cursor.y >= note.y && cursor.y <= bottom)
      })
      if (strokes.length !== current.strokes.length || notes.length !== current.notes.length) change({ ...current, strokes, notes })
    } else if (draft.stroke.points.length > 1) {
      change({ ...current, strokes: [...current.strokes, draft.stroke] })
    }
    redraw()
  }

  // The note editor takes focus during pointerdown. Without this, the
  // compatibility mousedown that follows moves focus back to the body.
  const keepNoteFocus = (event: ReactMouseEvent<HTMLCanvasElement>) => {
    if (tool === 'text' || tool === 'postit') event.preventDefault()
  }

  const zoom = (event: ReactWheelEvent<HTMLDivElement>) => {
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, docRef.current.camera.zoom * (event.deltaY < 0 ? 1.1 : 0.9)))
    if (nextZoom === docRef.current.camera.zoom) return
    change({ ...docRef.current, camera: { ...docRef.current.camera, zoom: nextZoom } })
  }

  // A double click on the empty canvas starts a text note there, in Seleção
  // or with the Mão; the pen and the eraser keep drawing.
  const writeAt = (event: ReactMouseEvent<HTMLCanvasElement>) => {
    if (tool !== 'select' && tool !== 'hand') return
    const canvas = event.currentTarget
    const world = screenToWorld(canvasPoint(event), docRef.current.camera, canvas.clientWidth, canvas.clientHeight)
    setEditing({ id: null, x: world.x, y: world.y, kind: 'text', align: DEFAULT_NOTE_ALIGN, text: '' })
  }

  const notesInteractive = tool === 'select' || tool === 'text' || tool === 'postit'
  const selected = tool === 'select' && editing === null ? doc.notes.find((note) => note.id === selection) : undefined
  const barPosition = selected && worldToScreen({ x: selected.x, y: selected.y }, doc.camera, area.width, area.height)

  const align = (next: Note['align']) => {
    if (!selected || selected.align === next) return
    change({ ...docRef.current, notes: docRef.current.notes.map((note) => (note.id === selected.id ? { ...note, align: next } : note)) })
  }

  return (
    <div
      className={`canvas-area background-${doc.background}`}
      style={{ left: area.x, top: area.y, width: area.width, height: area.height }}
      onPointerMove={updateDraft}
      onPointerUp={finishPointer}
      onPointerCancel={finishPointer}
      onWheel={zoom}
    >
      <canvas ref={canvasRef} className={`canvas-surface tool-${tool}`} aria-label="Canvas de desenho" onPointerDown={startPointer} onMouseDown={keepNoteFocus} onDoubleClick={writeAt} />
      <div className="notes-layer" ref={notesLayerRef}>
        {doc.notes.map((note) =>
          note.id === editing?.id ? null : (
            <NoteView key={note.id} note={note} interactive={notesInteractive} selected={note.id === selected?.id} elementRef={registerNote} onPointerDown={startNotePointer} onEdit={startEditing} />
          ),
        )}
        {editing && (
          <NoteEditor
            x={editing.x}
            y={editing.y}
            kind={editing.kind}
            size={noteSize}
            font={noteFont}
            align={editing.align}
            text={editing.text}
            onTextChange={(text) => setEditing(editingRef.current && { ...editingRef.current, text })}
            onCommit={() => finishEditing(true)}
            onCancel={() => finishEditing(false)}
          />
        )}
      </div>
      {selected && barPosition && <ContextBar left={barPosition.x} top={Math.max(4, barPosition.y - CONTEXT_BAR_OFFSET)} align={selected.align} onAlign={align} />}
    </div>
  )
}
