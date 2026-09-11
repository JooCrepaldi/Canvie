# Canvie — Frontend (as built, MVP-0)

> Stack: Vite + React 19 + TypeScript strict + raw Canvas 2D. No canvas library, no CSS framework. UI strings pt-BR, code/comments English. Paths relative to `frontend/src/`.

## 1. Files

| File | Owns |
| --- | --- |
| `App.tsx:1-12` | Transparent shell div, renders `<Canvas />` only |
| `Canvas.tsx` | All drawing, camera, tools, undo/redo, text creation, mode mirror, HintPill |
| `canvasTypes.ts` | `Point`, `Stroke{id,points,erase}`, `TextItem{id,at,content}`, `Camera{x,y,zoom}`, `Tool='pen'\|'eraser'`, `PEN_WIDTH=3`, `ERASER_WIDTH=24`, id counter + `reseedIds` |
| `persistence.ts` | Doc model, validation, load/save/clear, debounced saver |
| `mode.ts` | Tauri bridge with fallbacks |
| `index.css`, `App.css` | Total transparency + canvas/text/pill styling |
| `main.tsx` | StrictMode root |

## 2. Rendering

- One `<canvas>` (`Canvas.tsx:398`), sized to `window.innerWidth/Height × devicePixelRatio` per frame (`192-204`).
- Per-frame: `setTransform(dpr,...)`, `clearRect`, `lineCap/Join=round`; pen strokes white with subtle shadow, eraser uses `destination-out` (`209-236`).
- Committed strokes live in state (render), the in-progress draft lives in `draftRef` (no re-render per pointermove), plus `strokesRef`/`toolRef`/`cameraRef` mirrors for hot reads (`145-157`).
- Redraw triggers: `strokes`, `camera`, `tool` change + explicit `draw()` during pointer events + window resize (`247-255`).
- Single-click dots: a 0.01px segment is added so clicks are visible (`230-233`).
- Texts are HTML divs positioned via `worldToScreen` (`28-38`); the editor is a positioned `<input>` committing on Enter/blur, cancelling on Escape (`40-68`).

## 3. Camera

`screenToWorld = (screen - cam) / zoom`, `worldToScreen = world*zoom + cam` (`18-24`). Pan: `Space` or middle-button drag (`323-327`, `337-346`). Zoom: non-passive wheel listener, `factor = exp(-deltaY*0.0015)`, clamped `0.2–4`, anchored at cursor (`297-315`). Camera persists via doc model.

## 4. Tools + history (MVP-0 frozen)

- Keys `1`/`2` switch pen/eraser; typing in inputs is ignored for shortcuts (`269-273`).
- Pointer down starts draft in world coords with pointer capture; move appends; up commits a `Stroke{id: newId(), points, erase}` and pushes `{kind:'stroke'}` (`323-367`).
- Double-click creates `{at, value:''}` editor; commit trims and pushes `{kind:'text'}` (`370-387`).
- Undo/redo are `useRef` stacks (StrictMode-safe: updaters stay pure, nothing renders from stacks — `114-115`). Undo pops to redo + filters by id; redo re-appends (`167-189`). Stacks are memory-only.
- `Ctrl+Z` / `Ctrl+Shift+Z` / `Ctrl+Y` handled locally (`274-281`).

## 5. Persistence wiring

Boot: `loadDoc()` once via `useMemo`, state initialized from it (`90-93`). Every change calls `createSaver(500)` (`94-99`). Dev-only `window.__canvie.export/clear` (`101-113`). Validation/null-on-corrupt + `reseedIds(maxId)` live in `persistence.ts:31-62`. Storage key `canvie.canvas.v1`. No Rust file command in MVP-0.

## 6. Mode mirror (never invent mode)

Boot `getMode().then(setModeBoth)` + `onModeChanged(setStateBoth)` (`134-141`), with `modeRef` mirror for hot-key handlers (`120-131`). `Escape` in overlay calls `toggleOverlay()` (`265-268`). `HintPill` (`71-82`) shows locked/overlay/raised/tool hints; CSS class `canvie-toolbar-hint` is `pointer-events: none`, centered above taskbar (`App.css:58-70`) — it must never eat desktop clicks.

## 7. Transparency + fallback rules

`html/body/#root` transparent (`index.css:6-12`), shell transparent, no opaque backgrounds (`App.css:1-19`). Every `mode.ts`/`persistence.ts` bridge degrades without Tauri (`inTauri` check, try/catch, null adapter) so `npm run dev` in a browser still draws.

## 8. How to add a tool (v1 pattern, not yet built)

Add to `Tool` union + width const in `canvasTypes.ts`, switch key in the `keydown` handler, paint branch in `draw()`, pill label. Keep drafts in refs. Do not add a canvas library before raw Canvas 2D proves insufficient (AGENTS.md §9).
