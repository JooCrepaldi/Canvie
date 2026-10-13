mod wallpaper;

use std::sync::{Mutex, PoisonError};

use serde::Serialize;
use tauri::{App, AppHandle, Emitter, Manager, State, WebviewWindow, WebviewWindowBuilder};

#[derive(Clone, Copy, Serialize)]
#[serde(rename_all = "lowercase")]
enum Placement {
  Wall,
}

#[derive(Clone, Copy, Serialize)]
struct PlacementSnapshot {
  placement: Placement,
  embedded: bool,
}

/// The single authority on where the window is. The frontend mirrors it
/// through get_placement and the canvie-placement event.
struct PlacementState(Mutex<PlacementSnapshot>);

impl PlacementState {
  fn snapshot(&self) -> PlacementSnapshot {
    *self.0.lock().unwrap_or_else(PoisonError::into_inner)
  }

  fn set(&self, snapshot: PlacementSnapshot) {
    *self.0.lock().unwrap_or_else(PoisonError::into_inner) = snapshot;
  }
}

#[tauri::command]
fn get_placement(state: State<'_, PlacementState>) -> PlacementSnapshot {
  state.snapshot()
}

fn publish(app: &AppHandle, snapshot: PlacementSnapshot) {
  app.state::<PlacementState>().set(snapshot);
  if let Err(error) = app.emit("canvie-placement", snapshot) {
    log::warn!("placement event failed: {error}");
  }
}

fn focus_main_window(app: &AppHandle) {
  if let Some(window) = app.get_webview_window("main") {
    if let Err(error) = window.show() {
      log::warn!("second instance show failed: {error}");
    }
    if let Err(error) = window.unminimize() {
      log::warn!("second instance unminimize failed: {error}");
    }
    if let Err(error) = window.set_focus() {
      log::warn!("second instance focus failed: {error}");
    }
  }
}

fn create_main_window(app: &App) -> tauri::Result<WebviewWindow> {
  let config = app
    .config()
    .app
    .windows
    .iter()
    .find(|window| window.label == "main")
    .ok_or(tauri::Error::WindowNotFound)?;
  let mut builder = WebviewWindowBuilder::from_config(app.handle(), config)?;
  // The canvas document lives in the WebView2 localStorage. Tauri's default
  // profile and its relative `dataDirectory` both resolve under
  // %LOCALAPPDATA%, so the profile is pinned to %APPDATA%/com.canvie.app here.
  match app.path().app_data_dir() {
    Ok(data_dir) => builder = builder.data_directory(data_dir),
    Err(error) => log::warn!("app data dir unavailable; using the default WebView2 profile: {error}"),
  }
  builder.build()
}

/// Wall: click-through, not topmost, and a child of Progman. Each tao call
/// below rewrites GWL_STYLE from tao's own flags and drops WS_CHILD, so the
/// Win32 embed always runs last.
fn place_on_wall(app: &AppHandle, window: &WebviewWindow) {
  if let Err(error) = window.set_always_on_top(false) {
    log::warn!("wall always-on-top reset failed: {error}");
  }
  if let Err(error) = window.set_ignore_cursor_events(true) {
    log::warn!("wall click-through failed: {error}");
  }
  if let Err(error) = window.show() {
    log::warn!("main window show failed: {error}");
  }
  let embedded = match window.hwnd() {
    Ok(hwnd) => match wallpaper::embed(hwnd) {
      Ok(()) => wallpaper::is_embedded(hwnd),
      Err(error) => {
        log::warn!("wall embed failed: {error}");
        false
      }
    },
    Err(error) => {
      log::warn!("wall embed skipped without a window handle: {error}");
      false
    }
  };
  if embedded {
    log::info!("placement -> wall (embedded in Progman)");
  } else {
    log::warn!("placement -> wall degraded to a transparent top-level window");
  }
  publish(app, PlacementSnapshot { placement: Placement::Wall, embedded });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(PlacementState(Mutex::new(PlacementSnapshot {
      placement: Placement::Wall,
      embedded: false,
    })))
    .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
      focus_main_window(app);
      log::info!("second instance blocked and existing window focused");
    }))
    .plugin(
      tauri_plugin_log::Builder::default()
        .level(log::LevelFilter::Info)
        .build(),
    )
    .setup(|app| {
      log::info!("Canvie startup");
      let window = create_main_window(app)?;
      place_on_wall(app.handle(), &window);
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![get_placement])
    .run(tauri::generate_context!())
    .expect("error while running Canvie");
}
