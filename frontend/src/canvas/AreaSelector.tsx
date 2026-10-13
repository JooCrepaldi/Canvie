import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { MIN_AREA_HEIGHT, MIN_AREA_WIDTH, type Area, type Point } from '../canvasTypes'
import { isAreaLargeEnough, rectFromPoints } from './area'

type AreaSelectorProps = {
  cancelable: boolean
  onSelect: (area: Area) => void
  onCancel: () => void
}

export function AreaSelector({ cancelable, onSelect, onCancel }: AreaSelectorProps) {
  const draftRef = useRef<HTMLDivElement>(null)
  const sizeRef = useRef<HTMLSpanElement>(null)
  const dragRef = useRef<{ pointerId: number; start: Point } | null>(null)
  const [tooSmall, setTooSmall] = useState(false)

  useEffect(() => {
    if (!cancelable) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [cancelable, onCancel])

  const paint = (area: Area | null) => {
    const draft = draftRef.current
    if (!draft) return
    draft.hidden = area === null
    if (!area) return
    draft.style.left = `${area.x}px`
    draft.style.top = `${area.y}px`
    draft.style.width = `${area.width}px`
    draft.style.height = `${area.height}px`
    if (sizeRef.current) sizeRef.current.textContent = `${area.width} × ${area.height}`
  }

  const start = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = { x: event.clientX, y: event.clientY }
    dragRef.current = { pointerId: event.pointerId, start: point }
    setTooSmall(false)
    paint(rectFromPoints(point, point))
  }

  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    paint(rectFromPoints(drag.start, { x: event.clientX, y: event.clientY }))
  }

  const finish = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
    const area = rectFromPoints(drag.start, { x: event.clientX, y: event.clientY })
    if (event.type === 'pointerup' && isAreaLargeEnough(area)) {
      onSelect(area)
      return
    }
    paint(null)
    setTooSmall(event.type === 'pointerup')
  }

  return (
    <div className="area-selector" onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish}>
      <p className="area-hint" role="status">
        {tooSmall ? `Área pequena demais. Arraste pelo menos ${MIN_AREA_WIDTH} × ${MIN_AREA_HEIGHT}.` : 'Arraste para definir a área do canvas.'}
        {cancelable ? ' Esc cancela.' : ''}
      </p>
      <div className="area-draft" ref={draftRef} hidden>
        <span className="area-size" ref={sizeRef} />
      </div>
    </div>
  )
}
