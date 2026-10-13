import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Canvas } from './canvas/Canvas'
import type { CanvasDoc, Tool } from './canvasTypes'
import type { DocumentPersistence, LoadResult } from './persistence'
import { Toolbar } from './Toolbar'

type AppProps = {
  persistence: DocumentPersistence
  initialLoad: LoadResult
}

type SaveNoticeProps = {
  blocked: boolean
  saveFailed: boolean
  recovered: boolean
  onRetry: () => void
  onDismissRecovery: () => void
}

function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || target.matches('input, textarea, select'))
}

function SaveNotice({ blocked, saveFailed, recovered, onRetry, onDismissRecovery }: SaveNoticeProps) {
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
  const [past, setPast] = useState<CanvasDoc[]>([])
  const [future, setFuture] = useState<CanvasDoc[]>([])
  const [recovered, setRecovered] = useState(initialLoad.status === 'recovered')
  const saveFailed = useSyncExternalStore(persistence.subscribe, persistence.hasFailed)
  const docRef = useRef(doc)
  const pastRef = useRef<CanvasDoc[]>([])
  const futureRef = useRef<CanvasDoc[]>([])

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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return
      if (event.key.toLowerCase() === 'b') setTool('brush')
      if (event.key.toLowerCase() === 't') setTool('text')
      if (event.key.toLowerCase() === 'e') setTool('eraser')
      if (event.ctrlKey && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
      }
      if (event.ctrlKey && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [redo, undo])

  return (
    <main className="canvie-shell" aria-labelledby="canvie-title">
      <header className="canvas-status" aria-live="polite">
        <h1 id="canvie-title">Canvie</h1>
        <span>Edição local</span>
      </header>
      <SaveNotice
        blocked={initialLoad.status === 'blocked'}
        saveFailed={saveFailed}
        recovered={recovered}
        onRetry={retrySave}
        onDismissRecovery={() => setRecovered(false)}
      />
      <Canvas doc={doc} tool={tool} onChange={commit} />
      <Toolbar tool={tool} canUndo={past.length > 0} canRedo={future.length > 0} onToolChange={setTool} onUndo={undo} onRedo={redo} />
    </main>
  )
}
