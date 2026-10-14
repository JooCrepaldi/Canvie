mod wallpaper;

use std::{
  sync::{
    atomic::{AtomicBool, Ordering},
    mpsc, Mutex, PoisonError,
  },
  thread,
  time::Duration,
};

use serde::{Deserialize, Serialize};
use tauri::{
  menu::{Menu, MenuItem},
  tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
  App, AppHandle, CloseRequestApi, Emitter, Manager, RunEvent, State, WebviewWindow, WebviewWindowBuilder, WindowEvent,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use wallpaper::Desktop;

const PIN_REQUESTED_EVENT: &str = "canvie-pin-requested";
const CLOSE_REQUESTED_EVENT: &str = "canvie-close-requested";
const DESKTOP_CHECK_INTERVAL: Duration = Duration::from_secs(1);
// Checks without the icon layer before the watchdog embeds in Progman anyway.
const ICON_LAYER_PATIENCE: u32 = 10;
// Upper bound, in checks, between attempts after repeated embed failures.
const MAX_RETRY_CHECKS: u32 = 300;

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

  fn is_moving(&self) -> bool {
    self.moving.load(Ordering::SeqCst)
  }
}

/// Set once the app is meant to end: Sair in the tray, or a close request in
/// Wall. Until then, losing the window means Explorer took it down with
/// Progman, and the app keeps running to rebuild it.
struct Lifecycle {
  quitting: AtomicBool,
}

impl Lifecycle {
  fn quit(&self) {
    self.quitting.store(true, Ordering::SeqCst);
  }

  fn is_quitting(&self) -> bool {
    self.quitting.load(Ordering::SeqCst)
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

/// Puts the window on the desktop at startup, and again when the watchdog
/// brings it back after Explorer restarts. Returns whether Progman is the parent.
fn settle_on_wall(app: &AppHandle, window: &WebviewWindow) -> bool {
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
  embedded
}

/// What an Explorer restart can do to the window.
enum Loss {
  /// The window is gone: a clean Explorer exit destroyed it, or a crash left
  /// Tauri holding a dead handle. Its WebView is gone with it.
  Window,
  /// The window is alive but outside Progman, as after a Wall that started
  /// before Explorer.
  Parent(WebviewWindow),
}

/// A transition in progress detaches the window on purpose, so only a
/// settled Wall can lose its parent.
fn find_loss(app: &AppHandle) -> Option<Loss> {
  let window = app.get_webview_window("main");
  let Some(hwnd) = window.as_ref().and_then(|window| window.hwnd().ok()).filter(|hwnd| wallpaper::is_alive(*hwnd)) else {
    return Some(Loss::Window);
  };
  let state = app.state::<PlacementState>();
  let settled_wall = state.snapshot().placement == Placement::Wall && !state.is_moving();
  if settled_wall && !wallpaper::is_embedded(hwnd) {
    window.map(Loss::Parent)
  } else {
    None
  }
}

/// Explorer restarts take Progman, and with it the window. Once a new Progman
/// and its icon layer exist, the watchdog restarts Canvie when the window is
/// gone, or embeds a living window again. In Wall the document is already
/// saved, so a restart loses only the session history.
fn watch_desktop(app: AppHandle) {
  thread::spawn(move || {
    let mut lost_checks = 0;
    let mut icon_waits = 0;
    let mut retry_in = 0;
    let mut backoff = 1;
    loop {
      thread::sleep(DESKTOP_CHECK_INTERVAL);
      if app.state::<Lifecycle>().is_quitting() {
        return;
      }
      let Some(loss) = find_loss(&app) else {
        (lost_checks, icon_waits, retry_in, backoff) = (0, 0, 0, 1);
        continue;
      };
      // A single check can land between a detach and the end of its transition.
      lost_checks += 1;
      if lost_checks < 2 {
        continue;
      }
      if lost_checks == 2 {
        match loss {
          Loss::Window => log::warn!("wall: the window is gone; waiting for the desktop to restart Canvie"),
          Loss::Parent(_) => log::warn!("wall: the window is outside Progman; waiting for the desktop"),
        }
      }
      if retry_in > 0 {
        retry_in -= 1;
        continue;
      }
      match wallpaper::desktop() {
        Desktop::Missing => continue,
        Desktop::WithoutIcons if icon_waits < ICON_LAYER_PATIENCE => {
          icon_waits += 1;
          continue;
        }
        _ => {}
      }
      match loss {
        Loss::Window => {
          log::info!("restarting Canvie on the new desktop");
          app.request_restart();
          return;
        }
        Loss::Parent(window) => {
          if !re_embed(&app, window) {
            retry_in = backoff;
            backoff = (backoff * 2).min(MAX_RETRY_CHECKS);
          }
        }
      }
    }
  });
}

/// Embeds the window again on the main thread, where every placement change
/// runs. Returns whether it is in Progman.
fn re_embed(app: &AppHandle, window: WebviewWindow) -> bool {
  let (done, outcome) = mpsc::channel();
  let handle = app.clone();
  let scheduled = app.run_on_main_thread(move || {
    // The watchdog waits on the other end; it is gone only when the app exits.
    let _ = done.send(re_embed_now(&handle, &window));
  });
  if let Err(error) = scheduled {
    log::warn!("wall re-embed could not reach the main thread: {error}");
    return false;
  }
  outcome.recv().unwrap_or(false)
}

fn re_embed_now(app: &AppHandle, window: &WebviewWindow) -> bool {
  let state = app.state::<PlacementState>();
  let Ok(_move) = state.begin_move() else {
    return false;
  };
  // Edit was called, or the window came back, while the watchdog waited.
  if state.snapshot().placement == Placement::Edit || window.hwnd().is_ok_and(wallpaper::is_embedded) {
    return true;
  }
  log::info!("wall: embedding the window in the new Progman");
  settle_on_wall(app, window)
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

/// Alt + F4 or WM_CLOSE. In Edit the frontend decides, because only it knows
/// whether an area exists: it pins the area, or quits when there is none. In
/// Wall it quits, like Sair.
fn on_close_requested(app: &AppHandle, api: &CloseRequestApi) {
  if app.state::<PlacementState>().snapshot().placement == Placement::Edit {
    api.prevent_close();
    log::info!("close requested in Edit");
    if let Err(error) = app.emit(CLOSE_REQUESTED_EVENT, ()) {
      log::warn!("close request event failed: {error}");
    }
  } else {
    log::info!("close requested in Wall: quit");
    app.state::<Lifecycle>().quit();
  }
}

/// Called by the frontend for a close request before any area exists, when
/// there is nothing to save or pin.
#[tauri::command]
fn quit_app(app: AppHandle) {
  log::info!("close requested without an area: quit");
  app.state::<Lifecycle>().quit();
  app.exit(0);
}

/// Failures the frontend reports to the release log. Only these codes cross
/// the bridge, so canvas content cannot reach the log.
#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "snake_case")]
enum FrontendIssue {
  SaveFailed,
  DocumentRecovered,
  SavingBlocked,
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

#[tauri::command]
fn report_frontend_issue(issue: FrontendIssue) {
  let message = match issue {
    FrontendIssue::SaveFailed => "document save failed; the last valid document stays in storage",
    FrontendIssue::DocumentRecovered => "invalid stored document replaced by an empty canvas; a copy was kept",
    FrontendIssue::SavingBlocked => "stored document could not be read or copied; saving is off for this session",
  };
  log::warn!("frontend: {message}");
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
        app.state::<Lifecycle>().quit();
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
    .manage(Lifecycle {
      quitting: AtomicBool::new(false),
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
      log::info!("Canvie startup {}", app.package_info().version);
      let window = create_main_window(app)?;
      settle_on_wall(app.handle(), &window);
      if let Err(error) = build_tray(app) {
        log::warn!("tray unavailable: {error}");
      }
      match app.global_shortcut().register(edit_shortcut()) {
        Ok(()) => log::info!("shortcut registered: Ctrl+Alt+T"),
        Err(error) => log::warn!("shortcut Ctrl+Alt+T unavailable; Editar stays in the tray: {error}"),
      }
      watch_desktop(app.handle().clone());
      Ok(())
    })
    .on_window_event(|window, event| {
      if let (WindowEvent::CloseRequested { api, .. }, "main") = (event, window.label()) {
        on_close_requested(window.app_handle(), api);
      }
    })
    .invoke_handler(tauri::generate_handler![get_placement, enter_edit, pin_to_wall, quit_app, report_frontend_issue])
    .build(tauri::generate_context!())
    .expect("error while building Canvie")
    .run(|app, event| {
      // Losing the last window asks to exit with no code. Unless the user is
      // quitting, Explorer destroyed the window, and the watchdog restarts
      // Canvie once the desktop is back.
      if let RunEvent::ExitRequested { code: None, api, .. } = event {
        if !app.state::<Lifecycle>().is_quitting() {
          log::warn!("main window destroyed outside a quit; waiting for the desktop");
          api.prevent_exit();
        }
      }
    });
}
