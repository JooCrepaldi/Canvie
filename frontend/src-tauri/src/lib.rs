//! L4: mode state machine (canvas / locked / overlay) + global shortcuts.
//!
//! - `Ctrl+L` toggles Lock Mode (click-through, frozen canvas).
//! - `Win+T` (`super+t`) toggles Overlay Mode (always on top, foreground).
//! - Frontend stays in sync via the `canvie-mode` event and the
//!   `get_mode` / `toggle_lock` / `toggle_overlay` commands.

use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

#[derive(Clone, Copy, PartialEq, Eq)]
enum Mode {
  Canvas,
  Locked,
  Overlay,
}

impl Mode {
  fn as_str(self) -> &'static str {
    match self {
      Mode::Canvas => "canvas",
      Mode::Locked => "locked",
      Mode::Overlay => "overlay",
    }
  }
}

struct ModeState {
  current: Mutex<Mode>,
  /// Where Overlay Mode returns to when toggled off.
  return_to: Mutex<Mode>,
}

impl Default for ModeState {
  fn default() -> Self {
    Self {
      current: Mutex::new(Mode::Canvas),
      return_to: Mutex::new(Mode::Canvas),
    }
  }
}

fn apply_mode(app: &AppHandle, mode: Mode) -> Result<String, String> {
  let window = app
    .get_webview_window("main")
    .ok_or("main window not found")?;
  match mode {
    Mode::Canvas => {
      window.set_always_on_top(false).map_err(|e| e.to_string())?;
      window
        .set_ignore_cursor_events(false)
        .map_err(|e| e.to_string())?;
    }
    Mode::Locked => {
      window.set_always_on_top(false).map_err(|e| e.to_string())?;
      window
        .set_ignore_cursor_events(true)
        .map_err(|e| e.to_string())?;
    }
    Mode::Overlay => {
      window
        .set_ignore_cursor_events(false)
        .map_err(|e| e.to_string())?;
      window.set_always_on_top(true).map_err(|e| e.to_string())?;
      let _ = window.unminimize();
      let _ = window.show();
      let _ = window.set_focus();
    }
  }
  if let Some(state) = app.try_state::<ModeState>() {
    *state.current.lock().map_err(|e| e.to_string())? = mode;
  }
  log::info!("canvie mode -> {}", mode.as_str());
  app
    .emit("canvie-mode", mode.as_str())
    .map_err(|e| e.to_string())?;
  Ok(mode.as_str().to_string())
}

fn toggle_lock_inner(app: &AppHandle) -> Result<String, String> {
  let current = app
    .try_state::<ModeState>()
    .and_then(|s| s.current.lock().ok().map(|m| *m))
    .unwrap_or(Mode::Canvas);
  let next = match current {
    Mode::Canvas => Mode::Locked,
    Mode::Locked => Mode::Canvas,
    Mode::Overlay => Mode::Overlay, // lock toggle is a no-op while overlaying
  };
  if next == current {
    return Ok(current.as_str().to_string());
  }
  apply_mode(app, next)
}

fn toggle_overlay_inner(app: &AppHandle) -> Result<String, String> {
  let (current, return_to) = app
    .try_state::<ModeState>()
    .and_then(|s| {
      let c = s.current.lock().ok().map(|m| *m)?;
      let r = s.return_to.lock().ok().map(|m| *m)?;
      Some((c, r))
    })
    .unwrap_or((Mode::Canvas, Mode::Canvas));
  if current == Mode::Overlay {
    apply_mode(app, return_to)
  } else {
    if let Some(state) = app.try_state::<ModeState>() {
      if let Ok(mut r) = state.return_to.lock() {
        *r = current;
      }
    }
    apply_mode(app, Mode::Overlay)
  }
}

#[tauri::command]
fn get_mode(state: State<ModeState>) -> String {
  state
    .current
    .lock()
    .map(|m| m.as_str().to_string())
    .unwrap_or_else(|_| "canvas".to_string())
}

#[tauri::command]
fn toggle_lock(app: AppHandle) -> Result<String, String> {
  toggle_lock_inner(&app)
}

#[tauri::command]
fn toggle_overlay(app: AppHandle) -> Result<String, String> {
  toggle_overlay_inner(&app)
}

fn register_hotkey(app: &AppHandle, accelerator: &str, label: &str) {
  let is_lock = label == "lock";
  let label_owned = label.to_string();
  let action: fn(&AppHandle) -> Result<String, String> = if is_lock {
    toggle_lock_inner
  } else {
    toggle_overlay_inner
  };
  match app.global_shortcut().on_shortcut(accelerator, move |h, _shortcut, event| {
    if event.state == ShortcutState::Pressed {
      if let Err(e) = action(h) {
        log::warn!("hotkey {label_owned} handler failed: {e}");
      }
    }
  }) {
    Ok(_) => log::info!("hotkey registered: {accelerator} ({label})"),
    Err(e) => log::warn!("hotkey {accelerator} ({label}) NOT registered: {e}"),
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(ModeState::default())
    .plugin(tauri_plugin_global_shortcut::Builder::new().build())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      register_hotkey(app.handle(), "ctrl+l", "lock");
      // NOTE: Win+T (super+t) is reserved by Windows Explorer (taskbar focus)
      // and RegisterHotKey fails with "already registered". MVP-0 uses
      // Ctrl+Alt+T until a product decision on the final shortcut.
      register_hotkey(app.handle(), "ctrl+alt+t", "overlay");
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![get_mode, toggle_lock, toggle_overlay])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
