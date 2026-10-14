import { useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from 'react'
import { Check } from 'lucide-react'
import { BACKGROUNDS, BACKGROUND_LABELS, type Background } from './canvasTypes'
import './ContextMenu.css'

type ContextMenuProps = {
  x: number
  y: number
  background: Background
  zoom: number
  onClose: () => void
  onRepositionToolbar: () => void
  onTheme: (background: Background) => void
  onRedefineArea: () => void
  onFit: () => void
  onZoom: (percent: number) => void
  onClear: () => void
}

const ZOOM_PRESETS = [50, 100, 200]
const EDGE = 8

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
const keepNativeMenuAway = (event: ReactMouseEvent) => event.preventDefault()

// Moves focus among the menu items with the arrows, Home and End.
function moveFocus(menu: HTMLElement, key: string) {
  const items = [...menu.querySelectorAll<HTMLElement>('[role^="menuitem"]')]
  const index = items.findIndex((item) => item === document.activeElement)
  const next = key === 'Home' ? 0 : key === 'End' ? items.length - 1 : (index + (key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
  items[next]?.focus()
}

export function ContextMenu(props: ContextMenuProps) {
  const { x, y, background, zoom, onClose } = props
  const menuRef = useRef<HTMLDivElement>(null)
  const [place, setPlace] = useState({ left: x, top: y })

  // Opens at the pointer, kept inside the window, with focus on the first item.
  useLayoutEffect(() => {
    const menu = menuRef.current
    if (!menu) return
    const { width, height } = menu.getBoundingClientRect()
    setPlace({ left: Math.max(EDGE, Math.min(x, window.innerWidth - width - EDGE)), top: Math.max(EDGE, Math.min(y, window.innerHeight - height - EDGE)) })
    menu.querySelector<HTMLElement>('[role^="menuitem"]')?.focus()
  }, [x, y])

  const run = (action: () => void) => () => {
    onClose()
    action()
  }

  // Esc closes the menu without reaching the app, which would pin the area.
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onClose()
      return
    }
    if (event.target instanceof HTMLInputElement || !menuRef.current) return
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    moveFocus(menuRef.current, event.key)
  }

  const applyZoom = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    const percent = Number(event.currentTarget.value)
    if (Number.isFinite(percent) && percent > 0) run(() => props.onZoom(percent))()
  }

  return (
    <>
      <div className="menu-backdrop" onPointerDown={onClose} onContextMenu={keepNativeMenuAway} />
      <div ref={menuRef} className="context-menu" role="menu" aria-label="Opções do canvas" style={place} onKeyDown={onKeyDown} onContextMenu={keepNativeMenuAway}>
        <button className="menu-item" type="button" role="menuitem" onClick={run(props.onRepositionToolbar)}>
          Reposicionar toolbar
        </button>
        <div className="menu-separator" role="separator" />
        <p className="menu-label" id="menu-theme">
          Tema
        </p>
        <div role="group" aria-labelledby="menu-theme">
          {BACKGROUNDS.map((option) => (
            <button
              key={option}
              className="menu-item"
              type="button"
              role="menuitemradio"
              aria-checked={background === option}
              onClick={run(() => props.onTheme(option))}
            >
              <span className={`menu-swatch menu-swatch-${option}`} aria-hidden="true" />
              {capitalize(BACKGROUND_LABELS[option])}
              {background === option && <Check className="menu-check" aria-hidden="true" />}
            </button>
          ))}
        </div>
        <div className="menu-separator" role="separator" />
        <button className="menu-item" type="button" role="menuitem" onClick={run(props.onRedefineArea)}>
          Redefinir área
        </button>
        <button className="menu-item" type="button" role="menuitem" onClick={run(props.onFit)}>
          Ajustar à tela
        </button>
        <p className="menu-label" id="menu-zoom">
          Zoom
        </p>
        <div className="menu-zoom" role="group" aria-labelledby="menu-zoom">
          {ZOOM_PRESETS.map((percent) => (
            <button key={percent} className="menu-item" type="button" role="menuitem" onClick={run(() => props.onZoom(percent))}>
              {percent}%
            </button>
          ))}
          <input className="menu-zoom-field" type="number" min={25} max={400} step={5} aria-label="Zoom em porcentagem" defaultValue={Math.round(zoom * 100)} onKeyDown={applyZoom} />
        </div>
        <div className="menu-separator" role="separator" />
        <button className="menu-item is-danger" type="button" role="menuitem" onClick={run(props.onClear)}>
          Limpar canvas…
        </button>
      </div>
    </>
  )
}

type ClearDialogProps = {
  onCancel: () => void
  onConfirm: () => void
}

// Limpar asks once more. Cancelar has the focus, so Enter is the safe answer.
export function ClearDialog({ onCancel, onConfirm }: ClearDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)

  useLayoutEffect(() => cancelRef.current?.focus(), [])

  // Esc cancels, and Tab stays between the two buttons.
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onCancel()
    } else if (event.key === 'Tab') {
      event.preventDefault()
      ;(document.activeElement === cancelRef.current ? confirmRef : cancelRef).current?.focus()
    }
  }

  return (
    <>
      <div className="menu-backdrop is-dim" onPointerDown={onCancel} onContextMenu={keepNativeMenuAway} />
      <div className="clear-dialog" role="alertdialog" aria-modal="true" aria-labelledby="clear-title" aria-describedby="clear-text" onKeyDown={onKeyDown}>
        <h2 id="clear-title">Limpar o canvas?</h2>
        <p id="clear-text">Os traços, as notas e os post-its saem do canvas. Ctrl&nbsp;+&nbsp;Z desfaz.</p>
        <div className="clear-actions">
          <button ref={cancelRef} className="clear-button" type="button" onClick={onCancel}>
            Cancelar
          </button>
          <button ref={confirmRef} className="clear-button is-danger" type="button" onClick={onConfirm}>
            Limpar
          </button>
        </div>
      </div>
    </>
  )
}
