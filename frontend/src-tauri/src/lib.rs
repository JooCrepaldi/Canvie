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

impl ModeState {
  fn current(app: &AppHandle) -> Mode {
    app
      .try_state::<ModeState>()
      .and_then(|s| s.current.lock().ok().map(|m| *m))
      .unwrap_or(Mode::Canvas)
  }

  fn raised(app: &AppHandle) -> bool {
    app
      .try_state::<ModeState>()
      .and_then(|s| s.raised.lock().ok().map(|v| *v))
      .unwrap_or(false)
  }

  fn set_raised(app: &AppHandle, raised: bool) {
    if let Some(state) = app.try_state::<ModeState>() {
      if let Ok(mut flag) = state.raised.lock() {
        *flag = raised;
      }
    }
  }

  fn set_embedded(app: &AppHandle, embedded: bool) {
    if let Some(state) = app.try_state::<ModeState>() {
      if let Ok(mut flag) = state.embedded.lock() {
        *flag = embedded;
      }
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
  ModeState::set_embedded(app, ok);
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
        ModeState::set_raised(app, false);
      } else if ModeState::raised(app) {
        if let Ok(hwnd) = window.hwnd() {
          wallpaper::raise(hwnd);
        }
      }
    }
    Mode::Overlay => {
      if let Ok(hwnd) = window.hwnd() {
        wallpaper::detach(hwnd);
      }
      ModeState::set_embedded(app, false);
      ModeState::set_raised(app, false);
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
    ModeState::raised(app)
  );
  app
    .emit(
      "canvie-mode",
      StatePayload {
        mode: mode.as_str(),
        raised: ModeState::raised(app),
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
  ModeState::set_raised(app, raised);
  log::info!("canvie layer -> {}", if raised { "raised" } else { "lowered" });
  app
    .emit(
      "canvie-mode",
      StatePayload {
        mode: ModeState::current(app).as_str(),
        raised,
      },
    )
    .map_err(|e| e.to_string())?;
  Ok(())
}

fn toggle_draw_inner(app: &AppHandle) -> Result<String, String> {
  match ModeState::current(app) {
    Mode::Overlay => Ok(ModeState::current(app).as_str().to_string()),
    Mode::Locked => {
      // One press: unlock and raise, ready to draw.
      apply_mode(app, Mode::Canvas)?;
      set_raised(app, true)?;
      Ok(Mode::Canvas.as_str().to_string())
    }
    Mode::Canvas => {
      let next = !ModeState::raised(app);
      set_raised(app, next)?;
      Ok(Mode::Canvas.as_str().to_string())
    }
  }
}

fn toggle_lock_inner(app: &AppHandle) -> Result<String, String> {
  let current = ModeState::current(app);
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

#[derive(Clone, Copy)]
enum HotkeyAction {
  Lock,
  Overlay,
  Draw,
}

impl HotkeyAction {
  fn run(self, app: &AppHandle) -> Result<String, String> {
    match self {
      Self::Lock => toggle_lock_inner(app),
      Self::Overlay => toggle_overlay_inner(app),
      Self::Draw => toggle_draw_inner(app),
    }
  }

  fn label(self) -> &'static str {
    match self {
      Self::Lock => "lock",
      Self::Overlay => "overlay",
      Self::Draw => "draw",
    }
  }
}

fn register_hotkey(app: &AppHandle, accelerator: &str, action: HotkeyAction) {
  let label = action.label();
  match app.global_shortcut().on_shortcut(accelerator, move |h, _shortcut, event| {
    if event.state == ShortcutState::Pressed {
      if let Err(e) = action.run(h) {
        log::warn!("hotkey {label} handler failed: {e}");
      }
    }
  }) {
    Ok(_) => log::info!("hotkey registered: {accelerator} ({label})"),
    Err(e) => log::warn!("hotkey {accelerator} ({label}) NOT registered: {e}"),
  }
}

/// Re-show the existing window after a manual launch (second instance) or
/// the tray "Show" entry, without stealing desktop input.
///
/// Canvas/Locked live as a Progman child behind the icon layer, where
/// `show() + set_focus()` alone is a visible no-op: the window stays behind
/// DefView hit-testing. So re-embed (Explorer may have restarted), ensure
/// visibility, and re-emit the current mode so the frontend repaints — but
/// never raise above the icons and never detach to overlay. A click on the
/// app shortcut therefore always produces feedback while staying quiet.
fn show_existing(app: &AppHandle) {
  let mode = ModeState::current(app);
  if let Some(window) = app.get_webview_window("main") {
    if mode == Mode::Overlay {
      let _ = window.show();
      let _ = window.set_focus();
    } else {
      ensure_embedded(app, &window);
      let _ = window.show();
      if let Err(e) = app.emit(
        "canvie-mode",
        StatePayload {
          mode: mode.as_str(),
          raised: ModeState::raised(app),
        },
      ) {
        log::warn!("show_existing emit failed: {e}");
      }
    }
  }
  log::info!(
    "show requested -> {} (raised={})",
    mode.as_str(),
    ModeState::raised(app)
  );
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(ModeState::default())
    .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
      show_existing(app);
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
      register_hotkey(app.handle(), "ctrl+l", HotkeyAction::Lock);
      // NOTE: Win+T (super+t) is reserved by Windows Explorer (taskbar focus)
      // and RegisterHotKey fails with "already registered". MVP-0 uses
      // Ctrl+Alt+T until a product decision on the final shortcut.
      register_hotkey(app.handle(), "ctrl+alt+t", HotkeyAction::Overlay);
      // Provisional draw-layer toggle: raise the canvas above the icon layer
      // to draw on the wallpaper itself, lower it back to use the desktop.
      register_hotkey(app.handle(), "ctrl+d", HotkeyAction::Draw);
      Ok(())
    })
    .on_menu_event(|app, event| match event.id.as_ref() {
      "show" => {
        show_existing(app);
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
  use tauri::menu::{IsMenuItem, Menu, MenuItem};
  use tauri::tray::TrayIconBuilder;

  let autostart_label = match app.autolaunch().is_enabled() {
    Ok(true) => "Disable autostart",
    _ => "Enable autostart",
  };
  let entries = [
    ("show", "Show Canvie"),
    ("lock", "Lock / unlock canvas"),
    ("draw", "Draw on wallpaper"),
    ("overlay", "Overlay mode"),
    ("autostart", autostart_label),
    ("quit", "Quit"),
  ];
  let items: Vec<MenuItem<tauri::Wry>> = entries
    .into_iter()
    .map(|(id, text)| MenuItem::with_id(app, id, text, true, None::<&str>))
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;
  let refs: Vec<&dyn IsMenuItem<tauri::Wry>> = items.iter().map(|item| item as _).collect();
  let menu = Menu::with_items(app, &refs).map_err(|e| e.to_string())?;

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
