import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { fitArea, type Viewport } from './canvas/area'
import { AreaSelector } from './canvas/AreaSelector'
import { Canvas } from './canvas/Canvas'
import { INK_COLORS, type Area, type CanvasDoc, type NoteSize, type Tool } from './canvasTypes'
import type { DocumentPersistence, LoadResult } from './persistence'
import { enterEdit, getPlacement, initialPlacement, onCloseRequested, onPinRequested, onPlacementChanged, pinToWall, quitApp, type Placement } from './placement'
import { Toolbar } from './Toolbar'

const TOOL_SHORTCUTS: Record<string, Tool | undefined> = {
  b: 'brush',
  t: 'text',
  p: 'postit',
  e: 'eraser',
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
  const [tool, setTool] = useState<Tool>('brush')
  const [ink, setInk] = useState<string>(INK_COLORS[0].value)
  const [noteSize, setNoteSize] = useState<NoteSize>('md')
  const [selectingArea, setSelectingArea] = useState(initialLoad.document.area === null)
  const viewport = useViewport()
  const placement = usePlacement()
  const editing = placement === 'edit'
  const [past, setPast] = useState<CanvasDoc[]>([])
  const [future, setFuture] = useState<CanvasDoc[]>([])
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
      setPast(pastRef.current)
      setFuture(futureRef.current)
      applyDocument(nextDoc)
    },
    [applyDocument],
  )

  const undo = useCallback(() => {
    const previous = pastRef.current.at(-1)
    if (!previous) return
    pastRef.current = pastRef.current.slice(0, -1)
    futureRef.current = [docRef.current, ...futureRef.current]
    setPast(pastRef.current)
    setFuture(futureRef.current)
    applyDocument(previous)
  }, [applyDocument])

  const redo = useCallback(() => {
    const next = futureRef.current[0]
    if (!next) return
    futureRef.current = futureRef.current.slice(1)
    pastRef.current = [...pastRef.current, docRef.current]
    setPast(pastRef.current)
    setFuture(futureRef.current)
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

  const toggleBackground = useCallback(() => {
    commit({ ...docRef.current, background: docRef.current.background === 'paper' ? 'transparent' : 'paper' })
  }, [commit])

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
    try {
      await persistence.saveNow(docRef.current)
      await pinToWall().catch((error: unknown) => {
        console.warn('Canvie: pin_to_wall failed; staying in Edit', error)
        setPinFailed(true)
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

  useEffect(() => {
    if (!editing) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return
      const key = event.key.toLowerCase()
      if (key === 'escape' && !showAreaSelector) {
        event.preventDefault()
        void requestPin()
        return
      }
      if (!event.ctrlKey && !event.altKey && !event.metaKey) {
        const shortcutTool = TOOL_SHORTCUTS[key]
        if (shortcutTool) setTool(shortcutTool)
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
  }, [editing, redo, requestPin, showAreaSelector, undo])

  const area = doc.area && fitArea(doc.area, viewport)

  // On the desktop only the area is painted; the edit chrome exists in Edit.
  return (
    <main className="canvie-shell" aria-label="Canvie">
      {area && (
        <>
          <Canvas doc={doc} area={area} tool={tool} ink={ink} noteSize={noteSize} onChange={commit} onNoteSizeChange={setNoteSize} />
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
            noteSize={noteSize}
            background={doc.background}
            canUndo={past.length > 0}
            canRedo={future.length > 0}
            onToolChange={setTool}
            onInkChange={setInk}
            onNoteSizeChange={setNoteSize}
            onBackgroundToggle={toggleBackground}
            onSelectArea={() => setSelectingArea(true)}
            onUndo={undo}
            onRedo={redo}
            pinning={pinning}
            canPin={doc.area !== null}
            onPin={() => void requestPin()}
          />
        </>
      )}
    </main>
  )
}
