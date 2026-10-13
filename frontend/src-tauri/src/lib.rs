mod wallpaper;

use std::sync::{
  atomic::{AtomicBool, Ordering},
  Mutex, PoisonError,
};

use serde::Serialize;
use tauri::{
  menu::{Menu, MenuItem},
  tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
  App, AppHandle, Emitter, Manager, State, WebviewWindow, WebviewWindowBuilder,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

const PIN_REQUESTED_EVENT: &str = "canvie-pin-requested";

#[derive(Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
enum Placement {
  Wall,
  Edit,
}

#[derive(Clone, Copy, Serialize)]
struct PlacementSnapshot {
  placement: Placement,
  embedded: bool,
}

/// The single authority on where the window is. The frontend mirrors it
/// through get_placement and the canvie-placement event.
struct PlacementState {
  snapshot: Mutex<PlacementSnapshot>,
  // Commands, the shortcut and the tray all run on the main thread, and a
  // window move can pump messages; a flag instead of a held lock keeps a
  // nested request from deadlocking or interleaving two moves.
  moving: AtomicBool,
}

struct MoveGuard<'a>(&'a AtomicBool);

impl Drop for MoveGuard<'_> {
  fn drop(&mut self) {
    self.0.store(false, Ordering::SeqCst);
  }
}

impl PlacementState {
  fn snapshot(&self) -> PlacementSnapshot {
    *self.snapshot.lock().unwrap_or_else(PoisonError::into_inner)
  }

  fn set(&self, snapshot: PlacementSnapshot) {
    *self.snapshot.lock().unwrap_or_else(PoisonError::into_inner) = snapshot;
  }

  fn begin_move(&self) -> Result<MoveGuard<'_>, String> {
    if self.moving.swap(true, Ordering::SeqCst) {
      return Err("a placement change is already in progress".into());
    }
    Ok(MoveGuard(&self.moving))
  }
}

fn publish(app: &AppHandle, snapshot: PlacementSnapshot) {
  app.state::<PlacementState>().set(snapshot);
  if let Err(error) = app.emit("canvie-placement", snapshot) {
    log::warn!("placement event failed: {error}");
  }
}

fn main_window(app: &AppHandle) -> Result<WebviewWindow, String> {
  app.get_webview_window("main").ok_or_else(|| "main window is missing".to_string())
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
/// Win32 embed always runs last. Returns whether Progman is the parent.
fn apply_wall(window: &WebviewWindow) -> Result<bool, String> {
  if let Err(error) = window.set_always_on_top(false) {
    log::warn!("wall always-on-top reset failed: {error}");
  }
  if let Err(error) = window.set_ignore_cursor_events(true) {
    log::warn!("wall click-through failed: {error}");
  }
  if let Err(error) = window.show() {
    log::warn!("main window show failed: {error}");
  }
  let hwnd = window.hwnd().map_err(|error| format!("no window handle: {error}"))?;
  wallpaper::embed(hwnd)?;
  Ok(wallpaper::is_embedded(hwnd))
}

/// Edit: top-level, topmost, interactive and focused. The window leaves
/// Progman first so tao applies its flags to a top-level window, and the
/// Win32 position and foreground run after the tao calls.
fn apply_edit(window: &WebviewWindow) -> Result<(), String> {
  let hwnd = window.hwnd().map_err(|error| format!("no window handle: {error}"))?;
  wallpaper::detach(hwnd)?;
  if let Err(error) = window.set_ignore_cursor_events(false) {
    log::warn!("edit click-through reset failed: {error}");
  }
  if let Err(error) = window.set_always_on_top(true) {
    log::warn!("edit always-on-top failed: {error}");
  }
  wallpaper::bring_to_front(hwnd)?;
  if let Err(error) = window.set_focus() {
    log::warn!("edit focus failed: {error}");
  }
  Ok(())
}

fn place_on_wall_at_startup(app: &AppHandle, window: &WebviewWindow) {
  let embedded = apply_wall(window).unwrap_or_else(|error| {
    log::warn!("wall embed failed: {error}");
    false
  });
  if embedded {
    log::info!("placement -> wall (embedded in Progman)");
  } else {
    log::warn!("placement -> wall degraded to a transparent top-level window");
  }
  publish(app, PlacementSnapshot { placement: Placement::Wall, embedded });
}

fn enter_edit_now(app: &AppHandle) -> Result<PlacementSnapshot, String> {
  let state = app.state::<PlacementState>();
  let _move = state.begin_move()?;
  let window = main_window(app)?;
  // Already editing: only bring the window back in front.
  let already_editing = state.snapshot().placement == Placement::Edit;
  if let Err(error) = apply_edit(&window) {
    if !already_editing {
      // Put the window back on the desktop rather than leave it half moved.
      if let Err(restore) = apply_wall(&window) {
        log::warn!("wall restore after a failed edit failed: {restore}");
      }
    }
    return Err(error);
  }
  let snapshot = PlacementSnapshot { placement: Placement::Edit, embedded: false };
  if !already_editing {
    log::info!("placement -> edit");
  }
  publish(app, snapshot);
  Ok(snapshot)
}

fn pin_now(app: &AppHandle) -> Result<PlacementSnapshot, String> {
  let state = app.state::<PlacementState>();
  let _move = state.begin_move()?;
  let current = state.snapshot();
  if current.placement == Placement::Wall {
    return Ok(current);
  }
  let window = main_window(app)?;
  match apply_wall(&window) {
    Ok(true) => {
      let snapshot = PlacementSnapshot { placement: Placement::Wall, embedded: true };
      log::info!("placement -> wall (embedded in Progman)");
      publish(app, snapshot);
      Ok(snapshot)
    }
    outcome => {
      let reason = match outcome {
        Err(error) => error,
        Ok(_) => "the window is not a child of Progman after the embed".to_string(),
      };
      // Without the embed, Wall would leave a click-through window with no
      // way back, so the window stays in Edit.
      if let Err(error) = apply_edit(&window) {
        log::warn!("edit restore after a failed pin failed: {error}");
      }
      Err(reason)
    }
  }
}

/// The shortcut and the tray: Wall goes to Edit; Edit asks the frontend to
/// save and pin, because only the frontend knows the unsaved revision.
fn toggle(app: &AppHandle, source: &str) {
  match app.state::<PlacementState>().snapshot().placement {
    Placement::Wall => {
      if let Err(error) = enter_edit_now(app) {
        log::warn!("{source}: enter_edit failed: {error}");
      }
    }
    Placement::Edit => request_pin(app, source),
  }
}

fn request_pin(app: &AppHandle, source: &str) {
  log::info!("{source}: pin requested");
  if let Err(error) = app.emit(PIN_REQUESTED_EVENT, ()) {
    log::warn!("{source}: pin request event failed: {error}");
  }
}

#[tauri::command]
fn get_placement(state: State<'_, PlacementState>) -> PlacementSnapshot {
  state.snapshot()
}

#[tauri::command]
fn enter_edit(app: AppHandle) -> Result<PlacementSnapshot, String> {
  enter_edit_now(&app).inspect_err(|error| log::warn!("enter_edit failed: {error}"))
}

/// Called by the frontend after saveNow succeeds. It never touches the document.
#[tauri::command]
fn pin_to_wall(app: AppHandle) -> Result<PlacementSnapshot, String> {
  pin_now(&app).inspect_err(|error| log::warn!("pin_to_wall failed; staying in Edit: {error}"))
}

fn edit_shortcut() -> Shortcut {
  Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyT)
}

fn build_tray(app: &App) -> tauri::Result<()> {
  let edit = MenuItem::with_id(app, "edit", "Editar", true, None::<&str>)?;
  let pin = MenuItem::with_id(app, "pin", "Fixar no desktop", true, None::<&str>)?;
  let quit = MenuItem::with_id(app, "quit", "Sair", true, None::<&str>)?;
  let menu = Menu::with_items(app, &[&edit, &pin, &quit])?;
  let mut tray = TrayIconBuilder::with_id("main")
    .tooltip("Canvie")
    .menu(&menu)
    .show_menu_on_left_click(false)
    .on_menu_event(|app, event| match event.id().as_ref() {
      "edit" => {
        if let Err(error) = enter_edit_now(app) {
          log::warn!("tray: enter_edit failed: {error}");
        }
      }
      "pin" if app.state::<PlacementState>().snapshot().placement == Placement::Edit => request_pin(app, "tray"),
      "quit" => {
        log::info!("tray: quit");
        app.exit(0);
      }
      _ => {}
    })
    .on_tray_icon_event(|tray, event| {
      if let TrayIconEvent::Click {
        button: MouseButton::Left,
        button_state: MouseButtonState::Up,
        ..
      } = event
      {
        toggle(tray.app_handle(), "tray");
      }
    });
  if let Some(icon) = app.default_window_icon() {
    tray = tray.icon(icon.clone());
  }
  tray.build(app)?;
  Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(PlacementState {
      snapshot: Mutex::new(PlacementSnapshot {
        placement: Placement::Wall,
        embedded: false,
      }),
      moving: AtomicBool::new(false),
    })
    .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
      log::info!("second instance blocked; bringing the canvas to Edit");
      if let Err(error) = enter_edit_now(app) {
        log::warn!("second instance: enter_edit failed: {error}");
      }
    }))
    .plugin(
      tauri_plugin_log::Builder::default()
        .level(log::LevelFilter::Info)
        .build(),
    )
    .plugin(
      tauri_plugin_global_shortcut::Builder::new()
        .with_handler(|app, shortcut, event| {
          if event.state() == ShortcutState::Pressed && shortcut == &edit_shortcut() {
            toggle(app, "shortcut");
          }
        })
        .build(),
    )
    .setup(|app| {
      log::info!("Canvie startup");
      let window = create_main_window(app)?;
      place_on_wall_at_startup(app.handle(), &window);
      if let Err(error) = build_tray(app) {
        log::warn!("tray unavailable: {error}");
      }
      match app.global_shortcut().register(edit_shortcut()) {
        Ok(()) => log::info!("shortcut registered: Ctrl+Alt+T"),
        Err(error) => log::warn!("shortcut Ctrl+Alt+T unavailable; Editar stays in the tray: {error}"),
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![get_placement, enter_edit, pin_to_wall])
    .run(tauri::generate_context!())
    .expect("error while running Canvie");
}
