export type Point = {
  x: number
  y: number
}

// The value lists of the document. Each one is the whole set the stored
// document accepts; the toolbar may offer fewer until its layer arrives.
export const BRUSHES = ['pen', 'highlighter'] as const
export const NOTE_SIZE_IDS = ['xs', 'sm', 'md', 'lg', 'xl', 'xxl'] as const
export const NOTE_FONTS = ['serif', 'sans', 'mono'] as const
export const NOTE_ALIGNS = ['left', 'center', 'right'] as const
export const NOTE_KINDS = ['text', 'postit'] as const
export const BACKGROUNDS = ['paper', 'white', 'black', 'yellow', 'transparent'] as const

export type Brush = (typeof BRUSHES)[number]
export type NoteSize = (typeof NOTE_SIZE_IDS)[number]
export type NoteFont = (typeof NOTE_FONTS)[number]
export type NoteAlign = (typeof NOTE_ALIGNS)[number]
export type NoteKind = (typeof NOTE_KINDS)[number]
export type Background = (typeof BACKGROUNDS)[number]

export type Stroke = {
  id: number
  points: Point[]
  color: string
  width: number
  brush: Brush
}

// Notes store Markdown. x and y are the top-left corner in world units.
export type Note = {
  id: number
  x: number
  y: number
  text: string
  size: NoteSize
  font: NoteFont
  align: NoteAlign
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

export type CanvasDoc = {
  version: 2
  revision: number
  area: Area | null
  background: Background
  strokes: Stroke[]
  notes: Note[]
  camera: Camera
}

// select is the state with no tool pressed (decision 0010).
export type Tool = 'select' | 'hand' | 'brush' | 'text' | 'postit' | 'eraser'

// Six inks, with at least one readable on every theme (decision 0008).
export const INK_COLORS = [
  { id: 'black', label: 'preta', value: '#1F2328' },
  { id: 'blue', label: 'azul', value: '#2563EB' },
  { id: 'red', label: 'vermelha', value: '#DC2626' },
  { id: 'green', label: 'verde', value: '#16A34A' },
  { id: 'yellow', label: 'amarela', value: '#FACC15' },
  { id: 'white', label: 'branca', value: '#F8FAFC' },
] as const

// The six note sizes; their pixel sizes live in App.css.
export const NOTE_SIZES: ReadonlyArray<{ id: NoteSize; label: string }> = [
  { id: 'xs', label: 'muito pequeno' },
  { id: 'sm', label: 'pequeno' },
  { id: 'md', label: 'médio' },
  { id: 'lg', label: 'grande' },
  { id: 'xl', label: 'muito grande' },
  { id: 'xxl', label: 'extra grande' },
]

// Fonts that Windows installs; each falls back within its family in App.css.
export const NOTE_FONT_OPTIONS: ReadonlyArray<{ id: NoteFont; label: string }> = [
  { id: 'serif', label: 'Serifa' },
  { id: 'sans', label: 'Sem serifa' },
  { id: 'mono', label: 'Mono' },
]

export const BACKGROUND_LABELS: Record<Background, string> = {
  paper: 'bege',
  white: 'branco',
  black: 'preto',
  yellow: 'amarelo',
  transparent: 'transparente',
}

export const DEFAULT_NOTE_FONT: NoteFont = 'sans'
export const DEFAULT_NOTE_ALIGN: NoteAlign = 'left'

export const MIN_ZOOM = 0.25
export const MAX_ZOOM = 4
export const MAX_NOTE_LENGTH = 20_000
export const MAX_STROKE_POINTS = 50_000
export const MIN_AREA_WIDTH = 160
export const MIN_AREA_HEIGHT = 120

export const EMPTY_CAMERA: Camera = { x: 0, y: 0, zoom: 1 }

export function createEmptyDocument(): CanvasDoc {
  return {
    version: 2,
    revision: 0,
    area: null,
    background: 'paper',
    strokes: [],
    notes: [],
    camera: { ...EMPTY_CAMERA },
  }
}
