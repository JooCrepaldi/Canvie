import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'
import { AlignCenter, AlignLeft, AlignRight, type LucideIcon } from 'lucide-react'
import type { NoteAlign } from '../canvasTypes'

type ContextBarProps = {
  left: number
  top: number
  align: NoteAlign
  onAlign: (align: NoteAlign) => void
}

const ALIGNMENTS: ReadonlyArray<{ id: NoteAlign; label: string; Icon: LucideIcon }> = [
  { id: 'left', label: 'Alinhar à esquerda', Icon: AlignLeft },
  { id: 'center', label: 'Centralizar', Icon: AlignCenter },
  { id: 'right', label: 'Alinhar à direita', Icon: AlignRight },
]

// Buttons keep the pointer away from the canvas and focus away from the body.
const stopPointer = (event: ReactPointerEvent<HTMLDivElement>) => event.stopPropagation()
const keepFocus = (event: ReactMouseEvent<HTMLButtonElement>) => event.preventDefault()

export function ContextBar({ left, top, align, onAlign }: ContextBarProps) {
  return (
    <div className="context-bar" role="toolbar" aria-label="Alinhamento da nota" style={{ left, top }} onPointerDown={stopPointer}>
      {ALIGNMENTS.map(({ id, label, Icon }) => (
        <button key={id} type="button" aria-label={label} aria-pressed={align === id} title={label} onMouseDown={keepFocus} onClick={() => onAlign(id)}>
          <Icon aria-hidden="true" />
        </button>
      ))}
    </div>
  )
}
