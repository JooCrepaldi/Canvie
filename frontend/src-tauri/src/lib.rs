//! L4/L5 + wallpaper: mode state machine, global shortcuts, tray.
//!
//! - `Ctrl+L` toggles Lock Mode (click-through, frozen canvas).
//! - `Ctrl+Alt+T` toggles Overlay Mode (always on top, foreground).
//! - `Ctrl+D` raises/lowers the canvas inside Progman to draw on the wallpaper.
//! - Canvas/Lock live embedded in the desktop wallpaper layer (Progman child
//!   behind the icon layer, see `wallpaper`); Overlay detaches to a normal
//!   top-level window.
//! - Frontend stays in sync via the `canvie-mode` event and the
//!   `get_mode` / `toggle_lock` / `toggle_overlay` / `toggle_draw` commands.

mod wallpaper;

use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State, WindowEvent};
use tauri_plugin_autostart::ManagerExt;
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
  /// Whether the window is currently parented into the wallpaper WorkerW.
  embedded: Mutex<bool>,
  /// Whether the canvas is raised above the icon layer for drawing
  /// (only meaningful in Canvas Mode; reset on every mode change).
  raised: Mutex<bool>,
}

impl Default for ModeState {
  fn default() -> Self {
    Self {
      current: Mutex::new(Mode::Canvas),
      return_to: Mutex::new(Mode::Canvas),
      embedded: Mutex::new(false),
      raised: Mutex::new(false),
    }
  }
}

#[derive(Clone, Copy, serde::Serialize)]
struct StatePayload<'a> {
  mode: &'a str,
  raised: bool,
}

fn current_mode(app: &AppHandle) -> Mode {
  app
    .try_state::<ModeState>()
    .and_then(|s| s.current.lock().ok().map(|m| *m))
    .unwrap_or(Mode::Canvas)
}

fn is_raised(app: &AppHandle) -> bool {
  app
    .try_state::<ModeState>()
    .and_then(|s| s.raised.lock().ok().map(|v| *v))
    .unwrap_or(false)
}

fn set_raised_flag(app: &AppHandle, raised: bool) {
  if let Some(state) = app.try_state::<ModeState>() {
    if let Ok(mut flag) = state.raised.lock() {
      *flag = raised;
    }
  }
}

fn mark_embedded(app: &AppHandle, embedded: bool) {
  if let Some(state) = app.try_state::<ModeState>() {
    if let Ok(mut flag) = state.embedded.lock() {
      *flag = embedded;
    }
  }
}

/// Best-effort embed into the wallpaper layer. On failure the app keeps
/// working as a fullscreen overlay (pre-wallpaper behavior).
///
/// NOTE: tao rewrites the whole window style on `set_always_on_top` /
/// `set_ignore_cursor_events`, which drops our WS_CHILD. So this must run
/// AFTER those calls, on every Canvas/Locked transition.
fn ensure_embedded(app: &AppHandle, window: &tauri::WebviewWindow) {
  let was = app
    .try_state::<ModeState>()
    .and_then(|s| s.embedded.lock().ok().map(|v| *v))
    .unwrap_or(false);
  let ok = match window.hwnd() {
    Ok(hwnd) => wallpaper::embed(hwnd),
    Err(e) => {
      log::warn!("wallpaper embed skipped (no hwnd): {e}");
      return;
    }
  };
  mark_embedded(app, ok);
  if ok && !was {
    log::info!("wallpaper embedded behind desktop icons");
  } else if !ok {
    log::warn!("wallpaper embed failed, running as fullscreen overlay");
  }
}

fn apply_mode(app: &AppHandle, mode: Mode) -> Result<String, String> {
  let window = app
    .get_webview_window("main")
    .ok_or("main window not found")?;
  match mode {
    Mode::Canvas | Mode::Locked => {
      window.set_always_on_top(false).map_err(|e| e.to_string())?;
      window
        .set_ignore_cursor_events(mode == Mode::Locked)
        .map_err(|e| e.to_string())?;
      // Re-embed AFTER the tao calls above: they rewrite GWL_STYLE wholesale.
      ensure_embedded(app, &window);
      if mode == Mode::Locked {
        // A frozen canvas must never eat desktop clicks.
        set_raised_flag(app, false);
      } else if is_raised(app) {
        if let Ok(hwnd) = window.hwnd() {
          wallpaper::raise(hwnd);
        }
      }
    }
    Mode::Overlay => {
      if let Ok(hwnd) = window.hwnd() {
        wallpaper::detach(hwnd);
      }
      mark_embedded(app, false);
      set_raised_flag(app, false);
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
  log::info!(
    "canvie mode -> {} (raised={})",
    mode.as_str(),
    is_raised(app)
  );
  app
    .emit(
      "canvie-mode",
      StatePayload {
        mode: mode.as_str(),
        raised: is_raised(app),
      },
    )
    .map_err(|e| e.to_string())?;
  Ok(mode.as_str().to_string())
}

/// Raise/lower the canvas inside Progman so the user can draw on the
/// wallpaper itself (behind icons when lowered). No-op in Overlay Mode.
fn set_raised(app: &AppHandle, raised: bool) -> Result<(), String> {
  let window = app
    .get_webview_window("main")
    .ok_or("main window not found")?;
  let hwnd = window.hwnd().map_err(|e| e.to_string())?;
  let ok = if raised {
    wallpaper::raise(hwnd)
  } else {
    wallpaper::lower(hwnd)
  };
  if !ok {
    return Err("layer change failed".to_string());
  }
  set_raised_flag(app, raised);
  log::info!("canvie layer -> {}", if raised { "raised" } else { "lowered" });
  app
    .emit(
      "canvie-mode",
      StatePayload {
        mode: current_mode(app).as_str(),
        raised,
      },
    )
    .map_err(|e| e.to_string())?;
  Ok(())
}

fn toggle_draw_inner(app: &AppHandle) -> Result<String, String> {
  match current_mode(app) {
    Mode::Overlay => Ok(current_mode(app).as_str().to_string()),
    Mode::Locked => {
      // One press: unlock and raise, ready to draw.
      apply_mode(app, Mode::Canvas)?;
      set_raised(app, true)?;
      Ok(Mode::Canvas.as_str().to_string())
    }
    Mode::Canvas => {
      let next = !is_raised(app);
      set_raised(app, next)?;
      Ok(Mode::Canvas.as_str().to_string())
    }
  }
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

#[tauri::command]
fn toggle_draw(app: AppHandle) -> Result<String, String> {
  toggle_draw_inner(&app)
}

fn register_hotkey(app: &AppHandle, accelerator: &str, label: &str) {
  let action: fn(&AppHandle) -> Result<String, String> = match label {
    "lock" => toggle_lock_inner,
    "draw" => toggle_draw_inner,
    _ => toggle_overlay_inner,
  };
  let label_owned = label.to_string();
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
    .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
      if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
      }
      log::info!("second instance blocked, focused existing window");
    }))
    .plugin(tauri_plugin_autostart::init(
      tauri_plugin_autostart::MacosLauncher::LaunchAgent,
      None,
    ))
    .plugin(tauri_plugin_global_shortcut::Builder::new().build())
    .setup(|app| {
      // Logs go to stdout in dev and always to %LOCALAPPDATA%/com.canvie.app/logs
      // (release builds have no console, so the file is the only trace).
      let log_builder = tauri_plugin_log::Builder::default()
        .level(log::LevelFilter::Info)
        .target(tauri_plugin_log::Target::new(
          tauri_plugin_log::TargetKind::LogDir {
            file_name: Some("canvie".into()),
          },
        ));
      app.handle().plugin(log_builder.build())?;
      // L5: start with Windows (quiet second-plane behavior).
      match app.autolaunch().enable() {
        Ok(_) => log::info!("autostart enabled"),
        Err(e) => log::warn!("autostart NOT enabled: {e}"),
      }
      build_tray(app.handle())?;
      if let Some(window) = app.get_webview_window("main") {
        ensure_embedded(app.handle(), &window);
      }
      register_hotkey(app.handle(), "ctrl+l", "lock");
      // NOTE: Win+T (super+t) is reserved by Windows Explorer (taskbar focus)
      // and RegisterHotKey fails with "already registered". MVP-0 uses
      // Ctrl+Alt+T until a product decision on the final shortcut.
      register_hotkey(app.handle(), "ctrl+alt+t", "overlay");
      // Provisional draw-layer toggle: raise the canvas above the icon layer
      // to draw on the wallpaper itself, lower it back to use the desktop.
      register_hotkey(app.handle(), "ctrl+d", "draw");
      Ok(())
    })
    .on_menu_event(|app, event| match event.id.as_ref() {
      "show" => {
        if let Some(window) = app.get_webview_window("main") {
          let _ = window.show();
          let _ = window.set_focus();
        }
      }
      "lock" => {
        if let Err(e) = toggle_lock_inner(app) {
          log::warn!("tray lock failed: {e}");
        }
      }
      "overlay" => {
        if let Err(e) = toggle_overlay_inner(app) {
          log::warn!("tray overlay failed: {e}");
        }
      }
      "draw" => {
        if let Err(e) = toggle_draw_inner(app) {
          log::warn!("tray draw toggle failed: {e}");
        }
      }
      "autostart" => {
        let manager = app.autolaunch();
        let result = match manager.is_enabled() {
          Ok(true) => manager.disable(),
          _ => manager.enable(),
        };
        match result {
          Ok(_) => log::info!("autostart toggled"),
          Err(e) => log::warn!("autostart toggle failed: {e}"),
        }
      }
      "quit" => app.exit(0),
      _ => {}
    })
    .on_window_event(|window, event| {
      // L5: closing the window hides to tray instead of quitting.
      if let WindowEvent::CloseRequested { api, .. } = event {
        api.prevent_close();
        let _ = window.hide();
        log::info!("window close requested -> hidden to tray");
      }
    })
    .invoke_handler(tauri::generate_handler![
      get_mode,
      toggle_lock,
      toggle_overlay,
      toggle_draw
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

/// L5: tray icon with Show / Lock / Draw / Overlay / Autostart / Quit.
fn build_tray(app: &AppHandle) -> Result<(), String> {
  use tauri::menu::{Menu, MenuItem};
  use tauri::tray::TrayIconBuilder;

  let autostart_label = match app.autolaunch().is_enabled() {
    Ok(true) => "Disable autostart",
    _ => "Enable autostart",
  };
  let show = MenuItem::with_id(app, "show", "Show Canvie", true, None::<&str>)
    .map_err(|e| e.to_string())?;
  let lock = MenuItem::with_id(app, "lock", "Lock / unlock canvas", true, None::<&str>)
    .map_err(|e| e.to_string())?;
  let overlay = MenuItem::with_id(app, "overlay", "Overlay mode", true, None::<&str>)
    .map_err(|e| e.to_string())?;
  let draw = MenuItem::with_id(app, "draw", "Draw on wallpaper", true, None::<&str>)
    .map_err(|e| e.to_string())?;
  let autostart = MenuItem::with_id(app, "autostart", autostart_label, true, None::<&str>)
    .map_err(|e| e.to_string())?;
  let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)
    .map_err(|e| e.to_string())?;
  let menu = Menu::with_items(app, &[&show, &lock, &draw, &overlay, &autostart, &quit])
    .map_err(|e| e.to_string())?;

  let icon_bytes = include_bytes!("../icons/icon.png");
  let icon = tauri::image::Image::from_bytes(icon_bytes).map_err(|e| e.to_string())?;
  TrayIconBuilder::with_id("main")
    .tooltip("Canvie")
    .icon(icon)
    .menu(&menu)
    .show_menu_on_left_click(true)
    .build(app)
    .map_err(|e| e.to_string())?;
  log::info!("tray icon ready");
  Ok(())
}
