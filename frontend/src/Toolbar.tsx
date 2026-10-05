import { useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Tool } from './canvasTypes'

type ToolbarProps = {
  tool: Tool
  canUndo: boolean
  canRedo: boolean
  onToolChange: (tool: Tool) => void
  onUndo: () => void
  onRedo: () => void
}

const tools: Array<{ id: Tool; label: string; shortcut: string }> = [
  { id: 'cursor', label: 'Mover', shortcut: 'Space' },
  { id: 'brush', label: 'Pincel', shortcut: 'B' },
  { id: 'text', label: 'Nota', shortcut: 'T' },
  { id: 'eraser', label: 'Borra', shortcut: 'E' },
]

export function Toolbar({ tool, canUndo, canRedo, onToolChange, onUndo, onRedo }: ToolbarProps) {
  const [position, setPosition] = useState<{ left: number | null; top: number }>({ left: null, top: 16 })
  const dragRef = useRef<{ pointerId: number; x: number; y: number; left: number; top: number } | null>(null)

  const startDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    const toolbarLeft = event.currentTarget.parentElement?.getBoundingClientRect().left ?? window.innerWidth / 2
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, left: position.left ?? toolbarLeft, top: position.top }
  }

  const moveDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const left = Math.min(window.innerWidth - 180, Math.max(8, drag.left + event.clientX - drag.x))
    const top = Math.min(window.innerHeight - 60, Math.max(8, drag.top + event.clientY - drag.y))
    setPosition({ left, top })
  }

  const endDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      event.currentTarget.releasePointerCapture(event.pointerId)
      dragRef.current = null
    }
  }

  return (
    <section className="toolbar" aria-label="Ferramentas do canvas" style={{ left: position.left ?? '50%', top: position.top, transform: position.left === null ? 'translateX(-50%)' : undefined }}>
      <button
        className="toolbar-handle"
        type="button"
        aria-label="Mover toolbar"
        title="Arraste para mover a toolbar"
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      />
      <div className="toolbar-group" role="toolbar" aria-label="Ferramentas">
        {tools.map((item) => (
          <button
            key={item.id}
            className={tool === item.id ? 'toolbar-button is-active' : 'toolbar-button'}
            type="button"
            aria-label={`${item.label}, atalho ${item.shortcut}`}
            aria-pressed={tool === item.id}
            onClick={() => onToolChange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="toolbar-group" role="group" aria-label="Histórico">
        <button className="toolbar-button" type="button" aria-label="Desfazer" disabled={!canUndo} onClick={onUndo}>
          Desfazer
        </button>
        <button className="toolbar-button" type="button" aria-label="Refazer" disabled={!canRedo} onClick={onRedo}>
          Refazer
        </button>
      </div>
    </section>
  )
}
