import { useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'
import { INK_COLORS, NOTE_SIZES, type Background, type NoteSize, type Tool } from './canvasTypes'

type ToolbarProps = {
  tool: Tool
  ink: string
  noteSize: NoteSize
  background: Background
  canUndo: boolean
  canRedo: boolean
  onToolChange: (tool: Tool) => void
  onInkChange: (ink: string) => void
  onNoteSizeChange: (size: NoteSize) => void
  onBackgroundToggle: () => void
  onSelectArea: () => void
  onUndo: () => void
  onRedo: () => void
}

const tools: Array<{ id: Tool; label: string; shortcut: string }> = [
  { id: 'cursor', label: 'Mover', shortcut: 'Space' },
  { id: 'brush', label: 'Pincel', shortcut: 'B' },
  { id: 'text', label: 'Nota', shortcut: 'T' },
  { id: 'postit', label: 'Post-it', shortcut: 'P' },
  { id: 'eraser', label: 'Borracha', shortcut: 'E' },
]

// Size buttons keep focus in an open note editor, so the size applies to it.
function keepEditorFocus(event: ReactMouseEvent<HTMLButtonElement>) {
  event.preventDefault()
}

export function Toolbar(props: ToolbarProps) {
  const { tool, ink, noteSize, background, canUndo, canRedo } = props
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
            onClick={() => props.onToolChange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="toolbar-group" role="group" aria-label="Cor da tinta">
        {INK_COLORS.map((color) => (
          <button
            key={color.id}
            className={ink === color.value ? 'toolbar-swatch is-active' : 'toolbar-swatch'}
            type="button"
            aria-label={`Tinta ${color.label}`}
            aria-pressed={ink === color.value}
            title={`Tinta ${color.label}`}
            style={{ color: color.value }}
            onClick={() => props.onInkChange(color.value)}
          />
        ))}
      </div>
      <div className="toolbar-group" role="group" aria-label="Tamanho do texto">
        {NOTE_SIZES.map((size) => (
          <button
            key={size.id}
            className={noteSize === size.id ? 'toolbar-button is-active' : 'toolbar-button'}
            type="button"
            aria-label={`Texto ${size.label}`}
            aria-pressed={noteSize === size.id}
            title={`Texto ${size.label}`}
            onMouseDown={keepEditorFocus}
            onClick={() => props.onNoteSizeChange(size.id)}
          >
            {size.short}
          </button>
        ))}
      </div>
      <div className="toolbar-group" role="group" aria-label="Área">
        <button className="toolbar-button" type="button" aria-label={`Fundo ${background === 'paper' ? 'bege' : 'transparente'}, trocar`} onClick={props.onBackgroundToggle}>
          {background === 'paper' ? 'Fundo bege' : 'Fundo transparente'}
        </button>
        <button className="toolbar-button" type="button" aria-label="Redefinir área do canvas" onClick={props.onSelectArea}>
          Área
        </button>
      </div>
      <div className="toolbar-group" role="group" aria-label="Histórico">
        <button className="toolbar-button" type="button" aria-label="Desfazer" disabled={!canUndo} onClick={props.onUndo}>
          Desfazer
        </button>
        <button className="toolbar-button" type="button" aria-label="Refazer" disabled={!canRedo} onClick={props.onRedo}>
          Refazer
        </button>
      </div>
    </section>
  )
}
