import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { AnimationEvent } from 'react'
import { fitArea, type Viewport } from './canvas/area'
import { AreaSelector } from './canvas/AreaSelector'
import { fitCamera, measureNotes, zoomCamera } from './canvas/camera'
import { Canvas } from './canvas/Canvas'
import { DEFAULT_NOTE_FONT, INK_COLORS, type Area, type Background, type Brush, type CanvasDoc, type NoteFont, type NoteSize, type Tool } from './canvasTypes'
import { ClearDialog, ContextMenu } from './ContextMenu'
import type { DocumentPersistence, LoadResult } from './persistence'
import { enterEdit, getPlacement, initialPlacement, onCloseRequested, onEditRequested, onPinRequested, onPlacementChanged, onToolbarReset, pinToWall, quitApp, type Placement } from './placement'
import { loadToolbarPosition, saveToolbarPosition, type ToolbarPosition } from './preferences'
import { prefersReducedMotion, waitForExit } from './motion'
import { Toolbar, type ToolbarPopover } from './Toolbar'
import './motion.css'

const TOOL_SHORTCUTS: Record<string, Tool | undefined> = {
  h: 'hand',
  b: 'brush',
  t: 'text',
  p: 'postit',
  e: 'eraser',
}

// The options of the active tool open in a popover above the toolbar.
function toolPopover(tool: Tool): ToolbarPopover {
  if (tool === 'brush' || tool === 'eraser') return 'brush'
  if (tool === 'text' || tool === 'postit') return 'size'
  return null
}

function useViewport(): Viewport {
  const [viewport, setViewport] = useState<Viewport>(() => ({ width: window.innerWidth, height: window.innerHeight }))
  useEffect(() => {
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return viewport
}

// Mirrors the backend placement. The current placement is read only after
// the event listener is live, so a transition in between is never lost; an
// event wins over a slower query.
function usePlacement(): Placement {
  const [placement, setPlacement] = useState<Placement>(initialPlacement)
  useEffect(() => {
    let eventSeen = false
    let active = true
    const subscription = onPlacementChanged((snapshot) => {
      eventSeen = true
      setPlacement(snapshot.placement)
    })
    subscription.ready
      .then(getPlacement)
      .then((snapshot) => {
        if (active && snapshot && !eventSeen) setPlacement(snapshot.placement)
      })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])
  return placement
}

type AppProps = {
  persistence: DocumentPersistence
  initialLoad: LoadResult
}

type SaveNoticeProps = {
  blocked: boolean
  saveFailed: boolean
  pinFailed: boolean
  recovered: boolean
  onRetry: () => void
  onRetryPin: () => void
  onDismissRecovery: () => void
}

function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || target.matches('input, textarea, select'))
}

function SaveNotice({ blocked, saveFailed, pinFailed, recovered, onRetry, onRetryPin, onDismissRecovery }: SaveNoticeProps) {
  if (blocked) {
    return (
      <p className="canvas-notice is-error" role="alert">
        O documento salvo não pôde ser lido com segurança. Nada será salvo nesta sessão.
      </p>
    )
  }
  if (saveFailed) {
    return (
      <div className="canvas-notice is-error" role="alert">
        <span>Não foi possível salvar. O canvas continua aberto.</span>
        <button className="notice-action" type="button" onClick={onRetry}>
          Tentar novamente
        </button>
      </div>
    )
  }
  if (pinFailed) {
    return (
      <div className="canvas-notice is-error" role="alert">
        <span>O canvas foi salvo, mas não voltou ao desktop.</span>
        <button className="notice-action" type="button" onClick={onRetryPin}>
          Tentar novamente
        </button>
      </div>
    )
  }
  if (recovered) {
    return (
      <div className="canvas-notice" role="status">
        <span>O documento salvo era inválido. Guardamos uma cópia e abrimos um canvas vazio.</span>
        <button className="notice-action" type="button" onClick={onDismissRecovery}>
          Fechar
        </button>
      </div>
    )
  }
  return null
}

export default function App({ persistence, initialLoad }: AppProps) {
  const [doc, setDoc] = useState<CanvasDoc>(initialLoad.document)
  // Seleção is the default, so a double click on the canvas starts a note.
  const [tool, setTool] = useState<Tool>('select')
  const [selection, setSelection] = useState<number | null>(null)
  const [ink, setInk] = useState<string>(INK_COLORS[0].value)
  const [brush, setBrush] = useState<Brush>('pen')
  const [noteFont, setNoteFont] = useState<NoteFont>(DEFAULT_NOTE_FONT)
  const [noteSize, setNoteSize] = useState<NoteSize>('md')
  const [selectingArea, setSelectingArea] = useState(initialLoad.document.area === null)
  const viewport = useViewport()
  const placement = usePlacement()
  const editing = placement === 'edit'
  const [toolbarPosition, setToolbarPosition] = useState<ToolbarPosition | null>(loadToolbarPosition)
  // Esc closes the open popover until the next tool choice.
  const [popoverClosed, setPopoverClosed] = useState(false)
  const [noteEditorOpen, setNoteEditorOpen] = useState(false)
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const [confirmingClear, setConfirmingClear] = useState(false)
  // The canvas is sinking out of Edit after a successful save.
  const [leaving, setLeaving] = useState(false)
  // The canvas is rising into Edit from the desktop. Only that change plays
  // the rise: an area that is just being drawn stays where the pointer left it.
  const [entering, setEntering] = useState(false)
  // Wall was asked to become Edit: the canvas takes the pose its entrance
  // starts from before the window rises.
  const [preparing, setPreparing] = useState(false)
  const lastPlacementRef = useRef(placement)
  const [recovered, setRecovered] = useState(initialLoad.status === 'recovered')
  const [pinning, setPinning] = useState(false)
  const [pinFailed, setPinFailed] = useState(false)
  const saveFailed = useSyncExternalStore(persistence.subscribe, persistence.hasFailed)
  const docRef = useRef(doc)
  const pastRef = useRef<CanvasDoc[]>([])
  const futureRef = useRef<CanvasDoc[]>([])
  const pinningRef = useRef(false)
  const firstRunRef = useRef(false)

  // Every document change gets the next revision here, then goes to the saver.
  const applyDocument = useCallback(
    (content: CanvasDoc) => {
      const nextDoc = { ...content, revision: docRef.current.revision + 1 }
      docRef.current = nextDoc
      setDoc(nextDoc)
      persistence.schedule(nextDoc)
    },
    [persistence],
  )

  const commit = useCallback(
    (nextDoc: CanvasDoc) => {
      pastRef.current = [...pastRef.current, docRef.current]
      futureRef.current = []
      applyDocument(nextDoc)
    },
    [applyDocument],
  )

  const undo = useCallback(() => {
    const previous = pastRef.current.at(-1)
    if (!previous) return
    pastRef.current = pastRef.current.slice(0, -1)
    futureRef.current = [docRef.current, ...futureRef.current]
    applyDocument(previous)
  }, [applyDocument])

  const redo = useCallback(() => {
    const next = futureRef.current[0]
    if (!next) return
    futureRef.current = futureRef.current.slice(1)
    pastRef.current = [...pastRef.current, docRef.current]
    applyDocument(next)
  }, [applyDocument])

  const retrySave = useCallback(() => {
    // A failed retry stays visible through hasFailed() and is already logged.
    persistence.saveNow(docRef.current).catch(() => undefined)
  }, [persistence])

  const selectArea = useCallback(
    (area: Area) => {
      commit({ ...docRef.current, area })
      setSelectingArea(false)
    },
    [commit],
  )

  const cancelAreaSelection = useCallback(() => setSelectingArea(false), [])

  // Undoing the first area selection leaves no area, so the selector returns.
  const showAreaSelector = editing && (selectingArea || doc.area === null)

  // Tools are toggles: choosing the active tool again goes back to Seleção.
  // Any tool change drops the selection, which exists only in Seleção.
  const chooseTool = useCallback((next: Tool) => {
    setTool((current) => (current === next ? 'select' : next))
    setSelection(null)
    setPopoverClosed(false)
  }, [])

  // Caneta and Borracha in the Pincel popover set the tool without toggling.
  const chooseDrawingTool = useCallback((next: 'brush' | 'eraser') => {
    setTool(next)
    setSelection(null)
    setPopoverClosed(false)
  }, [])

  // Caneta and Marca-texto choose how the Pincel draws, and draw with it.
  const chooseBrush = useCallback(
    (next: Brush) => {
      setBrush(next)
      chooseDrawingTool('brush')
    },
    [chooseDrawingTool],
  )

  // Choosing an ink means drawing with it.
  const chooseInk = useCallback(
    (next: string) => {
      setInk(next)
      chooseDrawingTool('brush')
    },
    [chooseDrawingTool],
  )

  // The toolbar position is a preference, outside the document and its history.
  const changeToolbarPosition = useCallback((position: ToolbarPosition | null) => {
    setToolbarPosition(position)
    saveToolbarPosition(position)
  }, [])

  useEffect(() => onToolbarReset(() => changeToolbarPosition(null)), [changeToolbarPosition])

  const setTheme = useCallback(
    (background: Background) => {
      if (docRef.current.background !== background) commit({ ...docRef.current, background })
    },
    [commit],
  )

  // Ajustar à tela frames every stroke and note in the area as it is drawn now.
  const fitToScreen = useCallback(() => {
    const current = docRef.current
    if (!current.area) return
    commit({ ...current, camera: fitCamera(current, fitArea(current.area, viewport), measureNotes()) })
  }, [commit, viewport])

  const zoomTo = useCallback(
    (percent: number) => {
      const current = docRef.current
      const camera = zoomCamera(current.camera, percent)
      if (camera.zoom !== current.camera.zoom) commit({ ...current, camera })
    },
    [commit],
  )

  // Limpar keeps the area, the background and the camera; Ctrl + Z undoes it.
  const clearCanvas = useCallback(() => {
    setConfirmingClear(false)
    setSelection(null)
    const current = docRef.current
    if (current.strokes.length > 0 || current.notes.length > 0) commit({ ...current, strokes: [], notes: [] })
  }, [commit])

  const noteCreated = useCallback((id: number) => {
    setTool('select')
    setSelection(id)
  }, [])

  const deleteSelection = useCallback(() => {
    const current = docRef.current
    if (selection === null || !current.notes.some((note) => note.id === selection)) return
    commit({ ...current, notes: current.notes.filter((note) => note.id !== selection) })
    setSelection(null)
  }, [commit, selection])

  // Fixar no desktop: close the note editor, save, and only then ask the
  // backend to move the window. A failed save keeps Edit and the notice.
  const requestPin = useCallback(async () => {
    if (pinningRef.current || docRef.current.area === null) return
    pinningRef.current = true
    setPinning(true)
    setPinFailed(false)
    // Blurring an open note editor commits it before the save.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    setSelectingArea(false)
    setSelection(null)
    setMenu(null)
    setConfirmingClear(false)
    try {
      await persistence.saveNow(docRef.current)
      // Only a saved document leaves; the window moves once the canvas has sunk.
      setLeaving(true)
      await waitForExit()
      await pinToWall().catch((error: unknown) => {
        console.warn('Canvie: pin_to_wall failed; staying in Edit', error)
        setPinFailed(true)
        setLeaving(false)
      })
    } catch {
      // saveNow already logged the failure and raised the save notice.
    } finally {
      pinningRef.current = false
      setPinning(false)
    }
  }, [persistence])

  useEffect(() => onPinRequested(() => void requestPin()), [requestPin])

  // Closing the window in Edit pins the area. Before the first area there is
  // nothing to pin, so closing quits. Undoing back past the first area leaves
  // a debounced save, which is written before the app exits.
  useEffect(
    () =>
      onCloseRequested(() => {
        if (docRef.current.area !== null) {
          void requestPin()
          return
        }
        persistence.flush()
        quitApp().catch((error: unknown) => console.warn('Canvie: quit_app failed', error))
      }),
    [persistence, requestPin],
  )

  // The first launch has no area, so it opens Edit to drag one.
  useEffect(() => {
    if (placement !== 'wall' || docRef.current.area !== null || firstRunRef.current) return
    firstRunRef.current = true
    enterEdit().catch((error: unknown) => console.warn('Canvie: enter_edit failed on first run', error))
  }, [placement])

  // The sizes stay at hand while any note is being written, new or not.
  const popover = noteEditorOpen ? 'size' : popoverClosed ? null : toolPopover(tool)

  // The right-click menu opens inside the area, in Edit only. Shift + F10 and
  // the Menu key open it at the center of the area. Only the note editor
  // keeps the WebView's own menu, for cut, copy and paste.
  const openMenuAtCenter = useCallback(() => {
    const rect = document.querySelector('.canvas-area')?.getBoundingClientRect()
    if (rect) setMenu({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 })
  }, [])

  useEffect(() => {
    if (!editing) return
    const onContextMenu = (event: MouseEvent) => {
      if (isEditableTarget(event.target)) return
      event.preventDefault()
      if (showAreaSelector || confirmingClear || menu || !(event.target instanceof Element)) return
      if (event.target.closest('.canvas-area')) setMenu({ x: event.clientX, y: event.clientY })
    }
    window.addEventListener('contextmenu', onContextMenu)
    return () => window.removeEventListener('contextmenu', onContextMenu)
  }, [confirmingClear, editing, menu, showAreaSelector])

  useEffect(() => {
    if (!editing) return
    const onKeyDown = (event: KeyboardEvent) => {
      // The menu and the Limpar dialog handle their own keys.
      if (menu || confirmingClear || isEditableTarget(event.target)) return
      const key = event.key.toLowerCase()
      if ((key === 'contextmenu' || (key === 'f10' && event.shiftKey)) && !showAreaSelector && docRef.current.area) {
        event.preventDefault()
        openMenuAtCenter()
        return
      }
      // Esc steps back one layer at a time: the note editor handles its own
      // Esc, then the popover closes, then the selection drops, then the
      // area is saved and pinned.
      if (key === 'escape' && !showAreaSelector) {
        event.preventDefault()
        if (popover) {
          setPopoverClosed(true)
          return
        }
        // An undo can remove the selected note; that selection is not shown.
        const shown = selection !== null && docRef.current.notes.some((note) => note.id === selection)
        setSelection(null)
        if (!shown) void requestPin()
        return
      }
      if ((key === 'delete' || key === 'backspace') && selection !== null) {
        event.preventDefault()
        deleteSelection()
        return
      }
      if (!event.ctrlKey && !event.altKey && !event.metaKey) {
        const shortcutTool = TOOL_SHORTCUTS[key]
        if (shortcutTool) chooseTool(shortcutTool)
      }
      if (event.ctrlKey && key === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
      }
      if (event.ctrlKey && key === 'y') {
        event.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [chooseTool, confirmingClear, deleteSelection, editing, menu, openMenuAtCenter, popover, redo, requestPin, selection, showAreaSelector, undo])

  // Wall ends the exit; the canvas then settles on the desktop.
  useEffect(() => {
    if (!editing) setLeaving(false)
  }, [editing])

  // The rise ends on its own animationend, so a slower frame rate never cuts
  // it short; Wall clears it too, in case the rise was interrupted.
  useEffect(() => {
    const previous = lastPlacementRef.current
    lastPlacementRef.current = placement
    if (placement === 'wall') setEntering(false)
    else {
      setPreparing(false)
      if (previous === 'wall' && docRef.current.area !== null && !prefersReducedMotion()) setEntering(true)
    }
  }, [placement])

  // The window shows its last frame as it rises, so the pose must be drawn
  // first: two animation frames, then enter_edit. Without a canvas or with
  // reduced motion there is nothing to pose.
  useEffect(
    () =>
      onEditRequested(() => {
        const enter = () =>
          enterEdit().catch((error: unknown) => {
            console.warn('Canvie: enter_edit failed after the edit request', error)
            setPreparing(false)
          })
        if (docRef.current.area === null || prefersReducedMotion()) {
          void enter()
          return
        }
        setPreparing(true)
        requestAnimationFrame(() => requestAnimationFrame(() => void enter()))
      }),
    [],
  )

  const endEntering = useCallback((event: AnimationEvent<HTMLElement>) => {
    if (event.animationName === 'canvas-rise') setEntering(false)
  }, [])

  const area = doc.area && fitArea(doc.area, viewport)

  // On the desktop only the area is painted; the edit chrome exists in Edit.
  return (
    <main className={`canvie-shell is-${placement}${preparing ? ' is-preparing' : ''}${entering ? ' is-entering' : ''}${leaving ? ' is-leaving' : ''}`} aria-label="Canvie" onAnimationEnd={endEntering}>
      {area && (
        <>
          <Canvas
            doc={doc}
            area={area}
            tool={tool}
            ink={ink}
            brush={brush}
            noteSize={noteSize}
            noteFont={noteFont}
            selection={editing ? selection : null}
            onChange={commit}
            onNoteSizeChange={setNoteSize}
            onNoteFontChange={setNoteFont}
            onSelect={setSelection}
            onNoteCreated={noteCreated}
            onEditorChange={setNoteEditorOpen}
          />
          {editing && !showAreaSelector && <div className="area-frame" style={{ left: area.x, top: area.y, width: area.width, height: area.height }} aria-hidden="true" />}
        </>
      )}
      {showAreaSelector && <AreaSelector cancelable={doc.area !== null} onSelect={selectArea} onCancel={cancelAreaSelection} />}
      {editing && (
        <>
          <SaveNotice
            blocked={initialLoad.status === 'blocked'}
            saveFailed={saveFailed}
            pinFailed={pinFailed}
            recovered={recovered}
            onRetry={retrySave}
            onRetryPin={() => void requestPin()}
            onDismissRecovery={() => setRecovered(false)}
          />
          <Toolbar
            tool={tool}
            ink={ink}
            brush={brush}
            noteSize={noteSize}
            noteFont={noteFont}
            popover={popover}
            position={toolbarPosition}
            pinning={pinning}
            canPin={doc.area !== null}
            onToolChange={chooseTool}
            onDrawingToolChange={chooseDrawingTool}
            onBrushChange={chooseBrush}
            onInkChange={chooseInk}
            onNoteSizeChange={setNoteSize}
            onNoteFontChange={setNoteFont}
            onPositionChange={changeToolbarPosition}
            onPin={() => void requestPin()}
          />
          {menu && (
            <ContextMenu
              x={menu.x}
              y={menu.y}
              background={doc.background}
              zoom={doc.camera.zoom}
              onClose={() => setMenu(null)}
              onRepositionToolbar={() => changeToolbarPosition(null)}
              onTheme={setTheme}
              onRedefineArea={() => setSelectingArea(true)}
              onFit={fitToScreen}
              onZoom={zoomTo}
              onClear={() => setConfirmingClear(true)}
            />
          )}
          {confirmingClear && <ClearDialog onCancel={() => setConfirmingClear(false)} onConfirm={clearCanvas} />}
        </>
      )}
    </main>
  )
}
