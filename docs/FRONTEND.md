# Canvie — Frontend (as built, MVP-0)

> Stack: Vite + React 19 + TypeScript strict + raw Canvas 2D. No canvas library, no CSS framework. UI strings pt-BR, code/comments English. Paths relative to `frontend/src/`.

## 1. Files

| File | Owns |
| --- | --- |
| `App.tsx:1-12` | Transparent shell div, renders `<Canvas />` only |
| `Canvas.tsx` | All drawing, camera, tools, undo/redo, text creation, mode mirror, Toolbar |
| `canvasTypes.ts` | `Point`, `Stroke{id,points,erase}`, `TextItem{id,at,content}`, `Camera{x,y,zoom}`, `Tool='cursor'\|'brush'\|'eraser'`, `PEN_WIDTH=3`, `ERASER_WIDTH=24`, id counter + `reseedIds` |
| `persistence.ts` | Doc model, validation, load/save/clear, debounced saver |
| `mode.ts` | Tauri bridge with fallbacks: `getMode` (`{mode, raised}`), `toggleLock/toggleOverlay`, `setPassthrough`, `onModeChanged/onToolChanged` |
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

## 4. Tools + toolbar (v1 inicial)

- Tools: cursor (`V`, default — never paints, clicks pass through to the desktop), brush (`B`), eraser (`E`). Single-letter shortcuts work when the Canvie window is focused; they can't be global (a bare `B` would steal typing system-wide). Tray entries and toolbar buttons cover the unfocused case.
- `Toolbar` (`Canvas.tsx`): floating dark bar above the taskbar with cursor/brush/eraser + lock/overlay buttons, active highlight, CSS-only shortcut tooltip above on hover. The bar eats clicks inside its own rect only (`App.css`); with click-through on (cursor/lock) it is visible but unreachable — switch back via tray or keys.
- Pointer down with cursor never starts a draft; pan (Space/middle-drag) still works wherever the window receives mouse.
- Undo/redo are `useRef` stacks (StrictMode-safe: updaters stay pure, nothing renders from stacks — `114-115`). Undo pops to redo + filters by id; redo re-appends. Stacks are memory-only.
- `Ctrl+Z` / `Ctrl+Shift+Z` / `Ctrl+Y` handled locally.

## 5. Persistence wiring

Boot: `loadDoc()` once via `useMemo`, state initialized from it (`90-93`). Every change calls `createSaver(500)` (`94-99`). Dev-only `window.__canvie.export/clear` (`101-113`). Validation/null-on-corrupt + `reseedIds(maxId)` live in `persistence.ts:31-62`. Storage key `canvie.canvas.v1`. No Rust file command in MVP-0.

## 6. Mode mirror (never invent mode)

Boot `getMode().then(setStateBoth)` + `onModeChanged(setStateBoth)` + `onToolChanged(setTool)`; `modeRef` mirror for hot-key handlers. `Escape` in overlay calls `toggleOverlay()`. Tool/mode changes call `setPassthrough(tool === 'cursor')` — the backend owns the OS flag (frontend must never call the Tauri window API for this: tao would drop `WS_CHILD` without re-embedding).

## 7. Transparency + fallback rules

`html/body/#root` transparent (`index.css:6-12`), shell transparent, no opaque backgrounds in Canvas/Locked (`App.css:1-19`). Overlay renders `.canvie-overlay-backdrop` first: fullscreen `rgba(8,8,10,0.38)` dim with a 160ms fade-in, `pointer-events: none`, behind strokes/texts/toolbar. The blur itself is the DWM blur-behind (`wallpaper::set_blur`) — CSS `backdrop-filter` cannot blur the OS desktop behind a transparent WebView. Every `mode.ts`/`persistence.ts` bridge degrades without Tauri (`inTauri` check, try/catch, null adapter) so `npm run dev` in a browser still draws.

## 8. How to add a tool (v1 pattern, not yet built)

Add to `Tool` union + width const in `canvasTypes.ts`, switch key in the `keydown` handler, paint branch in `draw()`, pill label. Keep drafts in refs. Do not add a canvas library before raw Canvas 2D proves insufficient (AGENTS.md §9).
