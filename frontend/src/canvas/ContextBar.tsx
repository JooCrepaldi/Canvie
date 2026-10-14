import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'
import type { NoteAlign } from '../canvasTypes'

type ContextBarProps = {
  left: number
  top: number
  align: NoteAlign
  onAlign: (align: NoteAlign) => void
}

// Three text lines whose short ends show the alignment.
const ALIGNMENTS: ReadonlyArray<{ id: NoteAlign; label: string; lines: Array<[number, number]> }> = [
  { id: 'left', label: 'Alinhar à esquerda', lines: [[3, 21], [3, 15], [3, 18]] },
  { id: 'center', label: 'Centralizar', lines: [[3, 21], [7, 17], [5, 19]] },
  { id: 'right', label: 'Alinhar à direita', lines: [[3, 21], [9, 21], [6, 21]] },
]

// Buttons keep the pointer away from the canvas and focus away from the body.
const stopPointer = (event: ReactPointerEvent<HTMLDivElement>) => event.stopPropagation()
const keepFocus = (event: ReactMouseEvent<HTMLButtonElement>) => event.preventDefault()

export function ContextBar({ left, top, align, onAlign }: ContextBarProps) {
  return (
    <div className="context-bar" role="toolbar" aria-label="Alinhamento da nota" style={{ left, top }} onPointerDown={stopPointer}>
      {ALIGNMENTS.map((option) => (
        <button key={option.id} type="button" aria-label={option.label} aria-pressed={align === option.id} title={option.label} onMouseDown={keepFocus} onClick={() => onAlign(option.id)}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {option.lines.map(([from, to], index) => (
              <line key={index} x1={from} x2={to} y1={6 + index * 6} y2={6 + index * 6} />
            ))}
          </svg>
        </button>
      ))}
    </div>
  )
}
