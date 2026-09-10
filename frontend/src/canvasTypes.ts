export interface Point {
  x: number
  y: number
}

export interface Stroke {
  id: number
  points: Point[]
  erase: boolean
}

export interface TextItem {
  id: number
  at: Point
  content: string
}

export interface Camera {
  x: number
  y: number
  zoom: number
}

export type Tool = 'pen' | 'eraser'

export const PEN_WIDTH = 3
export const ERASER_WIDTH = 24

let nextId = 1
export function newId(): number {
  return nextId++
}

/** Move the id counter past already-persisted ids (called after load). */
export function reseedIds(maxSeen: number): void {
  if (maxSeen >= nextId) nextId = maxSeen + 1
}
