import { useMemo } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'
import type { Note } from '../canvasTypes'
import { renderMarkdown } from './markdown'

type NoteViewProps = {
  note: Note
  interactive: boolean
  elementRef: (id: number, element: HTMLDivElement | null) => void
  onPointerDown: (note: Note, event: ReactPointerEvent<HTMLDivElement>) => void
  onEdit: (note: Note) => void
}

// Links render but never navigate the app's WebView.
function keepLinksInside(event: ReactMouseEvent<HTMLDivElement>) {
  if (event.target instanceof Element && event.target.closest('a')) event.preventDefault()
}

export function NoteView({ note, interactive, elementRef, onPointerDown, onEdit }: NoteViewProps) {
  const html = useMemo(() => renderMarkdown(note.text), [note.text])

  const editWithKeyboard = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    onEdit(note)
  }

  return (
    <div
      ref={(element) => elementRef(note.id, element)}
      className={`note note-${note.kind} note-${note.size}${interactive ? ' is-interactive' : ''}`}
      style={{ left: note.x, top: note.y }}
      role="note"
      tabIndex={interactive ? 0 : -1}
      onPointerDown={(event) => onPointerDown(note, event)}
      onDoubleClick={() => onEdit(note)}
      onKeyDown={editWithKeyboard}
      onClick={keepLinksInside}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
