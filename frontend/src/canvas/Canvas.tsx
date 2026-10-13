import { useCallback, useEffect, useRef, useState } from 'react'
import { MAX_NOTE_LENGTH, MAX_STROKE_POINTS, MAX_ZOOM, MIN_ZOOM, type CanvasDoc, type Point, type Stroke, type Tool } from '../canvasTypes'

type CanvasProps = {
  doc: CanvasDoc
  tool: Tool
  onChange: (doc: CanvasDoc) => void
}

type PointerDraft =
  | { kind: 'stroke'; pointerId: number; stroke: Stroke }
  | { kind: 'pan'; pointerId: number; start: Point; camera: CanvasDoc['camera'] }

const BRUSH_COLOR = '#F3F4F6'
const BRUSH_WIDTH = 3
const ERASER_RADIUS = 26

function screenToWorld(point: Point, camera: CanvasDoc['camera'], width: number, height: number): Point {
  return {
    x: (point.x - width / 2) / camera.zoom + camera.x,
    y: (point.y - height / 2) / camera.zoom + camera.y,
  }
}

function worldToScreen(point: Point, camera: CanvasDoc['camera'], width: number, height: number): Point {
  return {
    x: (point.x - camera.x) * camera.zoom + width / 2,
    y: (point.y - camera.y) * camera.zoom + height / 2,
  }
}

function drawStroke(context: CanvasRenderingContext2D, stroke: Stroke, camera: CanvasDoc['camera'], width: number, height: number) {
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
  context.stroke()
}

function drawDocument(canvas: HTMLCanvasElement, doc: CanvasDoc, draft: PointerDraft | null, devicePixelRatio: number) {
  const context = canvas.getContext('2d')
  if (!context) return

  const width = canvas.clientWidth
  const height = canvas.clientHeight
  context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
  context.clearRect(0, 0, width, height)
  doc.strokes.forEach((stroke) => drawStroke(context, stroke, doc.camera, width, height))

  doc.notes.forEach((note) => {
    const screenPoint = worldToScreen({ x: note.x, y: note.y }, doc.camera, width, height)
    context.fillStyle = 'rgba(32, 33, 35, 0.92)'
    context.strokeStyle = 'rgba(255, 255, 255, 0.18)'
    context.lineWidth = 1
    context.beginPath()
    context.roundRect(screenPoint.x - 10, screenPoint.y - 28, 180, 42, 8)
    context.fill()
    context.stroke()
    context.fillStyle = '#F3F4F6'
    context.font = '14px Segoe UI Variable, Segoe UI, sans-serif'
    context.fillText(note.text, screenPoint.x, screenPoint.y - 2, 160)
  })

  if (draft?.kind === 'stroke') drawStroke(context, draft.stroke, doc.camera, width, height)
}

export function Canvas({ doc, tool, onChange }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const docRef = useRef(doc)
  const draftRef = useRef<PointerDraft | null>(null)
  const frameRef = useRef<number | null>(null)
  const dprRef = useRef(window.devicePixelRatio || 1)
  const spacePressedRef = useRef(false)
  const noteInputRef = useRef<HTMLInputElement>(null)
  const [pendingNote, setPendingNote] = useState<{ point: Point; world: Point } | null>(null)
  const [noteText, setNoteText] = useState('')

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
    const canvas = canvasRef.current
    if (canvas) drawDocument(canvas, doc, draftRef.current, dprRef.current)
  }, [doc])

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (canvas) drawDocument(canvas, docRef.current, draftRef.current, dprRef.current)
  }, [])

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

  useEffect(() => {
    if (pendingNote) noteInputRef.current?.focus()
  }, [pendingNote])

  const pointerPosition = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const updateDraft = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const draft = draftRef.current
    if (!draft || draft.pointerId !== event.pointerId) return
    const canvas = event.currentTarget
    const position = pointerPosition(event)

    if (draft.kind === 'stroke') {
      if (draft.stroke.points.length >= MAX_STROKE_POINTS) return
      const rect = canvas.getBoundingClientRect()
      draft.stroke.points.push(screenToWorld(position, docRef.current.camera, rect.width, rect.height))
    } else {
      const dx = (position.x - draft.start.x) / docRef.current.camera.zoom
      const dy = (position.y - draft.start.y) / docRef.current.camera.zoom
      docRef.current = { ...docRef.current, camera: { ...draft.camera, x: draft.camera.x - dx, y: draft.camera.y - dy } }
    }

    if (frameRef.current === null) {
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null
        redraw()
      })
    }
  }

  const finishPointer = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const draft = draftRef.current
    if (!draft || draft.pointerId !== event.pointerId) return
    event.currentTarget.releasePointerCapture(event.pointerId)
    draftRef.current = null

    if (draft.kind === 'pan') {
      if (docRef.current.camera !== draft.camera) onChange(docRef.current)
    } else if (tool === 'eraser') {
      const strokes = docRef.current.strokes.filter((stroke) =>
        !draft.stroke.points.some((cursor) => stroke.points.some((point) => Math.hypot(point.x - cursor.x, point.y - cursor.y) <= ERASER_RADIUS)),
      )
      if (strokes.length !== docRef.current.strokes.length) {
        const nextDoc = { ...docRef.current, strokes }
        docRef.current = nextDoc
        onChange(nextDoc)
      }
    } else if (draft.stroke.points.length > 1) {
      const nextDoc = { ...docRef.current, strokes: [...docRef.current.strokes, draft.stroke] }
      docRef.current = nextDoc
      onChange(nextDoc)
    }
    redraw()
  }

  const startPointer = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget
    const rect = canvas.getBoundingClientRect()
    const position = pointerPosition(event)
    const world = screenToWorld(position, docRef.current.camera, rect.width, rect.height)
    const shouldPan = tool === 'cursor' || event.button === 1 || spacePressedRef.current

    if (tool === 'text' && !shouldPan) {
      setPendingNote({ point: position, world })
      setNoteText('')
      return
    }

    event.currentTarget.setPointerCapture(event.pointerId)
    if (shouldPan) {
      draftRef.current = { kind: 'pan', pointerId: event.pointerId, start: position, camera: docRef.current.camera }
    } else {
      const ids = [...docRef.current.strokes.map((stroke) => stroke.id), ...docRef.current.notes.map((note) => note.id)]
      const id = ids.length === 0 ? 1 : Math.max(...ids) + 1
      draftRef.current = { kind: 'stroke', pointerId: event.pointerId, stroke: { id, points: [world], color: BRUSH_COLOR, width: BRUSH_WIDTH } }
    }
  }

  // The note input takes focus during pointerdown. Without this, the
  // compatibility mousedown that follows moves focus back to the body.
  const keepNoteFocus = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool === 'text') event.preventDefault()
  }

  const zoom = (event: React.WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault()
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, docRef.current.camera.zoom * (event.deltaY < 0 ? 1.1 : 0.9)))
    if (nextZoom === docRef.current.camera.zoom) return
    const nextDoc = { ...docRef.current, camera: { ...docRef.current.camera, zoom: nextZoom } }
    docRef.current = nextDoc
    onChange(nextDoc)
  }

  const commitNote = () => {
    if (!pendingNote) return
    const text = noteText.trim()
    if (text) {
      const ids = [...docRef.current.strokes.map((stroke) => stroke.id), ...docRef.current.notes.map((note) => note.id)]
      const id = ids.length === 0 ? 1 : Math.max(...ids) + 1
      const nextDoc = { ...docRef.current, notes: [...docRef.current.notes, { id, x: pendingNote.world.x, y: pendingNote.world.y, text }] }
      docRef.current = nextDoc
      onChange(nextDoc)
    }
    setPendingNote(null)
    setNoteText('')
  }

  return (
    <div className="canvas-layer">
      <canvas
        ref={canvasRef}
        className="canvas-surface"
        aria-label="Canvas de desenho"
        onPointerDown={startPointer}
        onMouseDown={keepNoteFocus}
        onPointerMove={updateDraft}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
        onWheel={zoom}
      />
      {pendingNote && (
        <input
          ref={noteInputRef}
          className="note-input"
          style={{ left: pendingNote.point.x, top: pendingNote.point.y }}
          aria-label="Texto da nota"
          placeholder="Escreva uma nota"
          maxLength={MAX_NOTE_LENGTH}
          value={noteText}
          onChange={(event) => setNoteText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commitNote()
            if (event.key === 'Escape') setPendingNote(null)
          }}
        />
      )}
    </div>
  )
}
