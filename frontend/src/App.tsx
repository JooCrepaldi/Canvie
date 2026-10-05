import { useCallback, useEffect, useRef, useState } from 'react'
import { Canvas } from './canvas/Canvas'
import { createEmptyDocument, type CanvasDoc, type Tool } from './canvasTypes'
import { Toolbar } from './Toolbar'

export default function App() {
  const [doc, setDoc] = useState<CanvasDoc>(createEmptyDocument)
  const [tool, setTool] = useState<Tool>('brush')
  const [past, setPast] = useState<CanvasDoc[]>([])
  const [future, setFuture] = useState<CanvasDoc[]>([])
  const docRef = useRef(doc)
  const pastRef = useRef<CanvasDoc[]>([])
  const futureRef = useRef<CanvasDoc[]>([])

  const commit = useCallback((nextDoc: CanvasDoc) => {
    pastRef.current = [...pastRef.current, docRef.current]
    futureRef.current = []
    setPast(pastRef.current)
    setFuture(futureRef.current)
    docRef.current = nextDoc
    setDoc(nextDoc)
  }, [])

  const undo = useCallback(() => {
    const previous = pastRef.current.at(-1)
    if (!previous) return
    pastRef.current = pastRef.current.slice(0, -1)
    futureRef.current = [docRef.current, ...futureRef.current]
    setPast(pastRef.current)
    setFuture(futureRef.current)
    docRef.current = previous
    setDoc(previous)
  }, [])

  const redo = useCallback(() => {
    const next = futureRef.current[0]
    if (!next) return
    futureRef.current = futureRef.current.slice(1)
    pastRef.current = [...pastRef.current, docRef.current]
    setPast(pastRef.current)
    setFuture(futureRef.current)
    docRef.current = next
    setDoc(next)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
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
      <Canvas doc={doc} tool={tool} onChange={commit} />
      <Toolbar tool={tool} canUndo={past.length > 0} canRedo={future.length > 0} onToolChange={setTool} onUndo={undo} onRedo={redo} />
    </main>
  )
}
