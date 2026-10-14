import { useEffect, useRef } from 'react'
import { MAX_NOTE_LENGTH, type NoteAlign, type NoteFont, type NoteKind, type NoteSize } from '../canvasTypes'

type NoteEditorProps = {
  x: number
  y: number
  kind: NoteKind
  size: NoteSize
  font: NoteFont
  align: NoteAlign
  text: string
  onTextChange: (text: string) => void
  onCommit: () => void
  onCancel: () => void
}

export function NoteEditor({ x, y, kind, size, font, align, text, onTextChange, onCommit, onCancel }: NoteEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.focus()
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)
  }, [])

  return (
    <textarea
      ref={textareaRef}
      className={`note note-editor note-${kind} note-${size} note-font-${font} note-align-${align}`}
      style={{ left: x, top: y }}
      aria-label={kind === 'postit' ? 'Texto do post-it em Markdown' : 'Texto da nota em Markdown'}
      placeholder="Escreva em Markdown"
      maxLength={MAX_NOTE_LENGTH}
      value={text}
      onChange={(event) => onTextChange(event.target.value)}
      onBlur={onCommit}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          onCancel()
        } else if (event.key === 'Enter' && event.ctrlKey) {
          event.preventDefault()
          onCommit()
        }
      }}
    />
  )
}
