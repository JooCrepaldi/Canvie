# Canvie — Architecture (MVP-0 as built)

> Single source for how the system fits together. Product behavior lives in `docs/PRD.md`; process in `AGENTS.md`; build order in `docs/MVP-0-ROADMAP.md`. This doc explains the runtime, the one state machine, and why the Win32 layer looks the way it does. File references are `path:line`.

## 1. Runtime overview

- One Tauri 2 process (`frontend/src-tauri/src/main.rs:4-6` → `canvie_lib::run()`).
- One fullscreen transparent WebviewWindow `main` (`tauri.conf.json:13-22`: `fullscreen`, `transparent`, `decorations: false`, `skipTaskbar`).
- React 19 + Vite frontend renders one `<canvas>` plus absolutely-positioned text divs (`frontend/src/Canvas.tsx:390-412`).
- Rust backend owns windowing, modes, tray, autostart, single-instance, global shortcuts, Win32 layering. No domain logic in Rust besides the mode state machine.

```
              +---------------- Tauri process ----------------+
              |  lib.rs: ModeState + commands + tray + hotkeys |
              |  wallpaper.rs: Progman parenting (Win32 only)  |
              +------+---------------------------^------------+
                     | canvie-mode event         | invoke
                     v                           |
              +------+---------------------------+------------+
              |  mode.ts (bridge)  persistence.ts (doc model)  |
              |  Canvas.tsx (draw)  canvasTypes.ts (ids)       |
              |  transparent shell (index.css, App.css)        |
              +-----------------------------------------------+
```

## 2. Window layering (the core trick)

Three placements, one window:

| Placement | When | Parent / order | Input |
| --- | --- | --- | --- |
| Raised wallpaper (default) | Canvas resting, boot included | Child of Progman, ordered `HWND_TOP` within Progman (`wallpaper.rs:121-134`) — still below taskbar and normal windows | Brush/eraser draw; cursor tool passes clicks through to the desktop |
| Lowered wallpaper | Locked resting | Child of Progman, ordered right behind `SHELLDLL_DefView` | None (click-through + DefView eats hit-testing) |
| Overlay | Overlay mode | Detached top-level, `alwaysOnTop(true)` + focus (`lib.rs:apply_mode`) | Yes, above everything |

Primary monitor only. If Explorer restarts, embedding is lost until the next show/mode change re-embeds and re-raises (`show_existing`, `apply_mode`).

## 3. The one state machine

`ModeState` (`lib.rs`): `current: Canvas|Locked|Overlay`, `return_to` (where Overlay returns), `embedded: bool`, `raised: bool` (true by default in Canvas after setup; reset on mode change), `passthrough: bool` (cursor tool active, default true).

Transitions (all in `lib.rs`):

- `toggle_lock_inner`: Canvas↔Locked; no-op in Overlay.
- `toggle_overlay_inner`: stores `return_to`, enters Overlay; toggling off applies `return_to`.
- `apply_mode`: Canvas/Locked clears topmost, sets click-through (`Locked || (Canvas && passthrough)`), re-embeds AFTER tao calls, re-raises if flag set; Overlay detaches, clears raised, forces interactive, sets topmost + show + focus. Emits `canvie-mode {mode, raised}`.
- `set_raised`: Win32 raise/lower + emit.
- `set_passthrough(active)` command: stores the flag, then `apply_input` (ignore + re-embed + re-raise in Canvas). Never call the Tauri JS window API for this from the frontend: it would drop `WS_CHILD` without re-embedding.
- `show_existing` (second launch + tray Show): Overlay→show+focus; else re-embed, restore raised order in Canvas, show, re-emit mode.
- Tray tool entries (cursor/brush/eraser) only emit `canvie-tool {tool}`; the frontend owns tool state and calls `set_passthrough` on change.

Frontend never invents mode: `getMode()` (now `{mode, raised}`) on boot + `onModeChanged` subscription (`mode.ts`, consumed in `Canvas.tsx`).

## 4. Frontend/backend bridge

Commands (`build.rs` + `capabilities/default.json` + `invoke_handler` in `lib.rs`): `get_mode` (returns `{mode, raised}`), `toggle_lock`, `toggle_overlay`, `set_passthrough`. Every `mode.ts` wrapper has try/catch fallback to a working canvas when Tauri APIs are absent (browser dev). Same for storage (`persistence.ts:19-28` returns null adapter → in-memory only).

## 5. Ownership map (do not duplicate)

| Area | Owner | Files |
| --- | --- | --- |
| Win32 layering | `wallpaper.rs` | embed / raise / lower / detach, Progman + DefView lookup |
| Modes + tray + hotkeys | `lib.rs` | `ModeState`, `apply_mode`, `build_tray`, `register_hotkey`, close→hide |
| Drawing + camera + tools | `Canvas.tsx` | DPR render, `screenToWorld`/`worldToScreen`, drafts in refs, undo/redo stacks, Toolbar with hover tooltips |
| Doc model + validation | `persistence.ts` + `canvasTypes.ts` | `CanvasDoc v1`, `STORAGE_KEY=canvie.canvas.v1`, `parseDoc`, `createSaver(500)`, `reseedIds`, `Tool='cursor'\|'brush'\|'eraser'` |
| Mode bridge | `mode.ts` | `inTauri`, `getMode`, `toggleLock/toggleOverlay`, `setPassthrough`, `onModeChanged/onToolChanged` |
| Transparency | `index.css`, `App.css`, `tauri.conf.json` | `transparent: true`, no opaque backgrounds in Canvas/Locked except the toolbar itself (clicks only in its own rect); Overlay adds a fullscreen blur+dim backdrop behind canvas content |

## 6. Data model

`CanvasDoc { version: 1, strokes: Stroke[{id, points[{x,y}], erase}], texts: TextItem[{id, at, content}], camera: {x,y,zoom} }`. `parseDoc` returns null on corrupt input (boot empty, never crash). Id counter reseeded past max restored id. Saves debounced 500ms. Undo/redo stacks are in-memory only (refs in `Canvas.tsx:116-117`), not persisted.

## 7. Hard-won decisions (ADRs, condensed)

- **Progman, not WorkerW.** This Win11 shell has no spare fullscreen WorkerW; Progman hosts `SHELLDLL_DefView` directly. Canvas is a Progman child behind the icon layer (`wallpaper.rs:1-11`).
- **Embed AFTER tao.** `tao` rewrites `GWL_STYLE` on `set_always_on_top` / `set_ignore_cursor_events`, dropping `WS_CHILD`. Every Canvas/Locked transition re-embeds after those calls (`lib.rs:99-101`, `132`). No exceptions.
- **Behind means no input.** DefView consumes all hit-testing behind the icon layer. That is why Canvas rests raised; the cursor frees the desktop via click-through instead of layer order. Not a bug.
- **`Win+T` belongs to Explorer.** `RegisterHotKey` fails "already registered". v1 uses `Ctrl+Alt+T` (`lib.rs`) until a product decision changes it — which must update PRD + README + code together.
- **Bare letters can't be global shortcuts.** `V`/`B`/`E` work when the Canvie window is focused; with click-through on, the way back to the brush is the toolbar, the tray menu, or the app shortcut. A global bare `B` would steal typing system-wide.
- **Persistence via localStorage is enough for MVP-0.** No dedicated Rust file command; WebView2 profile in `%APPDATA%/com.canvie.app` holds `canvie.canvas.v1`. Never loses data by crashing on corrupt JSON.
- **Transparency is total or broken.** One opaque layer (`html/body/#root`, window config, shell CSS) kills the wallpaper illusion.
- **Single instance + close→tray + autostart-to-installed.** Second instance focuses the first; X hides; Run key must point at `%LOCALAPPDATA%\Canvie\canvie.exe`, never a dev binary.
- **Build dir outside OneDrive.** `src-tauri/.cargo/config.toml` sets `target-dir` to `%LOCALAPPDATA%\canvie-target`; file sync corrupts concurrent builds.

## 8. Invariants pointer

The enforceable version lives in `AGENTS.md §10`. Any change breaking embed-after-tao, Progman parenting, input physics, shortcut degradation, persistence-never-crashes, total transparency, or Tauri-absent fallback is a merge blocker.
