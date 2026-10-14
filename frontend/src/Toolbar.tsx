import { useLayoutEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'
import { Eraser, GripHorizontal, Hand, Highlighter, Pen, PenTool, Pin, StickyNote, Type, type LucideIcon } from 'lucide-react'
import { INK_COLORS, NOTE_FONT_OPTIONS, NOTE_SIZES, type Brush, type NoteFont, type NoteSize, type Tool } from './canvasTypes'
import { reportIssue } from './diagnostics'
import type { ToolbarPosition } from './preferences'
import './Toolbar.css'

// Brush holds Caneta, Marca-texto, Borracha and the inks; size holds the
// fonts and the sizes of the text.
export type ToolbarPopover = 'brush' | 'size' | null

type ToolbarProps = {
  tool: Tool
  ink: string
  brush: Brush
  noteSize: NoteSize
  noteFont: NoteFont
  popover: ToolbarPopover
  // null is the default place, centered above the taskbar.
  position: ToolbarPosition | null
  pinning: boolean
  canPin: boolean
  onToolChange: (tool: Tool) => void
  onDrawingToolChange: (tool: 'brush' | 'eraser') => void
  onBrushChange: (brush: Brush) => void
  onInkChange: (ink: string) => void
  onNoteSizeChange: (size: NoteSize) => void
  onNoteFontChange: (font: NoteFont) => void
  onPositionChange: (position: ToolbarPosition | null) => void
  onPin: () => void
}

type Drag = { pointerId: number; x: number; y: number; left: number; top: number; width: number; height: number }

// Formas and Novo canvas join the bar in 0.0.3, with their functions (decision 0009).
const TOOLS: ReadonlyArray<{ id: Tool; label: string; shortcut: string; Icon: LucideIcon }> = [
  { id: 'text', label: 'Texto', shortcut: 'T', Icon: Type },
  { id: 'postit', label: 'Post-it', shortcut: 'P', Icon: StickyNote },
  { id: 'brush', label: 'Pincel', shortcut: 'B', Icon: PenTool },
  { id: 'hand', label: 'Mão', shortcut: 'H', Icon: Hand },
]

// Space between the toolbar and the top of the taskbar.
const DOCK_MARGIN = 20
// The drag tab's target reaches this far above the bar.
const TAB_HEIGHT = 31
// The tab, 24 px tall and 64 px wide, with 10 px concave corners where it
// meets the bar's top edge at y = 24. The fill runs 1 px into the bar.
const TAB_OUTLINE = 'M0 24 A10 10 0 0 0 10 14 L10 10 A10 10 0 0 1 20 0 L64 0 A10 10 0 0 1 74 10 L74 14 A10 10 0 0 0 84 24'
const TAB_FILL = `${TAB_OUTLINE} L84 25 L0 25 Z`
const EDGE = 8
// Space between the bar and a popover above it, clear of the tab.
const POPOVER_GAP = 40

type PopoverPlace = { shift: number; below: boolean }

// The window covers the whole monitor, so the screen's available area tells
// where the taskbar starts, in CSS pixels.
function workAreaBottom(): number {
  const screen = window.screen as Screen & { availTop?: number }
  return Math.min(window.innerHeight, (screen.availTop ?? 0) + screen.availHeight)
}

function clamp(left: number, top: number, width: number, height: number): ToolbarPosition {
  return {
    left: Math.min(window.innerWidth - width - EDGE, Math.max(EDGE, left)),
    top: Math.min(window.innerHeight - height - EDGE, Math.max(TAB_HEIGHT + EDGE, top)),
  }
}

// Font and size buttons keep focus in an open note editor, so they apply to it.
function keepEditorFocus(event: ReactMouseEvent<HTMLButtonElement>) {
  event.preventDefault()
}

export function Toolbar(props: ToolbarProps) {
  const { tool, ink, brush, noteSize, noteFont, popover, position, pinning, canPin, onPositionChange } = props
  const rootRef = useRef<HTMLElement>(null)
  const dragRef = useRef<Drag | null>(null)
  const [dragPosition, setDragPosition] = useState<ToolbarPosition | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [popoverPlace, setPopoverPlace] = useState<PopoverPlace>({ shift: 0, below: false })

  // A popover is wider than the bar. Near a side of the screen it slides to
  // stay inside; near the top it opens below the bar. It runs after every
  // render, because the toolbar moves during a drag, and only sets state on
  // a change.
  useLayoutEffect(() => {
    const element = popoverRef.current
    const root = rootRef.current
    if (!element || !root) return
    const bar = root.getBoundingClientRect()
    const { width, height } = element.getBoundingClientRect()
    const centered = bar.left + bar.width / 2 - width / 2
    const left = Math.min(window.innerWidth - width - EDGE, Math.max(EDGE, centered))
    const next = { shift: Math.round(left - centered), below: bar.top - POPOVER_GAP - height < EDGE }
    if (next.shift !== popoverPlace.shift || next.below !== popoverPlace.below) setPopoverPlace(next)
  })

  // A saved place that no longer fits the screen, after a resolution change
  // for example, goes back to the default and leaves a line in the log.
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!position || !root) return
    const { width, height } = root.getBoundingClientRect()
    const fits = position.left >= 0 && position.top >= TAB_HEIGHT && position.left + width <= window.innerWidth && position.top + height <= window.innerHeight
    if (fits) return
    console.warn('Canvie: saved toolbar position is off screen; using the default')
    reportIssue('toolbar_position_reset')
    onPositionChange(null)
  }, [position, onPositionChange])

  const startDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const rect = rootRef.current?.getBoundingClientRect()
    if (!rect || event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top, width: rect.width, height: rect.height }
    setDragPosition({ left: rect.left, top: rect.top })
  }

  const draggedTo = (drag: Drag, event: ReactPointerEvent<HTMLButtonElement>) =>
    clamp(drag.left + event.clientX - drag.x, drag.top + event.clientY - drag.y, drag.width, drag.height)

  const moveDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (drag?.pointerId === event.pointerId) setDragPosition(draggedTo(drag, event))
  }

  const endDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (drag?.pointerId !== event.pointerId) return
    event.currentTarget.releasePointerCapture(event.pointerId)
    dragRef.current = null
    setDragPosition(null)
    onPositionChange(draggedTo(drag, event))
  }

  const placed = dragPosition ?? position
  const style = placed
    ? { left: placed.left, top: placed.top }
    : { left: '50%', bottom: window.innerHeight - workAreaBottom() + DOCK_MARGIN, transform: 'translateX(-50%)' }

  const popoverClass = popoverPlace.below ? 'toolbar-popover is-below' : 'toolbar-popover'
  const popoverStyle = { translate: `${popoverPlace.shift}px 0` }

  return (
    <section ref={rootRef} className={dragPosition ? 'toolbar is-dragging' : 'toolbar'} aria-label="Ferramentas do canvas" data-tool={tool} style={style}>
      <button
        className="toolbar-tab"
        type="button"
        aria-label="Mover toolbar"
        title="Arraste para mover a toolbar"
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <svg className="toolbar-tab-shape" viewBox="0 0 84 25" aria-hidden="true">
          <path className="toolbar-tab-fill" d={TAB_FILL} />
          <path className="toolbar-tab-edge" d={TAB_OUTLINE} transform="translate(0 -0.5)" />
        </svg>
        <GripHorizontal className="toolbar-tab-grip" aria-hidden="true" />
      </button>
      <div className="toolbar-bar">
        <div className="toolbar-group" role="toolbar" aria-label="Ferramentas">
          {TOOLS.map(({ id, label, shortcut, Icon }) => {
            const active = tool === id || (id === 'brush' && tool === 'eraser')
            return (
              <button
                key={id}
                className="toolbar-tool"
                type="button"
                aria-label={`${label}, atalho ${shortcut}`}
                aria-pressed={active}
                title={`${label} · ${shortcut}`}
                onClick={() => props.onToolChange(active ? 'select' : id)}
              >
                <Icon aria-hidden="true" />
              </button>
            )
          })}
        </div>
        <div className="toolbar-group" role="group" aria-label="Fixar">
          <button
            className="toolbar-tool toolbar-pin"
            type="button"
            aria-label="Fixar no desktop, atalho Ctrl + Alt + T"
            title="Fixar no desktop · Ctrl + Alt + T"
            disabled={pinning || !canPin}
            onClick={props.onPin}
          >
            <Pin aria-hidden="true" />
          </button>
        </div>
      </div>
      {popover === 'brush' && (
        <div ref={popoverRef} className={popoverClass} style={popoverStyle} role="group" aria-label="Opções do pincel">
          <div className="popover-row">
            <button className="popover-option" type="button" aria-label="Caneta" aria-pressed={tool === 'brush' && brush === 'pen'} onClick={() => props.onBrushChange('pen')}>
              <Pen aria-hidden="true" />
              Caneta
            </button>
            <button className="popover-option" type="button" aria-label="Marca-texto" aria-pressed={tool === 'brush' && brush === 'highlighter'} onClick={() => props.onBrushChange('highlighter')}>
              <Highlighter aria-hidden="true" />
              Marca-texto
            </button>
            <button className="popover-option" type="button" aria-label="Borracha, atalho E" aria-pressed={tool === 'eraser'} title="Borracha · E" onClick={() => props.onDrawingToolChange('eraser')}>
              <Eraser aria-hidden="true" />
              Borracha
            </button>
          </div>
          <div className="popover-divider" />
          <div className="popover-row popover-swatches">
            {INK_COLORS.map((color) => (
              <button
                key={color.id}
                className="popover-swatch"
                type="button"
                aria-label={`Tinta ${color.label}`}
                aria-pressed={ink === color.value}
                title={`Tinta ${color.label}`}
                style={{ background: color.value }}
                onClick={() => props.onInkChange(color.value)}
              />
            ))}
          </div>
        </div>
      )}
      {popover === 'size' && (
        <div ref={popoverRef} className={popoverClass} style={popoverStyle} role="group" aria-label="Opções do texto">
          <div className="popover-row">
            {NOTE_FONT_OPTIONS.map((font) => (
              <button
                key={font.id}
                className={`popover-option popover-font popover-font-${font.id}`}
                type="button"
                aria-label={`Fonte ${font.label}`}
                aria-pressed={noteFont === font.id}
                title={`Fonte ${font.label}`}
                onMouseDown={keepEditorFocus}
                onClick={() => props.onNoteFontChange(font.id)}
              >
                {font.label}
              </button>
            ))}
          </div>
          <div className="popover-divider" />
          <div className="popover-row">
            {NOTE_SIZES.map((size) => (
              <button
                key={size.id}
                className={`popover-size popover-size-${size.id}`}
                type="button"
                aria-label={`Texto ${size.label}`}
                aria-pressed={noteSize === size.id}
                title={`Texto ${size.label}`}
                onMouseDown={keepEditorFocus}
                onClick={() => props.onNoteSizeChange(size.id)}
              >
                A
              </button>
            ))}
          </div>
        </div>
      )}
      {pinning && (
        <p className="toolbar-status" role="status">
          Salvando…
        </p>
      )}
    </section>
  )
}
