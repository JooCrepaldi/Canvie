//! v1: mode state machine, global shortcuts, tray, cursor passthrough.
//!
//! - `Ctrl+L` toggles Lock Mode (click-through, frozen canvas).
//! - `Ctrl+Alt+T` toggles Overlay Mode (always on top, foreground).
//! - `V`/`B`/`E` (frontend, when focused) pick cursor/brush/eraser; the
//!   cursor tool sets window click-through so the desktop stays usable.
//! - Canvas lives raised above the icon layer by default (Progman child,
//!   still below taskbar and normal windows); Overlay detaches to a normal
//!   top-level window.
//! - Frontend stays in sync via the `canvie-mode` / `canvie-tool` events and
//!   the `get_mode` / `toggle_lock` / `toggle_overlay` / `set_passthrough`
//!   commands.

mod wallpaper;

use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, WindowEvent};
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
  /// (default in Canvas Mode; reset on every mode change).
  raised: Mutex<bool>,
  /// Whether the cursor tool is active: Canvas clicks pass through to the
  /// desktop (default true, matching the frontend default tool).
  passthrough: Mutex<bool>,
}

impl Default for ModeState {
  fn default() -> Self {
    Self {
      current: Mutex::new(Mode::Canvas),
      return_to: Mutex::new(Mode::Canvas),
      embedded: Mutex::new(false),
      raised: Mutex::new(false),
      passthrough: Mutex::new(true),
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

  fn passthrough(app: &AppHandle) -> bool {
    app
      .try_state::<ModeState>()
      .and_then(|s| s.passthrough.lock().ok().map(|v| *v))
      .unwrap_or(true)
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
  let prev = ModeState::current(app);
  match mode {
    Mode::Canvas | Mode::Locked => {
      // Disable the Overlay blur BEFORE re-embedding: DWM blur-behind only
      // applies to top-level windows, so leaving Overlay must switch it
      // off while still detached.
      if prev == Mode::Overlay {
        if let Ok(hwnd) = window.hwnd() {
          if wallpaper::set_blur(hwnd, false) {
            log::info!("blur -> off");
          } else {
            log::warn!("blur disable failed");
          }
        }
      }
      window.set_always_on_top(false).map_err(|e| e.to_string())?;
      // Locked always passes clicks through; Canvas does when the cursor
      // tool is active. Overlay (below) is always interactive.
      let ignore = mode == Mode::Locked || (mode == Mode::Canvas && ModeState::passthrough(app));
      window
        .set_ignore_cursor_events(ignore)
        .map_err(|e| e.to_string())?;
      // Re-embed AFTER the tao calls above: they rewrite GWL_STYLE wholesale.
      ensure_embedded(app, &window);
      // v1: wallpaper modes rest raised above the icon layer; Locked frees
      // the desktop via click-through, so nothing ever disappears behind
      // the icons when leaving Overlay.
      ModeState::set_raised(app, true);
      if let Ok(hwnd) = window.hwnd() {
        wallpaper::raise(hwnd);
      }
    }
    Mode::Overlay => {
      if let Ok(hwnd) = window.hwnd() {
        wallpaper::detach(hwnd);
        if wallpaper::set_blur(hwnd, true) {
          log::info!("blur -> on");
        } else {
          log::warn!("blur enable failed");
        }
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

/// Raise the canvas above the icon layer (v1 resting order). Logs and
/// emits so the frontend and the log file observe the order.
fn raise_canvas(app: &AppHandle) -> Result<(), String> {
  let window = app
    .get_webview_window("main")
    .ok_or("main window not found")?;
  let hwnd = window.hwnd().map_err(|e| e.to_string())?;
  if !wallpaper::raise(hwnd) {
    return Err("layer change failed".to_string());
  }
  ModeState::set_raised(app, true);
  log::info!("canvie layer -> raised");
  app
    .emit(
      "canvie-mode",
      StatePayload {
        mode: ModeState::current(app).as_str(),
        raised: true,
      },
    )
    .map_err(|e| e.to_string())?;
  Ok(())
}

/// Apply the current click-through state to the window.
///
/// NOTE: tao rewrites the whole window style on `set_ignore_cursor_events`,
/// which drops our WS_CHILD. So this re-embeds AFTER that call and restores
/// the default-raised order in Canvas Mode — same rule as `apply_mode`.
fn apply_input(app: &AppHandle) -> Result<(), String> {
  let window = app
    .get_webview_window("main")
    .ok_or("main window not found")?;
  let mode = ModeState::current(app);
  let ignore = mode == Mode::Locked || (mode == Mode::Canvas && ModeState::passthrough(app));
  window
    .set_ignore_cursor_events(ignore)
    .map_err(|e| e.to_string())?;
  if mode == Mode::Canvas || mode == Mode::Locked {
    ensure_embedded(app, &window);
    if mode == Mode::Canvas && ModeState::raised(app) {
      if let Ok(hwnd) = window.hwnd() {
        wallpaper::raise(hwnd);
      }
    }
  }
  log::info!("passthrough -> {}", if ignore { "on" } else { "off" });
  Ok(())
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

#[derive(Clone, Copy, serde::Serialize)]
struct ToolPayload<'a> {
  tool: &'a str,
}

fn emit_tool(app: &AppHandle, tool: &'static str) {
  if let Err(e) = app.emit("canvie-tool", ToolPayload { tool }) {
    log::warn!("tool emit failed: {e}");
  } else {
    log::info!("tool -> {tool} (from tray)");
  }
}

#[tauri::command]
fn get_mode(app: AppHandle) -> StatePayload<'static> {
  StatePayload {
    mode: ModeState::current(&app).as_str(),
    raised: ModeState::raised(&app),
  }
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
fn set_passthrough(app: AppHandle, active: bool) -> Result<String, String> {
  if let Some(state) = app.try_state::<ModeState>() {
    if let Ok(mut flag) = state.passthrough.lock() {
      *flag = active;
    }
  }
  apply_input(&app)?;
  Ok(if active { "on".to_string() } else { "off".to_string() })
}

#[derive(Clone, Copy)]
enum HotkeyAction {
  Lock,
  Overlay,
}

impl HotkeyAction {
  fn run(self, app: &AppHandle) -> Result<String, String> {
    match self {
      Self::Lock => toggle_lock_inner(app),
      Self::Overlay => toggle_overlay_inner(app),
    }
  }

  fn label(self) -> &'static str {
    match self {
      Self::Lock => "lock",
      Self::Overlay => "overlay",
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
/// the tray "Show" entry, without stealing focus.
///
/// Canvas rests raised above the icon layer, where a bare `show()` after an
/// Explorer restart may leave it behind DefView. So re-embed (which orders
/// behind DefView), restore the raised order in Canvas Mode, ensure
/// visibility, and re-emit the current mode so the frontend repaints —
/// but never detach to overlay.
fn show_existing(app: &AppHandle) {
  let mode = ModeState::current(app);
  if let Some(window) = app.get_webview_window("main") {
    if mode == Mode::Overlay {
      if let Ok(hwnd) = window.hwnd() {
        if !wallpaper::set_blur(hwnd, true) {
          log::warn!("blur enable failed");
        }
      }
      let _ = window.show();
      let _ = window.set_focus();
    } else {
      ensure_embedded(app, &window);
      if let Ok(hwnd) = window.hwnd() {
        wallpaper::raise(hwnd);
        // Best-effort drift cleanup (authoritative blur state is set by
        // apply_mode, which switches it off while still top-level).
        let _ = wallpaper::set_blur(hwnd, false);
      }
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
      // v1: start with Windows, raised above the icon layer and ready to
      // draw. The cursor tool (default) keeps clicks passing through, so
      // the desktop stays usable until the brush is picked.
      match app.autolaunch().enable() {
        Ok(_) => log::info!("autostart enabled"),
        Err(e) => log::warn!("autostart NOT enabled: {e}"),
      }
      build_tray(app.handle())?;
      if let Some(window) = app.get_webview_window("main") {
        ensure_embedded(app.handle(), &window);
        if let Err(e) = raise_canvas(app.handle()) {
          log::warn!("default raise failed: {e}");
        }
        if let Err(e) = apply_input(app.handle()) {
          log::warn!("default input state failed: {e}");
        }
      }
      register_hotkey(app.handle(), "ctrl+l", HotkeyAction::Lock);
      // NOTE: Win+T (super+t) is reserved by Windows Explorer (taskbar focus)
      // and RegisterHotKey fails with "already registered". v1 uses
      // Ctrl+Alt+T until a product decision on the final shortcut.
      register_hotkey(app.handle(), "ctrl+alt+t", HotkeyAction::Overlay);
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
      "cursor" => emit_tool(app, "cursor"),
      "brush" => emit_tool(app, "brush"),
      "eraser" => emit_tool(app, "eraser"),
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
      set_passthrough
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

/// Tray icon with Show / tools / Lock / Overlay / Autostart / Quit.
fn build_tray(app: &AppHandle) -> Result<(), String> {
  use tauri::menu::{IsMenuItem, Menu, MenuItem};
  use tauri::tray::TrayIconBuilder;

  let autostart_label = match app.autolaunch().is_enabled() {
    Ok(true) => "Disable autostart",
    _ => "Enable autostart",
  };
  let entries = [
    ("show", "Show Canvie"),
    ("cursor", "Cursor (use desktop)"),
    ("brush", "Brush (draw)"),
    ("eraser", "Eraser"),
    ("lock", "Lock / unlock canvas"),
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
