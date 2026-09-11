# Canvie — Backend (as built, MVP-0)

> Rust/Tauri shell: windowing, modes, tray, autostart, single-instance, shortcuts, Win32 layering. No domain logic beyond `ModeState`. Paths relative to `frontend/src-tauri/`.

## 1. Files

| File | Owns |
| --- | --- |
| `src/main.rs` | Release `windows_subsystem` guard + `canvie_lib::run()` |
| `src/lib.rs` | `ModeState`, `apply_mode`, `toggle_*`, commands, hotkeys, tray, close→hide, plugins setup |
| `src/wallpaper.rs` | Progman parenting: `embed` / `raise` / `lower` / `detach` |
| `build.rs` | `AppManifest::commands(["get_mode","toggle_lock","toggle_overlay","toggle_draw"])` — ACL guardrail |
| `capabilities/default.json` | `allow-get-mode`, `allow-toggle-lock`, `allow-toggle-overlay`, `allow-toggle-draw` on window `main` |
| `tauri.conf.json` | `main` window: fullscreen, transparent, undecorated, `skipTaskbar`; bundle icons |
| `Cargo.toml` | tauri 2 + plugins (autostart, global-shortcut, log, single-instance) + `windows` crate limited to `Win32_Foundation` + `Win32_UI_WindowsAndMessaging` |

## 2. State machine

`ModeState { current, return_to, embedded, raised }` (`src/lib.rs:36-56`, `Default` Canvas/false/false). Helpers `current/raised/set_raised/set_embedded` use `try_state` + `Mutex`, defaulting safely (`64-94`).

- `apply_mode` (`122-176`): Canvas/Locked → clear topmost, click-through iff Locked, **re-embed AFTER tao**, re-raise if flag; Locked zeroes raised; Overlay → detach, clear raised/embedded, clear click-through, topmost + unminimize/show/focus. Persists `current`, logs `canvie mode -> {}`, emits `canvie-mode`.
- `set_raised` (`180-205`): Win32 raise/lower, error `"layer change failed"`, logs `canvie layer ->`, emits.
- Toggles: lock Canvas↔Locked (Overlay no-op) `224-238`; overlay with `return_to` `240-259`; draw Overlay no-op / Locked→Canvas+raise / Canvas flip `207-222`.
- Commands are thin wrappers (`261-283`): `get_mode`, `toggle_lock`, `toggle_overlay`, `toggle_draw`.

## 3. Win32 layering (`wallpaper.rs`)

- Find `Progman` by class via `EnumWindows` (`50-54`); icon layer via `FindWindowExW(Progman, SHELLDLL_DefView)` (`56-58`).
- `embed` (`92-117`): set `WS_CHILD`, `SetParent(Progman)`, `SetWindowPos(defview, fullscreen-primary, SHOWWINDOW|FRAMECHANGED)`. False → caller keeps fullscreen-overlay fallback.
- `raise` (`121-134`): `SetWindowPos(HWND_TOP, NOMOVE|NOSIZE|NOACTIVATE|SHOWWINDOW)`.
- `lower` (`137-156`): re-order behind `defview`.
- `detach` (`159-167`): clear `WS_CHILD` → `WS_POPUP`, `SetParent(None)`, fullscreen primary.
- `ensure_embedded` (`lib.rs:102-120`) wraps `embed` best-effort with warn logs; runs on setup + every Canvas/Locked transition, always after tao calls.

## 4. Shortcuts, tray, lifecycle (`lib.rs:304-439`)

- `register_hotkey` (`285-302`): `ctrl+l`→lock, `ctrl+alt+t`→overlay, `ctrl+d`→draw; registration failure logs warn and keeps running degraded — never crash/block startup.
- Setup (`320-349`): file+stdout logs (`canvie` in `%LOCALAPPDATA%/com.canvie.app/logs`), `autolaunch().enable()`, `build_tray`, `ensure_embedded`, hotkeys.
- Tray (`405-439`): Show / Lock / Draw / Overlay / Autostart(toggle label) / Quit; `show_menu_on_left_click(true)`.
- Menu events: show → `show_existing` (re-embed + show + re-emit current mode, never raise/detach), lock/draw/overlay toggles with warn on failure, autostart toggle by current state, quit.
- `CloseRequested` → `prevent_close` + `hide`: X goes to tray.
- Plugins: `single_instance` runs `show_existing` on second launch (existing window re-embedded as wallpaper and re-shown, staying behind icons); `autostart` LaunchAgent/none; `global-shortcut` + `log`.

## 5. How to add a command (L4 pattern — mandatory)

1. `#[tauri::command] fn …` in `lib.rs` + `generate_handler!` entry.
2. `AppManifest::commands` entry in `build.rs`.
3. `allow-*` permission (+ TOML if generated) in `capabilities/default.json`.
4. Frontend wrapper in `frontend/src/mode.ts` with try/catch fallback.
Missing step 2/3 fails the build — that failure is the guardrail working.

## 6. Constraints

- `windows`-crate surface stays at `Win32_Foundation` + `Win32_UI_WindowsAndMessaging` (`Cargo.toml:29`); new Win32 surface needs a comment explaining why.
- Log transitions (`mode ->`, `layer ->`, `hotkey registered`) — in release the log file is the only trace.
- Never: second instance, Run key to dev binary, elevated execution, writes outside `%APPDATA%/com.canvie.app` + Run key, Explorer patching beyond `SetParent`.
