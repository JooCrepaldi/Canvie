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

export type Note = {
  id: number
  x: number
  y: number
  text: string
}

export type Camera = {
  x: number
  y: number
  zoom: number
}

export type CanvasDoc = {
  version: 1
  revision: number
  strokes: Stroke[]
  notes: Note[]
  camera: Camera
}

export type Tool = 'cursor' | 'brush' | 'text' | 'eraser'

export const MIN_ZOOM = 0.25
export const MAX_ZOOM = 4
export const MAX_NOTE_LENGTH = 2_000
export const MAX_STROKE_POINTS = 50_000

export const EMPTY_CAMERA: Camera = { x: 0, y: 0, zoom: 1 }

export function createEmptyDocument(): CanvasDoc {
  return {
    version: 1,
    revision: 0,
    strokes: [],
    notes: [],
    camera: { ...EMPTY_CAMERA },
  }
}
