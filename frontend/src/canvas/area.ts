import { MIN_AREA_HEIGHT, MIN_AREA_WIDTH, type Area, type Point } from '../canvasTypes'

export type Viewport = {
  width: number
  height: number
}

export function rectFromPoints(start: Point, end: Point): Area {
  return {
    x: Math.round(Math.min(start.x, end.x)),
    y: Math.round(Math.min(start.y, end.y)),
    width: Math.round(Math.abs(end.x - start.x)),
    height: Math.round(Math.abs(end.y - start.y)),
  }
}

export function isAreaLargeEnough(area: Area): boolean {
  return area.width >= MIN_AREA_WIDTH && area.height >= MIN_AREA_HEIGHT
}

// Shows a stored area inside a smaller window or a changed display without
// rewriting the document.
export function fitArea(area: Area, viewport: Viewport): Area {
  const width = Math.min(area.width, viewport.width)
  const height = Math.min(area.height, viewport.height)
  return {
    x: Math.min(Math.max(0, area.x), viewport.width - width),
    y: Math.min(Math.max(0, area.y), viewport.height - height),
    width,
    height,
  }
}
