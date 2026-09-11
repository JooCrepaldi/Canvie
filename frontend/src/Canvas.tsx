import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  Camera,
  Point,
  Stroke,
  TextItem,
  Tool,
} from './canvasTypes'
import { ERASER_WIDTH, PEN_WIDTH, newId } from './canvasTypes'
import { clearDoc, createSaver, loadDoc } from './persistence'
import { getMode, onModeChanged, onToolChanged, setPassthrough, toggleLock, toggleOverlay, type AppMode, type ModeState } from './mode'

type Action = { kind: 'stroke'; stroke: Stroke } | { kind: 'text'; text: TextItem }

const MIN_ZOOM = 0.2
const MAX_ZOOM = 4

function screenToWorld(screen: Point, cam: Camera): Point {
  return { x: (screen.x - cam.x) / cam.zoom, y: (screen.y - cam.y) / cam.zoom }
}

function worldToScreen(world: Point, cam: Camera): Point {
  return { x: world.x * cam.zoom + cam.x, y: world.y * cam.zoom + cam.y }
}

const TEXT_FONT_SIZE = 16

function CanvasText({ item, camera }: { item: TextItem; camera: Camera }) {
  const s = worldToScreen(item.at, camera)
  return (
    <div
      className="canvie-text"
      style={{ left: s.x, top: s.y, fontSize: TEXT_FONT_SIZE * camera.zoom }}
    >
      {item.content}
    </div>
  )
}

function TextEditor({
  at,
  camera,
  onCommit,
  onCancel,
}: {
  at: Point
  camera: Camera
  onCommit: (value: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState('')
  const s = worldToScreen(at, camera)
  return (
    <input
      autoFocus
      className="canvie-text-input"
      style={{ left: s.x, top: s.y, fontSize: TEXT_FONT_SIZE * camera.zoom }}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onCommit(value)
        else if (e.key === 'Escape') onCancel()
        e.stopPropagation()
      }}
      onBlur={() => onCommit(value)}
    />
  )
}

function ToolButton({
  label,
  shortcut,
  active,
  onClick,
  children,
}: {
  label: string
  shortcut: string
  active?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      className={`canvie-tool-btn${active ? ' active' : ''}`}
      onClick={onClick}
      aria-label={`${label} (${shortcut})`}
    >
      {children}
      <span className="canvie-tool-tip">
        {label} · {shortcut}
      </span>
    </button>
  )
}

function Toolbar({
  mode,
  tool,
  onTool,
}: {
  mode: AppMode
  tool: Tool
  onTool: (t: Tool) => void
}) {
  const iconProps = {
    width: 16,
    height: 16,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  } as const
  return (
    <div className="canvie-toolbar" role="toolbar" aria-label="Ferramentas do Canvie">
      <ToolButton label="Cursor" shortcut="V" active={tool === 'cursor'} onClick={() => onTool('cursor')}>
        <svg {...iconProps}>
          <path d="M4 2l8 6-4.5.8L5.5 13 4 2z" />
        </svg>
      </ToolButton>
      <ToolButton label="Pincel" shortcut="B" active={tool === 'brush'} onClick={() => onTool('brush')}>
        <svg {...iconProps}>
          <path d="M11.5 2.5l2 2L6 12l-2.8.8L4 10l7.5-7.5z" />
          <path d="M10 4l2 2" />
        </svg>
      </ToolButton>
      <ToolButton label="Borracha" shortcut="E" active={tool === 'eraser'} onClick={() => onTool('eraser')}>
        <svg {...iconProps}>
          <path d="M9.5 3.5l3 3-4.5 4.5H4.5l-1-1 6-6.5z" />
          <path d="M3 13.5h10" />
        </svg>
      </ToolButton>
      <span className="canvie-toolbar-sep" />
      <ToolButton label="Travar" shortcut="Ctrl+L" active={mode === 'locked'} onClick={() => void toggleLock()}>
        <svg {...iconProps}>
          <rect x="3.5" y="7" width="9" height="6" rx="1.5" />
          <path d="M5.5 7V5a2.5 2.5 0 015 0v2" />
        </svg>
      </ToolButton>
      <ToolButton label="Overlay" shortcut="Ctrl+Alt+T" active={mode === 'overlay'} onClick={() => void toggleOverlay()}>
        <svg {...iconProps}>
          <rect x="2" y="4.5" width="9" height="7" rx="1.5" />
          <path d="M5 4.5V3.5A1.5 1.5 0 016.5 2H12.5A1.5 1.5 0 0114 3.5v6" />
        </svg>
      </ToolButton>
    </div>
  )
}

export default function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const [tool, setTool] = useState<Tool>('cursor')
  // L3: restore persisted doc on boot (loaded once).
  const bootDoc = useMemo(() => loadDoc(), [])
  const [strokes, setStrokes] = useState<Stroke[]>(() => bootDoc?.strokes ?? [])
  const [texts, setTexts] = useState<TextItem[]>(() => bootDoc?.texts ?? [])
  const [camera, setCamera] = useState<Camera>(() => bootDoc?.camera ?? { x: 0, y: 0, zoom: 1 })
  const saver = useMemo(() => createSaver(500), [])

  // L3: autosave on every change (debounced). Debug hooks: window.__canvie.
  useEffect(() => {
    saver({ version: 1, strokes, texts, camera })
  }, [strokes, texts, camera, saver])

  useEffect(() => {
    if (typeof window !== 'undefined' && import.meta.env.DEV) {
      const w = window as unknown as Record<string, unknown>
      w.__canvie = {
        export: () => JSON.stringify({ version: 1 as const, strokes, texts, camera }),
        clear: () => {
          clearDoc()
          setStrokes([])
          setTexts([])
        },
      }
    }
  }, [strokes, texts, camera])
  // History lives in refs: state updaters must stay pure (StrictMode
  // double-invokes impure updaters). Nothing renders from the stacks.
  const undoStackRef = useRef<Action[]>([])
  const redoStackRef = useRef<Action[]>([])
  const [mode, setMode] = useState<AppMode>('canvas')
  const modeRef = useRef<AppMode>('canvas')
  const setModeBoth = useCallback((m: AppMode) => {
    modeRef.current = m
    setMode(m)
  }, [])
  const setStateBoth = useCallback(
    (s: ModeState) => {
      setModeBoth(s.mode)
    },
    [setModeBoth],
  )

  // v1: sync with Rust mode state machine + tray tool picks.
  useEffect(() => {
    let unlistenMode: (() => void) | null = null
    let unlistenTool: (() => void) | null = null
    getMode().then(setStateBoth)
    onModeChanged(setStateBoth).then((u) => {
      unlistenMode = u
    })
    onToolChanged(setTool).then((u) => {
      unlistenTool = u
    })
    return () => {
      unlistenMode?.()
      unlistenTool?.()
    }
  }, [setStateBoth])

  // v1: cursor tool passes clicks through to the desktop (backend owns the
  // OS flag). Bare V/B/E only arrive when the window is focused; the tray
  // menu and the app shortcut are the focus-free paths back to the brush.
  useEffect(() => {
    void setPassthrough(tool === 'cursor')
  }, [tool, mode])

  // Draft being drawn (kept in ref to avoid re-renders per pointermove)
  const draftRef = useRef<Point[] | null>(null)
  // Live mirrors for high-frequency reads inside draw() and handlers.
  const strokesRef = useRef<Stroke[]>(strokes)
  const toolRef = useRef<Tool>(tool)
  const cameraRef = useRef<Camera>(camera)
  useEffect(() => {
    strokesRef.current = strokes
  }, [strokes])
  useEffect(() => {
    toolRef.current = tool
  }, [tool])
  useEffect(() => {
    cameraRef.current = camera
  }, [camera])
  const spaceHeldRef = useRef(false)
  const panningRef = useRef<{ startScreen: Point; startCam: Camera } | null>(null)
  const [editing, setEditing] = useState<{ at: Point; value: string } | null>(null)

  const pushAction = useCallback((action: Action) => {
    undoStackRef.current.push(action)
    redoStackRef.current = []
  }, [])

  const undo = useCallback(() => {
    const action = undoStackRef.current.pop()
    if (!action) return
    redoStackRef.current.push(action)
    if (action.kind === 'stroke') {
      const id = action.stroke.id
      setStrokes((s) => s.filter((st) => st.id !== id))
    } else {
      const id = action.text.id
      setTexts((t) => t.filter((tx) => tx.id !== id))
    }
  }, [])

  const redo = useCallback(() => {
    const action = redoStackRef.current.pop()
    if (!action) return
    undoStackRef.current.push(action)
    if (action.kind === 'stroke') {
      setStrokes((s) => [...s, action.stroke])
    } else {
      setTexts((t) => [...t, action.text])
    }
  }, [])

  // ---- rendering ----
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const w = window.innerWidth
    const h = window.innerHeight
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr
      canvas.height = h * dpr
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    const cam = cameraRef.current
    const paint = (points: Point[], erase: boolean, width: number) => {
      if (points.length === 0) return
      ctx.save()
      if (erase) {
        ctx.globalCompositeOperation = 'destination-out'
        ctx.strokeStyle = 'rgba(0,0,0,1)'
      } else {
        ctx.globalCompositeOperation = 'source-over'
        ctx.strokeStyle = '#ffffff'
        ctx.shadowColor = 'rgba(0,0,0,0.6)'
        ctx.shadowBlur = 3
      }
      ctx.lineWidth = width * cam.zoom
      ctx.beginPath()
      const p0 = worldToScreen(points[0], cam)
      ctx.moveTo(p0.x, p0.y)
      for (let i = 1; i < points.length; i++) {
        const p = worldToScreen(points[i], cam)
        ctx.lineTo(p.x, p.y)
      }
      if (points.length === 1) {
        // dot: draw a tiny segment so single clicks are visible
        ctx.lineTo(p0.x + 0.01, p0.y + 0.01)
      }
      ctx.stroke()
      ctx.restore()
    }

    for (const st of strokesRef.current) {
      paint(st.points, st.erase, st.erase ? ERASER_WIDTH : PEN_WIDTH)
    }
    if (draftRef.current) {
      const erasing = toolRef.current === 'eraser'
      paint(draftRef.current, erasing, erasing ? ERASER_WIDTH : PEN_WIDTH)
    }
  }, [])

  useEffect(() => {
    draw()
  }, [strokes, camera, tool, draw])

  useEffect(() => {
    const onResize = () => draw()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [draw])

  // ---- keyboard: tools + undo/redo ----
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceHeldRef.current = true
        e.preventDefault()
        return
      }
      if (e.key === 'Escape' && modeRef.current === 'overlay') {
        void toggleOverlay()
        return
      }
      const target = e.target as HTMLElement | null
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      if (typing) return
      if (e.key === 'v' || e.key === 'V') setTool('cursor')
      else if (e.key === 'b' || e.key === 'B') setTool('brush')
      else if (e.key === 'e' || e.key === 'E') setTool('eraser')
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) redo()
        else undo()
        e.preventDefault()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        redo()
        e.preventDefault()
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceHeldRef.current = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [undo, redo])

  // ---- wheel zoom (non-passive, centered on cursor) ----
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const cursor = { x: e.clientX - rect.left, y: e.clientY - rect.top }
      setCamera((cam) => {
        const factor = Math.exp(-e.deltaY * 0.0015)
        const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, cam.zoom * factor))
        const before = screenToWorld(cursor, cam)
        return {
          zoom,
          x: cursor.x - before.x * zoom,
          y: cursor.y - before.y * zoom,
        }
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // ---- pointer: draw or pan ----
  const posFromEvent = (e: React.PointerEvent): Point => {
    const rect = wrapRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button === 1 || spaceHeldRef.current) {
      panningRef.current = { startScreen: posFromEvent(e), startCam: cameraRef.current }
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      return
    }
    if (e.button !== 0) return
    // Cursor tool never paints: clicks belong to the desktop (the backend
    // passes them through) or to pan/zoom/text gestures.
    if (toolRef.current === 'cursor') return
    const world = screenToWorld(posFromEvent(e), cameraRef.current)
    draftRef.current = [world]
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    draw()
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (panningRef.current) {
      const screen = posFromEvent(e)
      const { startScreen, startCam } = panningRef.current
      setCamera({
        ...startCam,
        x: startCam.x + (screen.x - startScreen.x),
        y: startCam.y + (screen.y - startScreen.y),
      })
      return
    }
    if (!draftRef.current) return
    draftRef.current.push(screenToWorld(posFromEvent(e), cameraRef.current))
    draw()
  }

  const onPointerUp = () => {
    if (panningRef.current) {
      panningRef.current = null
      return
    }
    if (!draftRef.current) return
    const points = draftRef.current
    draftRef.current = null
    if (points.length === 0) {
      draw()
      return
    }
    const stroke: Stroke = { id: newId(), points, erase: toolRef.current === 'eraser' }
    setStrokes((s) => [...s, stroke])
    pushAction({ kind: 'stroke', stroke })
  }

  // ---- text: double-click to create ----
  const onDoubleClick = (e: React.MouseEvent) => {
    const rect = wrapRef.current!.getBoundingClientRect()
    const screen = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    setEditing({ at: screenToWorld(screen, cameraRef.current), value: '' })
  }

  const commitEditing = useCallback(
    (value: string) => {
      const trimmed = value.trim()
      if (trimmed.length > 0 && editing) {
        const text: TextItem = { id: newId(), at: editing.at, content: trimmed }
        setTexts((t) => [...t, text])
        pushAction({ kind: 'text', text })
      }
      setEditing(null)
    },
    [editing, pushAction],
  )

  return (
    <div
      ref={wrapRef}
      className="canvie-canvas-wrap"
      style={{ cursor: tool === 'cursor' ? 'default' : 'crosshair' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={onDoubleClick}
    >
      {/* Focus backdrop: blurs + dims everything behind the canvas content
          while in Overlay Mode. First child so strokes, texts and the
          toolbar paint above it; pointer-events stay with the canvas. */}
      {mode === 'overlay' && <div className="canvie-overlay-backdrop" aria-hidden="true" />}
      <canvas ref={canvasRef} className="canvie-canvas" />
      {texts.map((t) => (
        <CanvasText key={t.id} item={t} camera={camera} />
      ))}
      {editing && (
        <TextEditor
          at={editing.at}
          camera={camera}
          onCommit={commitEditing}
          onCancel={() => setEditing(null)}
        />
      )}
      <Toolbar mode={mode} tool={tool} onTool={setTool} />
    </div>
  )
}
