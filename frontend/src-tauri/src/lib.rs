use tauri::{App, AppHandle, Manager, WebviewWindowBuilder};

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

fn create_main_window(app: &App) -> tauri::Result<()> {
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
  builder.build()?;
  Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
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
      create_main_window(app)?;
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running Canvie");
}
