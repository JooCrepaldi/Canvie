export type Point = {
  x: number
  y: number
}

export type Stroke = {
  id: number
  points: Point[]
  color: string
  width: number
}

export type NoteSize = 'small' | 'medium' | 'large'

export type NoteKind = 'text' | 'postit'

// Notes store Markdown. x and y are the top-left corner in world units.
export type Note = {
  id: number
  x: number
  y: number
  text: string
  size: NoteSize
  kind: NoteKind
}

export type Camera = {
  x: number
  y: number
  zoom: number
}

// The area is a rectangle in CSS pixels of the window that hosts the canvas.
export type Area = {
  x: number
  y: number
  width: number
  height: number
}

export type Background = 'paper' | 'transparent'

export type CanvasDoc = {
  version: 1
  revision: number
  area: Area | null
  background: Background
  strokes: Stroke[]
  notes: Note[]
  camera: Camera
}

export type Tool = 'cursor' | 'brush' | 'text' | 'postit' | 'eraser'

export const INK_COLORS = [
  { id: 'black', label: 'preta', value: '#1F2328' },
  { id: 'blue', label: 'azul', value: '#2563EB' },
  { id: 'red', label: 'vermelha', value: '#DC2626' },
] as const

export type Ink = (typeof INK_COLORS)[number]['value']

export const NOTE_SIZES: ReadonlyArray<{ id: NoteSize; short: string; label: string; px: number }> = [
  { id: 'small', short: 'P', label: 'pequeno', px: 14 },
  { id: 'medium', short: 'M', label: 'médio', px: 18 },
  { id: 'large', short: 'G', label: 'grande', px: 24 },
]

export const MIN_ZOOM = 0.25
export const MAX_ZOOM = 4
export const MAX_NOTE_LENGTH = 20_000
export const MAX_STROKE_POINTS = 50_000
export const MIN_AREA_WIDTH = 160
export const MIN_AREA_HEIGHT = 120

export const EMPTY_CAMERA: Camera = { x: 0, y: 0, zoom: 1 }

export function createEmptyDocument(): CanvasDoc {
  return {
    version: 1,
    revision: 0,
    area: null,
    background: 'paper',
    strokes: [],
    notes: [],
    camera: { ...EMPTY_CAMERA },
  }
}
