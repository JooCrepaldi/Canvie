import { EMPTY_CAMERA, MAX_ZOOM, MIN_ZOOM, type Camera, type CanvasDoc } from '../canvasTypes'

// Room left around the content when it is framed.
const FIT_MARGIN = 32

export type Box = { width: number; height: number }

const clampZoom = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))

// The rendered size of each note, in world units. The notes layer is scaled
// by a CSS transform, which offsetWidth and offsetHeight ignore.
export function measureNotes(): Map<number, Box> {
  const boxes = new Map<number, Box>()
  document.querySelectorAll<HTMLElement>('.note[data-note-id]').forEach((element) => {
    boxes.set(Number(element.dataset.noteId), { width: element.offsetWidth, height: element.offsetHeight })
  })
  return boxes
}

// Ajustar à tela: the camera that shows every stroke and note inside the
// area with a margin. An empty canvas goes back to the default camera.
export function fitCamera(doc: CanvasDoc, area: Box, notes: Map<number, Box>): Camera {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const include = (left: number, top: number, right: number, bottom: number) => {
    minX = Math.min(minX, left)
    minY = Math.min(minY, top)
    maxX = Math.max(maxX, right)
    maxY = Math.max(maxY, bottom)
  }
  for (const stroke of doc.strokes) {
    const half = stroke.width / 2
    for (const point of stroke.points) include(point.x - half, point.y - half, point.x + half, point.y + half)
  }
  for (const note of doc.notes) {
    const box = notes.get(note.id) ?? { width: 0, height: 0 }
    include(note.x, note.y, note.x + box.width, note.y + box.height)
  }
  if (!Number.isFinite(minX)) return { ...EMPTY_CAMERA }
  const width = Math.max(1, maxX - minX)
  const height = Math.max(1, maxY - minY)
  const zoom = clampZoom(Math.min((area.width - FIT_MARGIN * 2) / width, (area.height - FIT_MARGIN * 2) / height))
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2, zoom }
}

// Zoom to a percentage, keeping the point at the center of the area.
export function zoomCamera(camera: Camera, percent: number): Camera {
  return { ...camera, zoom: clampZoom(percent / 100) }
}
